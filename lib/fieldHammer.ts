// lib/fieldHammer.ts
// Pure settlement engine for "Hammerskin" (game-type id "fieldhammer"):
// individual round-robin skins where every unordered pair has a 1-v-1 bet each
// hole (low net wins the base stake).
//
//  - A single HOLE-LEVEL hammer doubles (×2) or quadruples (×4) every pairing's
//    bet on the hole (entry.hammer 0/1/2 → holeMult 1/2/4).
//  - Each player can FORFEIT (per-player flag): they concede every pairing for
//    the base stake and are out of contention.
//
// HAMMER CARRY: when a hammered pairing (holeMult > 1) ties, the doubled bet
// carries to the same pairing next hole. The carry is only ever settled between
// two players who both play it out, so a forfeiter never pays a carried bet (it
// washes for that pairing). Every applied bet is zero-sum, so the ledger sums to 0.
//
// NO React / UI / network imports.

export type PlayerId = string;
export type PairKey = string; // canonical `${minId}|${maxId}`
export type FHAction = "forfeit"; // per-player flag (kept as a union for the entry)

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

/** Hole multiplier from the hole-level hammer level (0→1×, 1→2×, 2→4×). */
export const holeMultOf = (hammer?: number): number =>
  2 ** Math.max(0, Math.floor(hammer ?? 0));

export interface HoleInput {
  players: PlayerId[];
  grossScores: Record<PlayerId, number>;
  /** Strokes received on THIS hole per player (from the existing pops engine). */
  pops: Record<PlayerId, number>;
  /** Per-player forfeit flag. */
  forfeits: Record<PlayerId, boolean>;
  /** Hole-level hammer multiplier (1, 2, or 4). */
  holeMult: number;
  baseStake: number;
  /** Carried bet per pairing from a prior hammered tie. */
  carryIn?: Record<PairKey, number>;
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
  carryOut: Record<PairKey, number>;
}

/** Settle ONE hole. */
export function settleHole(input: HoleInput): HoleResult {
  const { players, grossScores, pops, forfeits, holeMult, baseStake } = input;
  const carryIn = input.carryIn ?? {};
  const deltas: Record<PlayerId, number> = {};
  for (const id of players) deltas[id] = 0;
  const pairOutcomes: PairOutcome[] = [];
  const carryOut: Record<PairKey, number> = {};

  for (const key of allPairs(players)) {
    const [a, b] = unpair(key);
    const carry = carryIn[key] ?? 0;
    const aF = !!forfeits[a];
    const bF = !!forfeits[b];

    // Both conceded → nothing happens; any carry washes.
    if (aF && bF) {
      carryOut[key] = 0;
      pairOutcomes.push({ pair: key, a, b, stake: 0, winner: null, push: true, forfeit: true });
      continue;
    }
    // One conceded → pays the base stake; the carried bet washes (not their bet).
    if (aF || bF) {
      const folder = aF ? a : b;
      const winner = aF ? b : a;
      deltas[winner] += baseStake;
      deltas[folder] -= baseStake;
      carryOut[key] = 0;
      pairOutcomes.push({ pair: key, a, b, stake: baseStake, winner, push: false, forfeit: true });
      continue;
    }

    const stake = baseStake * holeMult + carry;
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
        // Tie: a hammered bet carries; a plain tie washes.
        carryOut[key] = holeMult > 1 ? stake : 0;
        pairOutcomes.push({ pair: key, a, b, stake, winner: null, push: true, forfeit: false });
      }
    } else {
      // Not played yet — preserve any carried bet.
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
  forfeits: Record<PlayerId, boolean>;
  holeMult: number;
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
  let carry: Record<PairKey, number> = {};
  const holeResults: RoundResult["holeResults"] = [];

  for (const h of [...input.holes].sort((x, y) => x.number - y.number)) {
    const result = settleHole({
      players: input.players,
      grossScores: h.grossScores,
      pops: h.pops,
      forfeits: h.forfeits,
      holeMult: h.holeMult,
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
