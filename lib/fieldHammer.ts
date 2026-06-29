// lib/fieldHammer.ts
// Pure settlement engine for "Field Hammer": individual round-robin skins where
// every unordered pair has a 1-v-1 bet each hole (low net wins the base stake).
// Each player can set a per-hole stance via a button next to their score:
//   "hammer" — if this player LOSES a pairing, they pay ×2.
//   "double" — if this player loses, they pay ×4.
//   "forfeit" — concede every pairing for the base stake (out of contention).
// No thrower/responder step — each player just sets their own stance.
//
// NO React / UI / network imports. INVARIANT: every pairing nets to zero, so each
// hole's deltas and the full ledger always sum to exactly 0.

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

/** Loss multiplier for a player's stance: double 4×, hammer 2×, else 1×. */
export const multOf = (a?: FHAction): number => (a === "double" ? 4 : a === "hammer" ? 2 : 1);

export interface HoleInput {
  players: PlayerId[];
  grossScores: Record<PlayerId, number>;
  /** Strokes received on THIS hole per player (from the existing pops engine). */
  pops: Record<PlayerId, number>;
  /** Per-player stance; absent = plain (×1). */
  actions: Record<PlayerId, FHAction>;
  baseStake: number;
  /** Stake carried into a pairing from a prior push (skins-style). */
  carryIn?: Record<PairKey, number>;
  /** If true, a pushed pairing's stake carries to the same pairing next hole. */
  carryTies?: boolean;
}

export interface PairOutcome {
  pair: PairKey;
  a: PlayerId;
  b: PlayerId;
  stake: number; // amount that changed hands
  winner: PlayerId | null; // null = push / not-yet-scored
  push: boolean;
  forfeit: boolean;
}

export interface HoleResult {
  deltas: Record<PlayerId, number>;
  pairOutcomes: PairOutcome[];
  carryOut: Record<PairKey, number>;
}

/** Settle ONE hole given the per-player stances + gross scores. */
export function settleHole(input: HoleInput): HoleResult {
  const { players, grossScores, pops, actions, baseStake } = input;
  const carryIn = input.carryIn ?? {};
  const deltas: Record<PlayerId, number> = {};
  for (const id of players) deltas[id] = 0;
  const pairOutcomes: PairOutcome[] = [];
  const carryOut: Record<PairKey, number> = {};

  for (const key of allPairs(players)) {
    const [a, b] = unpair(key);
    const carry = carryIn[key] ?? 0;
    const aF = actions[a] === "forfeit";
    const bF = actions[b] === "forfeit";

    // Both conceded → nothing happens (any carry washes).
    if (aF && bF) {
      carryOut[key] = 0;
      pairOutcomes.push({ pair: key, a, b, stake: 0, winner: null, push: true, forfeit: true });
      continue;
    }
    // One conceded → pays the base stake to the other (out of contention).
    if (aF || bF) {
      const folder = aF ? a : b;
      const winner = aF ? b : a;
      deltas[winner] += baseStake;
      deltas[folder] -= baseStake;
      carryOut[key] = 0;
      pairOutcomes.push({ pair: key, a, b, stake: baseStake, winner, push: false, forfeit: true });
      continue;
    }

    // A hammer doubles the pairing's bet (×2/×4) for BOTH players — the highest
    // stance set on either player. The full stake includes any carried bet.
    const pairMult = Math.max(multOf(actions[a]), multOf(actions[b]));
    const stake = baseStake * pairMult + carry;
    const ga = grossScores[a];
    const gb = grossScores[b];

    if (typeof ga === "number" && typeof gb === "number") {
      const netA = ga - (pops[a] ?? 0);
      const netB = gb - (pops[b] ?? 0);
      if (netA < netB) {
        deltas[a] += stake;
        deltas[b] -= stake;
        carryOut[key] = 0;
        pairOutcomes.push({ pair: key, a, b, stake, winner: a, push: false, forfeit: false });
      } else if (netB < netA) {
        deltas[b] += stake;
        deltas[a] -= stake;
        carryOut[key] = 0;
        pairOutcomes.push({ pair: key, a, b, stake, winner: b, push: false, forfeit: false });
      } else {
        // Push: a hammered bet always carries; a plain tie carries only when
        // carryTies is on.
        carryOut[key] = pairMult > 1 || input.carryTies ? stake : 0;
        pairOutcomes.push({ pair: key, a, b, stake, winner: null, push: true, forfeit: false });
      }
    } else {
      // Not yet scored — preserve any carried bet (don't drop it on this hole).
      carryOut[key] = carry;
      pairOutcomes.push({ pair: key, a, b, stake, winner: null, push: false, forfeit: false });
    }
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
  carryTies: boolean;
  holes: RoundHole[];
}

export interface RoundResult {
  ledger: Record<PlayerId, number>;
  holeResults: { number: number; result: HoleResult }[];
}

export function settleRound(input: RoundInput): RoundResult {
  const ledger: Record<PlayerId, number> = {};
  for (const id of input.players) ledger[id] = 0;
  let carry: Record<PairKey, number> = {};
  const holeResults: RoundResult["holeResults"] = [];

  for (const h of [...input.holes].sort((x, y) => x.number - y.number)) {
    const result = settleHole({
      players: input.players,
      grossScores: h.grossScores,
      pops: h.pops,
      actions: h.actions,
      baseStake: input.baseStake,
      carryIn: carry,
      carryTies: input.carryTies,
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

/** Roll a (zero-sum) ledger into a minimal "who pays whom" set of transactions. */
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
