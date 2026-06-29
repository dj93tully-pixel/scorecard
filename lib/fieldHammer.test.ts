import { describe, it, expect } from "vitest";
import { settleHole, settleRound, settleUp } from "./fieldHammer";

const sum = (l: Record<string, number>) =>
  Object.values(l).reduce((a, b) => a + b, 0);
const noPops = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));

describe("field hammer — settleHole", () => {
  const players = ["A", "B", "C", "D"];

  it("plain round-robin skins (no stances)", () => {
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 5, C: 4, D: 6 },
      pops: noPops(players),
      actions: {},
      baseStake: 5,
    });
    // A: +5(B) +0(C tie) +5(D) = 10; B: -5 -5(C) +5(D) = -5; C: +5(B) +5(D) = 10; D: -15
    expect(deltas.A).toBe(10);
    expect(deltas.B).toBe(-5);
    expect(deltas.C).toBe(10);
    expect(deltas.D).toBe(-15);
    expect(sum(deltas)).toBe(0);
  });

  it("a hammerer who loses a pairing pays ×2", () => {
    const { deltas } = settleHole({
      players: ["A", "B"],
      grossScores: { A: 6, B: 4 },
      pops: { A: 0, B: 0 },
      actions: { A: "hammer" }, // A loses → pays ×2
      baseStake: 5,
    });
    expect(deltas.A).toBe(-10);
    expect(deltas.B).toBe(10);
  });

  it("a double-hammerer who loses pays ×4; a hammerer who WINS is unaffected", () => {
    const lose = settleHole({
      players: ["A", "B"],
      grossScores: { A: 6, B: 4 },
      pops: { A: 0, B: 0 },
      actions: { A: "double" },
      baseStake: 5,
    });
    expect(lose.deltas.A).toBe(-20); // 5 × 4

    const win = settleHole({
      players: ["A", "B"],
      grossScores: { A: 4, B: 6 },
      pops: { A: 0, B: 0 },
      actions: { A: "double" }, // A wins → multiplier irrelevant
      baseStake: 5,
    });
    expect(win.deltas.A).toBe(5); // collects base from B (B has no stance)
  });

  it("forfeit concedes every pairing for the base stake (out of contention)", () => {
    // B forfeits; scores otherwise: A4 B(2!) C4 D6 — B would have had low net but folds.
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 2, C: 4, D: 6 },
      pops: noPops(players),
      actions: { B: "forfeit" },
      baseStake: 5,
    });
    // B pays $5 to each of A, C, D regardless of score → B −15.
    expect(deltas.B).toBe(-15);
    // A: +5(B) +0(C tie) +5(D) = 10; C: +5(B) +5(D) = 10;
    // D: −5(A) +5(B forfeit) −5(C) = −5.
    expect(deltas.A).toBe(10);
    expect(deltas.C).toBe(10);
    expect(deltas.D).toBe(-5);
    expect(sum(deltas)).toBe(0);
  });

  it("worked example: A hammer, B forfeit, C double, scores A4 B5 C4 D6", () => {
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 5, C: 4, D: 6 },
      pops: noPops(players),
      actions: { A: "hammer", B: "forfeit", C: "double" },
      baseStake: 5,
    });
    // A-B: B folds → A+5/B-5. A-C: tie → 0. A-D: A wins, D pays ×1 → A+5/D-5.
    // B-C: B folds → C+5/B-5. B-D: B folds → D+5/B-5. C-D: C wins, D ×1 → C+5/D-5.
    expect(deltas.A).toBe(10);
    expect(deltas.B).toBe(-15);
    expect(deltas.C).toBe(10);
    expect(deltas.D).toBe(-5);
    expect(sum(deltas)).toBe(0);
  });

  it("uses net scores via the supplied pops", () => {
    const { deltas } = settleHole({
      players: ["A", "D"],
      grossScores: { A: 4, D: 5 },
      pops: { A: 0, D: 1 }, // D net = 4 → tie
      actions: {},
      baseStake: 5,
    });
    expect(deltas.A).toBe(0);
    expect(deltas.D).toBe(0);
  });

  it("a tie pushes; carryTies surfaces the carried stake", () => {
    const base = {
      players: ["A", "B"],
      grossScores: { A: 4, B: 4 },
      pops: { A: 0, B: 0 },
      actions: {},
      baseStake: 5,
    };
    const wash = settleHole({ ...base, carryTies: false });
    expect(wash.carryOut["A|B"]).toBe(0);
    const carry = settleHole({ ...base, carryTies: true });
    expect(carry.carryOut["A|B"]).toBe(5);
  });
});

describe("field hammer — settleRound", () => {
  it("threads carryTies and the ledger sums to 0", () => {
    const players = ["A", "B"];
    const round = settleRound({
      players,
      baseStake: 5,
      carryTies: true,
      holes: [
        { number: 1, grossScores: { A: 4, B: 4 }, pops: { A: 0, B: 0 }, actions: {} },
        // hole 2: pot $10 (base + carry), A wins, B hammered → B pays 10×2 = 20.
        { number: 2, grossScores: { A: 4, B: 5 }, pops: { A: 0, B: 0 }, actions: { B: "hammer" } },
      ],
    });
    expect(round.ledger.A).toBe(20);
    expect(round.ledger.B).toBe(-20);
    expect(sum(round.ledger)).toBe(0);
  });

  it("a full 4-player multi-hole round always sums to 0", () => {
    const players = ["A", "B", "C", "D"];
    const round = settleRound({
      players,
      baseStake: 5,
      carryTies: false,
      holes: [
        { number: 1, grossScores: { A: 4, B: 5, C: 4, D: 6 }, pops: noPops(players), actions: { A: "hammer", B: "forfeit" } },
        { number: 2, grossScores: { A: 5, B: 4, C: 6, D: 4 }, pops: noPops(players), actions: { C: "double" } },
      ],
    });
    expect(sum(round.ledger)).toBe(0);
  });
});

describe("field hammer — settleUp", () => {
  it("rolls a ledger into minimal who-pays-whom transactions", () => {
    const txns = settleUp({ A: 10, C: 10, B: -15, D: -5 });
    // B (−15) and D (−5) owe; A and C (+10) are owed.
    const net: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const t of txns) {
      net[t.from] -= t.amount;
      net[t.to] += t.amount;
    }
    expect(net).toEqual({ A: 10, C: 10, B: -15, D: -5 });
    expect(txns.length).toBeLessThanOrEqual(3);
  });
});
