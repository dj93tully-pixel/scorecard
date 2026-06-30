import { describe, it, expect } from "vitest";
import {
  Course,
  Player,
  Round,
  HoleEntry,
  RoundSettings,
  DEFAULT_SETTINGS,
} from "./wolf";
import { computeJunk } from "./junk";

// Course with a couple of par 3s (holes 3 & 7) for greenie tests.
function course(): Course {
  return {
    name: "Junk Links",
    holes: Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: i + 1 === 3 || i + 1 === 7 ? 3 : 4,
      strokeIndex: i + 1,
    })),
  };
}

function scratch(ids: string[]): Player[] {
  return ids.map((id) => ({ id, name: id.toUpperCase(), handicap: 0 }));
}

function round(
  players: Player[],
  entries: HoleEntry[],
  junk: RoundSettings["junk"]
): Round {
  return {
    course: course(),
    players,
    teeOrder: players.map((p) => p.id),
    settings: { ...DEFAULT_SETTINGS, junk },
    entries,
    gameType: "skins",
  };
}

const sum = (l: Record<string, number>) => Object.values(l).reduce((a, b) => a + b, 0);
const e = (hole: number, gross: Record<string, number>, j?: Record<string, string[]>): HoleEntry => ({
  hole,
  wolfId: "",
  mode: "2v2",
  grossScores: gross,
  junk: j,
});

describe("junk — birdie/eagle pot", () => {
  it("a birdie collects the stake from everyone who didn't", () => {
    const r = round(
      scratch(["a", "b", "c", "d"]),
      [e(1, { a: 3, b: 4, c: 4, d: 5 })], // a birdies a par 4
      [{ id: "birdie", value: 2 }]
    );
    const { ledger } = computeJunk(r);
    expect(ledger.a).toBe(6); // 2 × 3 non-makers
    expect(ledger.b).toBe(-2);
    expect(ledger.d).toBe(-2);
    expect(sum(ledger)).toBe(0);
  });

  it("eagle pays the eagle pot only, not the birdie pot", () => {
    const r = round(
      scratch(["a", "b"]),
      [e(1, { a: 2, b: 4 })], // a eagles (−2)
      [
        { id: "birdie", value: 2 },
        { id: "eagle", value: 5 },
      ]
    );
    const { ledger, bets } = computeJunk(r);
    const birdie = bets.find((x) => x.id === "birdie")!;
    const eagle = bets.find((x) => x.id === "eagle")!;
    expect(birdie.total.a).toBe(0); // diff −2 is not a birdie
    expect(eagle.total.a).toBe(5);
    expect(ledger.a).toBe(5);
    expect(sum(ledger)).toBe(0);
  });

  it("washes when everyone earns it", () => {
    const r = round(
      scratch(["a", "b"]),
      [e(1, { a: 3, b: 3 })],
      [{ id: "birdie", value: 2 }]
    );
    expect(computeJunk(r).ledger.a).toBe(0);
  });
});

describe("junk — greenie carry", () => {
  it("the lone winner collects from the field", () => {
    const r = round(
      scratch(["a", "b", "c", "d"]),
      [e(3, { a: 3, b: 3, c: 3, d: 3 }, { a: ["greenie"] })], // par 3, a wins
      [{ id: "greenie", value: 2 }]
    );
    const { ledger } = computeJunk(r);
    expect(ledger.a).toBe(6); // 2 × 3
    expect(ledger.b).toBe(-2);
    expect(sum(ledger)).toBe(0);
  });

  it("an unclaimed par 3 carries and doubles the next greenie", () => {
    const r = round(
      scratch(["a", "b", "c", "d"]),
      [
        e(3, { a: 3, b: 3, c: 3, d: 3 }), // par 3, nobody tapped → carry
        e(7, { a: 3, b: 3, c: 3, d: 3 }, { a: ["greenie"] }), // par 3, a wins at ×2
      ],
      [{ id: "greenie", value: 2 }]
    );
    const { ledger } = computeJunk(r);
    expect(ledger.a).toBe(12); // 2 × 2 × 3
    expect(ledger.b).toBe(-4);
    expect(sum(ledger)).toBe(0);
  });
});

describe("junk — snake holder", () => {
  it("only the last 3-putter pays everyone", () => {
    const r = round(
      scratch(["a", "b", "c"]),
      [
        e(5, { a: 4, b: 4, c: 4 }, { b: ["snake"] }), // b 3-putts...
        e(9, { a: 4, b: 4, c: 4 }, { a: ["snake"] }), // ...then a does, later → a holds it
      ],
      [{ id: "snake", value: 2 }]
    );
    const { ledger } = computeJunk(r);
    expect(ledger.a).toBe(-4); // pays b and c
    expect(ledger.b).toBe(2);
    expect(ledger.c).toBe(2);
    expect(sum(ledger)).toBe(0);
  });
});
