import { describe, it, expect } from "vitest";
import {
  pairKey,
  settleHole,
  settleRound,
  settleUp,
  PairState,
  PairKey,
} from "./fieldHammer";

const sum = (l: Record<string, number>) =>
  Object.values(l).reduce((a, b) => a + b, 0);

const noPops = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));

describe("field hammer — settleHole", () => {
  const players = ["A", "B", "C", "D"];

  it("worked example: A hammers the field; D folds, B & C accept", () => {
    const pairings: Record<PairKey, PairState> = {
      [pairKey("A", "B")]: { doublings: 1 }, // B accepted → $10
      [pairKey("A", "C")]: { doublings: 1 }, // C accepted → $10
      [pairKey("A", "D")]: { doublings: 0, fold: { folder: "D", settleStake: 5 } },
      // B–C, B–D, C–D default to { doublings: 0 } → base $5
    };
    const { deltas, carryOut } = settleHole({
      players,
      grossScores: { A: 4, B: 5, C: 4, D: 6 }, // net (pops 0)
      pops: noPops(players),
      pairings,
      baseStake: 5,
    });
    expect(deltas.A).toBe(15);
    expect(deltas.C).toBe(10);
    expect(deltas.B).toBe(-10);
    expect(deltas.D).toBe(-15);
    expect(sum(deltas)).toBe(0);
    expect(Object.values(carryOut).every((v) => v === 0)).toBe(true);
  });

  it("plain round-robin skins (no hammers)", () => {
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 5, C: 4, D: 6 },
      pops: noPops(players),
      pairings: {},
      baseStake: 5,
    });
    // A: +5(B) +0(C tie) +5(D) = 10; B: -5 -5(C) +5(D) = -5; C: +5(B) +5(D) = 10; D: -15
    expect(deltas.A).toBe(10);
    expect(deltas.B).toBe(-5);
    expect(deltas.C).toBe(10);
    expect(deltas.D).toBe(-15);
    expect(sum(deltas)).toBe(0);
  });

  it("uses net scores via the supplied pops", () => {
    // D gets a stroke; gross 6 → net 5, ties A's net 4? no: 6-1=5 vs A 4 → A still wins.
    const { deltas } = settleHole({
      players: ["A", "D"],
      grossScores: { A: 4, D: 5 },
      pops: { A: 0, D: 1 }, // D net = 4 → tie with A
      pairings: {},
      baseStake: 5,
    });
    expect(deltas.A).toBe(0);
    expect(deltas.D).toBe(0); // push after pops
  });

  it("an all-fold hole settles every pairing by fold; sums to 0", () => {
    const pairings: Record<PairKey, PairState> = {
      [pairKey("A", "B")]: { doublings: 0, fold: { folder: "B", settleStake: 5 } },
      [pairKey("A", "C")]: { doublings: 0, fold: { folder: "A", settleStake: 5 } },
      [pairKey("A", "D")]: { doublings: 0, fold: { folder: "D", settleStake: 5 } },
      [pairKey("B", "C")]: { doublings: 0, fold: { folder: "C", settleStake: 5 } },
      [pairKey("B", "D")]: { doublings: 0, fold: { folder: "B", settleStake: 5 } },
      [pairKey("C", "D")]: { doublings: 0, fold: { folder: "D", settleStake: 5 } },
    };
    const { deltas } = settleHole({
      players,
      grossScores: {}, // scores irrelevant — all folded
      pops: noPops(players),
      pairings,
      baseStake: 5,
    });
    // A: -5(B fold? folder B → A wins +5) ... compute: A|B folder B → A +5; A|C folder A → C +5, A -5;
    // A|D folder D → A +5. So A: +5 -5 +5 = +5.
    expect(deltas.A).toBe(5);
    expect(sum(deltas)).toBe(0);
  });

  it("re-hammers compound up to the lines cap (doublings = 2 → 4× stake)", () => {
    const { deltas } = settleHole({
      players: ["A", "B"],
      grossScores: { A: 4, B: 5 },
      pops: { A: 0, B: 0 },
      pairings: { [pairKey("A", "B")]: { doublings: 2 } }, // $5 × 4 = $20
      baseStake: 5,
    });
    expect(deltas.A).toBe(20);
    expect(deltas.B).toBe(-20);
  });

  it("a played-out tie pushes; carryTies surfaces the carried stake", () => {
    const base = {
      players: ["A", "B"],
      grossScores: { A: 4, B: 4 },
      pops: { A: 0, B: 0 },
      pairings: { [pairKey("A", "B")]: { doublings: 1 } }, // $10 at risk
      baseStake: 5,
    };
    const wash = settleHole({ ...base, carryTies: false });
    expect(wash.deltas.A).toBe(0);
    expect(wash.carryOut[pairKey("A", "B")]).toBe(0);

    const carry = settleHole({ ...base, carryTies: true });
    expect(carry.deltas.A).toBe(0);
    expect(carry.carryOut[pairKey("A", "B")]).toBe(10); // stake rolls to next hole
  });
});

describe("field hammer — settleRound", () => {
  it("threads carryTies and the ledger sums to 0 across holes", () => {
    const players = ["A", "B"];
    const k = pairKey("A", "B");
    const round = settleRound({
      players,
      baseStake: 5,
      carryTies: true,
      holes: [
        // Hole 1: tie at $10 → carries.
        { number: 1, grossScores: { A: 4, B: 4 }, pops: { A: 0, B: 0 }, pairings: { [k]: { doublings: 1 } } },
        // Hole 2: base $5 + carried $10 = $15, A wins.
        { number: 2, grossScores: { A: 4, B: 5 }, pops: { A: 0, B: 0 }, pairings: {} },
      ],
    });
    expect(round.ledger.A).toBe(15);
    expect(round.ledger.B).toBe(-15);
    expect(sum(round.ledger)).toBe(0);
  });

  it("a full 4-player multi-hole round always sums to 0", () => {
    const players = ["A", "B", "C", "D"];
    const round = settleRound({
      players,
      baseStake: 5,
      carryTies: false,
      holes: [
        {
          number: 1,
          grossScores: { A: 4, B: 5, C: 4, D: 6 },
          pops: noPops(players),
          pairings: {
            [pairKey("A", "B")]: { doublings: 1 },
            [pairKey("A", "C")]: { doublings: 1 },
            [pairKey("A", "D")]: { doublings: 0, fold: { folder: "D", settleStake: 5 } },
          },
        },
        {
          number: 2,
          grossScores: { A: 5, B: 4, C: 6, D: 4 },
          pops: noPops(players),
          pairings: { [pairKey("B", "C")]: { doublings: 2 } },
        },
      ],
    });
    expect(sum(round.ledger)).toBe(0);
  });
});

describe("field hammer — settleUp", () => {
  it("rolls a ledger into minimal who-pays-whom transactions", () => {
    const txns = settleUp({ A: 15, C: 10, B: -10, D: -15 });
    expect(txns).toHaveLength(2);
    // D (−15) pays A (+15); B (−10) pays C (+10).
    expect(txns).toContainEqual({ from: "D", to: "A", amount: 15 });
    expect(txns).toContainEqual({ from: "B", to: "C", amount: 10 });
    // Transactions net out the ledger exactly.
    const net: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const t of txns) {
      net[t.from] -= t.amount;
      net[t.to] += t.amount;
    }
    expect(net).toEqual({ A: 15, C: 10, B: -10, D: -15 });
  });
});
