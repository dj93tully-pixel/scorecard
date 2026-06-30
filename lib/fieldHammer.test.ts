import { describe, it, expect } from "vitest";
import { settleHole, settleRound } from "./fieldHammer";

const sum = (l: Record<string, number>) =>
  Object.values(l).reduce((a, b) => a + b, 0);
const noPops = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));
const none = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, false]));

describe("sledgehammer — settleHole", () => {
  const players = ["A", "B", "C", "D"];

  it("plain round-robin skins (no hammer, no forfeit)", () => {
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 5, C: 4, D: 6 },
      pops: noPops(players),
      forfeits: none(players),
      holeMult: 1,
      baseStake: 5,
    });
    expect(deltas.A).toBe(10);
    expect(deltas.B).toBe(-5);
    expect(deltas.C).toBe(10);
    expect(deltas.D).toBe(-15);
    expect(sum(deltas)).toBe(0);
  });

  it("a hole hammer doubles every pairing's bet", () => {
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 5, C: 4, D: 6 },
      pops: noPops(players),
      forfeits: none(players),
      holeMult: 2,
      baseStake: 5,
    });
    expect(deltas.A).toBe(20); // each delta is 2× the plain result
    expect(deltas.B).toBe(-10);
    expect(deltas.C).toBe(20);
    expect(deltas.D).toBe(-30);
    expect(sum(deltas)).toBe(0);
  });

  it("forfeit concedes every pairing for the base stake", () => {
    const { deltas } = settleHole({
      players,
      grossScores: { A: 4, B: 2, C: 4, D: 6 },
      pops: noPops(players),
      forfeits: { B: true },
      holeMult: 2, // hammer doesn't change what the forfeiter pays (base)
      baseStake: 5,
    });
    expect(deltas.B).toBe(-15); // base $5 to each of A, C, D
    expect(sum(deltas)).toBe(0);
  });

  it("a hammered tie carries; a plain tie washes", () => {
    const base = {
      players: ["A", "B"],
      grossScores: { A: 4, B: 4 },
      pops: { A: 0, B: 0 },
      forfeits: { A: false, B: false },
      baseStake: 5,
    };
    expect(settleHole({ ...base, holeMult: 2 }).carryOut["A|B"]).toBe(10);
    expect(settleHole({ ...base, holeMult: 1 }).carryOut["A|B"]).toBe(0);
  });

  it("a forfeiter never pays a carried bet (it washes)", () => {
    const { deltas, carryOut } = settleHole({
      players: ["A", "B"],
      grossScores: {},
      pops: { A: 0, B: 0 },
      forfeits: { A: false, B: true },
      holeMult: 1,
      baseStake: 5,
      carryIn: { "A|B": 10 },
    });
    expect(deltas.B).toBe(-5); // base only — not the carried $10
    expect(deltas.A).toBe(5);
    expect(carryOut["A|B"]).toBe(0); // carry washed
  });

  it("an unscored hole preserves a carried bet", () => {
    const { deltas, carryOut } = settleHole({
      players: ["A", "B"],
      grossScores: { A: 4 }, // B not scored yet
      pops: { A: 0, B: 0 },
      forfeits: { A: false, B: false },
      holeMult: 1,
      baseStake: 5,
      carryIn: { "A|B": 10 },
    });
    expect(deltas.A).toBe(0);
    expect(carryOut["A|B"]).toBe(10);
  });
});

describe("sledgehammer — settleRound", () => {
  it("a hammered tie carries to the next played hole; zero-sum", () => {
    const players = ["A", "B"];
    const round = settleRound({
      players,
      baseStake: 5,
      holes: [
        { number: 1, grossScores: { A: 4, B: 4 }, pops: { A: 0, B: 0 }, forfeits: { A: false, B: false }, holeMult: 2 },
        { number: 5, grossScores: { A: 4, B: 5 }, pops: { A: 0, B: 0 }, forfeits: { A: false, B: false }, holeMult: 1 },
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
      holes: [
        { number: 1, grossScores: { A: 4, B: 5, C: 4, D: 6 }, pops: noPops(players), forfeits: { B: true }, holeMult: 2 },
        { number: 2, grossScores: { A: 5, B: 4, C: 6, D: 4 }, pops: noPops(players), forfeits: none(players), holeMult: 1 },
      ],
    });
    expect(sum(round.ledger)).toBe(0);
  });
});
