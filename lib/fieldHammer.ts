// lib/fieldHammer.ts
// Pure settlement engine for "Sledgehammer" (game-type id "fieldhammer"):
// individual round-robin skins where every unordered pair has a 1-v-1 bet each
// hole (low net wins the base stake). Each player sets a per-hole stance via a
// button next to their score:
//   "hammer" — doubles the pairing's bet (×2) for BOTH win and loss.
//   "double" — quadruples it (×4).
//   "forfeit" — concede every pairing for the base stake (out of contention).
// The pairing's stake = baseStake × the highest stance on either player.
//
// HAMMER CARRY: when a HAMMERED pairing ties, the doubled bet carries — but it
// carries as a ONE-SIDED bet owned by the player who hammered. On the carry hole
// only that hammerer wins (+) or loses (−) the carried amount; the opponent is
// never on the hook for it (so a forfeiter only ever pays the base). This makes a
// carry NOT zero-sum, by design. The base bet on every hole is still zero-sum.
//
// NO React / UI / network imports.

export type PlayerId = string;
export type PairKey = string; // canonical `${minId}|${maxId}`
export type FHAction = "hammer" | "double" | "forfeit";

export function pairKey(a: PlayerId, b: PlayerId): PairKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
export function unpair(key: PairKey): [PlayerId, PlayerId] {
  const [a, b] = key.split("|");
  return [a, b];
}
export function allPairs(ids: PlayerId[]): PairKey[] {
  const out: PairKey[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) out.push(pairKey(ids[i], ids[j]));
  }
  return out;
}

/** Bet multiplier for a stance: double 4×, hammer 2×, else 1×. */
export const multOf = (a?: FHAction): number => (a === "double" ? 4 : a === "hammer" ? 2 : 1);

/** A hammered tie carried forward — owned by the player who hammered it. */
export interface FHCarry {
  amount: number;
  hammerer: PlayerId;
}

export interface HoleInput {
  players: PlayerId[];
  grossScores: Record<PlayerId, number>;
  /** Strokes received on THIS hole per player (from the existing pops engine). */
  pops: Record<PlayerId, number>;
  /** Per-player stance; absent = plain (×1). */
  actions: Record<PlayerId, FHAction>;
  baseStake: number;
  /** One-sided hammer carry per pairing from a prior hole. */
  carryIn?: Record<PairKey, FHCarry>;
}

export interface PairOutcome {
  pair: PairKey;
  a: PlayerId;
  b: PlayerId;
  stake: number;
  winner: PlayerId | null;
  push: boolean;
  forfeit: boolean;
}

export interface HoleResult {
  deltas: Record<PlayerId, number>;
  pairOutcomes: PairOutcome[];
  carryOut: Record<PairKey, FHCarry>;
}

/** Settle ONE hole given the per-player stances + gross scores. */
export function settleHole(input: HoleInput): HoleResult {
  const { players, grossScores, pops, actions, baseStake } = input;
  const carryIn = input.carryIn ?? {};
  const deltas: Record<PlayerId, number> = {};
  for (const id of players) deltas[id] = 0;
  const pairOutcomes: PairOutcome[] = [];
  const carryOut: Record<PairKey, FHCarry> = {};

  for (const key of allPairs(players)) {
    const [a, b] = unpair(key);
    const carry = carryIn[key];
    const aF = actions[a] === "forfeit";
    const bF = actions[b] === "forfeit";
    const pairMult = Math.max(multOf(actions[a]), multOf(actions[b]));
    const hammerer = multOf(actions[a]) >= multOf(actions[b]) ? a : b;

    // ── Settle THIS hole's base bet (zero-sum) and find the pairing winner. ──
    let winner: PlayerId | null = null;
    let push = false;
    let scored = false;
    let stake = 0;
    if (aF && bF) {
      push = true;
      scored = true; // both conceded — nothing on the base
    } else if (aF || bF) {
      const folder = aF ? a : b;
      winner = aF ? b : a;
      deltas[winner] += baseStake;
      deltas[folder] -= baseStake;
      stake = baseStake;
      scored = true;
    } else {
      const ga = grossScores[a];
      const gb = grossScores[b];
      if (typeof ga === "number" && typeof gb === "number") {
        scored = true;
        const netA = ga - (pops[a] ?? 0);
        const netB = gb - (pops[b] ?? 0);
        stake = baseStake * pairMult;
        if (netA < netB) {
          deltas[a] += stake;
          deltas[b] -= stake;
          winner = a;
        } else if (netB < netA) {
          deltas[b] += stake;
          deltas[a] -= stake;
          winner = b;
        } else {
          push = true;
        }
      }
    }

    // ── Resolve / forward the one-sided hammer carry. ──
    if (!scored) {
      // Not played yet → preserve any carry untouched.
      if (carry) carryOut[key] = carry;
    } else if (winner) {
      // Base resolved → the carry pays only its owner (win + / loss −).
      if (carry) {
        deltas[carry.hammerer] += winner === carry.hammerer ? carry.amount : -carry.amount;
      }
    } else if (push) {
      if (aF && bF) {
        // Both conceded → the carry washes.
      } else if (pairMult > 1) {
        // Hammered tie → the doubled bet becomes (or extends) the carry.
        carryOut[key] = { amount: baseStake * pairMult + (carry?.amount ?? 0), hammerer };
      } else if (carry) {
        // Plain tie with an existing carry → it rides along unchanged.
        carryOut[key] = carry;
      }
      // Plain tie with no carry → nothing carries.
    }

    pairOutcomes.push({ pair: key, a, b, stake, winner, push, forfeit: aF || bF });
  }

  return { deltas, pairOutcomes, carryOut };
}

// ── Full round ──────────────────────────────────────────────────────────────

export interface RoundHole {
  number: number;
  grossScores: Record<PlayerId, number>;
  pops: Record<PlayerId, number>;
  actions: Record<PlayerId, FHAction>;
}

export interface RoundInput {
  players: PlayerId[];
  baseStake: number;
  holes: RoundHole[];
}

export interface RoundResult {
  ledger: Record<PlayerId, number>;
  holeResults: { number: number; result: HoleResult }[];
}

export function settleRound(input: RoundInput): RoundResult {
  const ledger: Record<PlayerId, number> = {};
  for (const id of input.players) ledger[id] = 0;
  let carry: Record<PairKey, FHCarry> = {};
  const holeResults: RoundResult["holeResults"] = [];

  for (const h of [...input.holes].sort((x, y) => x.number - y.number)) {
    const result = settleHole({
      players: input.players,
      grossScores: h.grossScores,
      pops: h.pops,
      actions: h.actions,
      baseStake: input.baseStake,
      carryIn: carry,
    });
    for (const id of input.players) ledger[id] += result.deltas[id];
    carry = result.carryOut;
    holeResults.push({ number: h.number, result });
  }

  return { ledger, holeResults };
}

// ── Settle up (minimal transactions) ─────────────────────────────────────────

export interface Transaction {
  from: PlayerId;
  to: PlayerId;
  amount: number;
}

/** Roll a ledger into a minimal "who pays whom" set of transactions. */
export function settleUp(ledger: Record<PlayerId, number>): Transaction[] {
  const cents = (v: number) => Math.round(v * 100);
  const debtors: { id: PlayerId; amt: number }[] = [];
  const creditors: { id: PlayerId; amt: number }[] = [];
  for (const [id, v] of Object.entries(ledger)) {
    const c = cents(v);
    if (c < 0) debtors.push({ id, amt: -c });
    else if (c > 0) creditors.push({ id, amt: c });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const txns: Transaction[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) txns.push({ from: debtors[i].id, to: creditors[j].id, amount: pay / 100 });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return txns;
}
