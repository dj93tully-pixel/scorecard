// lib/fieldHammer.ts
// Pure settlement engine for the "Field Hammer" game mode: individual round-robin
// skins with a "hammer the field" mechanic (each opponent accepts or folds
// independently). NO React / UI / network imports — money is computed only here.
//
// Net scores are computed elsewhere (the UI reuses the existing pops engine) and
// passed in as `pops` per hole; this module never reimplements handicaps.
//
// INVARIANT: every pairing nets to zero, so each hole's deltas and the full
// ledger always sum to exactly 0.

export type PlayerId = string;
export type PairKey = string; // canonical `${minId}|${maxId}`

/** Canonical, order-independent key for an unordered pair. */
export function pairKey(a: PlayerId, b: PlayerId): PairKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function unpair(key: PairKey): [PlayerId, PlayerId] {
  const [a, b] = key.split("|");
  return [a, b];
}

/** Every unordered pair of the given players, as canonical keys. */
export function allPairs(ids: PlayerId[]): PairKey[] {
  const out: PairKey[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) out.push(pairKey(ids[i], ids[j]));
  }
  return out;
}

export interface PairState {
  /** Times this pairing's stake has doubled (one per accepted hammer). */
  doublings: number;
  /** If set, the pairing was folded: `folder` pays the other player `settleStake`. */
  fold?: { folder: PlayerId; settleStake: number };
}

export interface HoleInput {
  players: PlayerId[];
  grossScores: Record<PlayerId, number>;
  /** Strokes received on THIS hole per player (from the existing pops engine). */
  pops: Record<PlayerId, number>;
  pairings: Record<PairKey, PairState>;
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
  stake: number; // amount that changed hands (fold settle stake, or the played stake)
  folded: boolean;
  winner: PlayerId | null; // null = push or not-yet-scored
  push: boolean;
}

export interface HoleResult {
  deltas: Record<PlayerId, number>;
  pairOutcomes: PairOutcome[];
  /** Stake carried to the next hole per pairing (0 unless a push + carryTies). */
  carryOut: Record<PairKey, number>;
}

/** Settle ONE hole given the final per-pairing state + gross scores. */
export function settleHole(input: HoleInput): HoleResult {
  const { players, grossScores, pops, pairings, baseStake } = input;
  const carryIn = input.carryIn ?? {};
  const deltas: Record<PlayerId, number> = {};
  for (const id of players) deltas[id] = 0;
  const pairOutcomes: PairOutcome[] = [];
  const carryOut: Record<PairKey, number> = {};

  for (const key of allPairs(players)) {
    const [a, b] = unpair(key);
    const st: PairState = pairings[key] ?? { doublings: 0 };

    // Folded pairing: settled immediately, scores no longer matter.
    if (st.fold) {
      const folder = st.fold.folder;
      const winner = folder === a ? b : a;
      const s = st.fold.settleStake;
      deltas[winner] += s;
      deltas[folder] -= s;
      carryOut[key] = 0;
      pairOutcomes.push({ pair: key, a, b, stake: s, folded: true, winner, push: false });
      continue;
    }

    const stake = baseStake * 2 ** (st.doublings ?? 0) + (carryIn[key] ?? 0);
    const ga = grossScores[a];
    const gb = grossScores[b];
    let winner: PlayerId | null = null;
    let push = false;
    if (typeof ga === "number" && typeof gb === "number") {
      const netA = ga - (pops[a] ?? 0);
      const netB = gb - (pops[b] ?? 0);
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
    carryOut[key] = push && input.carryTies ? stake : 0;
    pairOutcomes.push({ pair: key, a, b, stake, folded: false, winner, push });
  }

  return { deltas, pairOutcomes, carryOut };
}

// ── Full round ──────────────────────────────────────────────────────────────

export interface RoundHole {
  number: number;
  grossScores: Record<PlayerId, number>;
  pops: Record<PlayerId, number>;
  pairings: Record<PairKey, PairState>;
}

export interface RoundInput {
  players: PlayerId[];
  baseStake: number;
  carryTies: boolean;
  holes: RoundHole[]; // in hole order
}

export interface RoundResult {
  ledger: Record<PlayerId, number>;
  holeResults: { number: number; result: HoleResult }[];
}

/** Settle a whole round, threading per-pairing carry across holes. */
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
      pairings: h.pairings,
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
  const debtors: { id: PlayerId; amt: number }[] = []; // owe (positive amount)
  const creditors: { id: PlayerId; amt: number }[] = []; // owed (positive amount)
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
    if (pay > 0) {
      txns.push({ from: debtors[i].id, to: creditors[j].id, amount: pay / 100 });
    }
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return txns;
}
