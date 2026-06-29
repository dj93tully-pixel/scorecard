import { describe, it, expect } from "vitest";
import { settleHole, settleRound } from "./fieldHammer";

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
    // A-B fold A+5; A-C tie at ×4 → push (carries 20, owned by C — max stance);
    // A-D A wins ×2 → +10; B-C/B-D fold; C-D C wins ×4 → +20.
    expect(deltas.A).toBe(15);
    expect(deltas.B).toBe(-15);
    expect(deltas.C).toBe(25);
    expect(deltas.D).toBe(-25);
    expect(sum(deltas)).toBe(0); // no carry resolved this hole → still zero-sum
    expect(carryOut["A|C"]).toEqual({ amount: 20, hammerer: "C" });
  });

  it("a hammered tie carries (one-sided to the hammerer); a plain tie washes", () => {
    const base = {
      players: ["A", "B"],
      grossScores: { A: 4, B: 4 },
      pops: { A: 0, B: 0 },
      baseStake: 5,
    };
    expect(settleHole({ ...base, actions: { A: "hammer" } }).carryOut["A|B"]).toEqual({
      amount: 10,
      hammerer: "A",
    });
    expect(settleHole({ ...base, actions: {} }).carryOut["A|B"]).toBeUndefined();
  });

  it("the carry only affects the hammerer — the opponent never pays it", () => {
    // A hammered & tied last hole (carry $10 owned by A). This hole A loses to B.
    const aLoses = settleHole({
      players: ["A", "B"],
      grossScores: { A: 6, B: 4 },
      pops: { A: 0, B: 0 },
      actions: {},
      baseStake: 5,
      carryIn: { "A|B": { amount: 10, hammerer: "A" } },
    });
    expect(aLoses.deltas.A).toBe(-15); // base $5 to B + lost the $10 carry
    expect(aLoses.deltas.B).toBe(5); // only collects the base — NOT the carry

    // If B forfeits, B pays only the base; A still wins the carry it owns.
    const bForfeits = settleHole({
      players: ["A", "B"],
      grossScores: {},
      pops: { A: 0, B: 0 },
      actions: { B: "forfeit" },
      baseStake: 5,
      carryIn: { "A|B": { amount: 10, hammerer: "A" } },
    });
    expect(bForfeits.deltas.B).toBe(-5); // base only — not the hammered push amount
    expect(bForfeits.deltas.A).toBe(15); // base $5 + won its own $10 carry
  });

  it("an unscored hole preserves a carried bet (does not drop it)", () => {
    const { deltas, carryOut } = settleHole({
      players: ["A", "B"],
      grossScores: { A: 4 }, // B not scored yet
      pops: { A: 0, B: 0 },
      actions: {},
      baseStake: 5,
      carryIn: { "A|B": { amount: 10, hammerer: "A" } },
    });
    expect(deltas.A).toBe(0);
    expect(carryOut["A|B"]).toEqual({ amount: 10, hammerer: "A" });
  });
});

describe("sledgehammer — settleRound", () => {
  it("a hammered tie carries to the next played hole (skipping unplayed ones)", () => {
    const players = ["A", "B"];
    const round = settleRound({
      players,
      baseStake: 5,
      holes: [
        { number: 1, grossScores: { A: 4, B: 4 }, pops: { A: 0, B: 0 }, actions: { A: "hammer" } },
        { number: 5, grossScores: { A: 4, B: 5 }, pops: { A: 0, B: 0 }, actions: {} },
      ],
    });
    // hole 5: A wins base $5 from B, and wins its own $10 carry.
    expect(round.ledger.A).toBe(15);
    expect(round.ledger.B).toBe(-5); // opponent never paid the carry
  });
});
