import { describe, it, expect } from "vitest";
import { settleHole, settleRound, settleUp } from "./fieldHammer";

const sum = (l: Record<string, number>) =>
  Object.values(l).reduce((a, b) => a + b, 0);
const noPops = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));

describe("sledgehammer — settleHole", () => {
  const players = ["A", "B", "C", "D"];

  it("plain round-robin skins (no stances)", () => {
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 5, C: 4, D: 6 },
      pops: noPops(players),
      actions: {},
      baseStake: 5,
    });
    expect(deltas.A).toBe(10);
    expect(deltas.B).toBe(-5);
    expect(deltas.C).toBe(10);
    expect(deltas.D).toBe(-15);
    expect(sum(deltas)).toBe(0);
  });

  it("a hammer doubles the pairing's bet for win AND loss", () => {
    const lose = settleHole({
      players: ["A", "B"],
      grossScores: { A: 6, B: 4 },
      pops: { A: 0, B: 0 },
      actions: { A: "hammer" },
      baseStake: 5,
    });
    expect(lose.deltas.A).toBe(-10); // A loses the doubled bet

    const win = settleHole({
      players: ["A", "B"],
      grossScores: { A: 4, B: 6 },
      pops: { A: 0, B: 0 },
      actions: { A: "hammer" },
      baseStake: 5,
    });
    expect(win.deltas.A).toBe(10); // A wins the doubled bet
  });

  it("double hammer is ×4", () => {
    const { deltas } = settleHole({
      players: ["A", "B"],
      grossScores: { A: 4, B: 6 },
      pops: { A: 0, B: 0 },
      actions: { A: "double" },
      baseStake: 5,
    });
    expect(deltas.A).toBe(20);
    expect(deltas.B).toBe(-20);
  });

  it("forfeit concedes every pairing for the base stake", () => {
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 2, C: 4, D: 6 },
      pops: noPops(players),
      actions: { B: "forfeit" },
      baseStake: 5,
    });
    expect(deltas.B).toBe(-15); // pays $5 to each of A, C, D regardless of score
    expect(deltas.A).toBe(10);
    expect(deltas.C).toBe(10);
    expect(deltas.D).toBe(-5);
    expect(sum(deltas)).toBe(0);
  });

  it("worked example: A hammer, B forfeit, C double (A4 B5 C4 D6, $5)", () => {
    const { deltas, carryOut } = settleHole({
      players,
      grossScores: { A: 4, B: 5, C: 4, D: 6 },
      pops: noPops(players),
      actions: { A: "hammer", B: "forfeit", C: "double" },
      baseStake: 5,
    });
    // A-B fold A+5; A-C tie at ×4 → push (carries 20); A-D A wins ×2 → +10;
    // B-C/B-D fold; C-D C wins ×4 → +20.
    expect(deltas.A).toBe(15);
    expect(deltas.B).toBe(-15);
    expect(deltas.C).toBe(25);
    expect(deltas.D).toBe(-25);
    expect(sum(deltas)).toBe(0);
    expect(carryOut["A|C"]).toBe(20); // the hammered tie carries
  });

  it("a hammered tie carries the doubled bet; a plain tie washes (unless carryTies)", () => {
    const base = {
      players: ["A", "B"],
      grossScores: { A: 4, B: 4 },
      pops: { A: 0, B: 0 },
      baseStake: 5,
    };
    expect(settleHole({ ...base, actions: { A: "hammer" } }).carryOut["A|B"]).toBe(10);
    expect(settleHole({ ...base, actions: {} }).carryOut["A|B"]).toBe(0);
    expect(settleHole({ ...base, actions: {}, carryTies: true }).carryOut["A|B"]).toBe(5);
  });

  it("an unscored hole preserves a carried bet (does not drop it)", () => {
    const { deltas, carryOut } = settleHole({
      players: ["A", "B"],
      grossScores: { A: 4 }, // B not scored yet
      pops: { A: 0, B: 0 },
      actions: {},
      baseStake: 5,
      carryIn: { "A|B": 10 },
    });
    expect(deltas.A).toBe(0);
    expect(carryOut["A|B"]).toBe(10); // carry survives to the next hole
  });
});

describe("sledgehammer — settleRound", () => {
  it("a hammered tie carries to the next played hole", () => {
    const players = ["A", "B"];
    const round = settleRound({
      players,
      baseStake: 5,
      carryTies: false,
      holes: [
        // hole 1: A hammers, tie → doubled bet ($10) carries.
        { number: 1, grossScores: { A: 4, B: 4 }, pops: { A: 0, B: 0 }, actions: { A: "hammer" } },
        // hole 3 unscored between (preserved); hole 5 resolves with the carry.
        { number: 5, grossScores: { A: 4, B: 5 }, pops: { A: 0, B: 0 }, actions: {} },
      ],
    });
    // hole 5 stake = base $5 + carried $10 = $15; A wins.
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
        { number: 1, grossScores: { A: 4, B: 5, C: 4, D: 6 }, pops: noPops(players), actions: { A: "hammer", B: "forfeit" } },
        { number: 2, grossScores: { A: 5, B: 4, C: 6, D: 4 }, pops: noPops(players), actions: { C: "double" } },
      ],
    });
    expect(sum(round.ledger)).toBe(0);
  });
});

describe("sledgehammer — settleUp", () => {
  it("rolls a ledger into minimal who-pays-whom transactions", () => {
    const txns = settleUp({ A: 15, C: 25, B: -15, D: -25 });
    const net: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const t of txns) {
      net[t.from] -= t.amount;
      net[t.to] += t.amount;
    }
    expect(net).toEqual({ A: 15, C: 25, B: -15, D: -25 });
    expect(txns.length).toBeLessThanOrEqual(3);
  });
});
