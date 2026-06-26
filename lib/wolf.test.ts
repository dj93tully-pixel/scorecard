import { describe, it, expect } from "vitest";
import {
  Course,
  Player,
  Round,
  RoundSettings,
  DEFAULT_SETTINGS,
  strokesReceived,
  popsForHole,
  computePops,
  computeRound,
  ledgerSum,
  defaultWolfForHole,
} from "./wolf";

// ── Test fixtures ──────────────────────────────────────────────────────────

/** Standard 18-hole course; stroke index = hole number for easy reasoning. */
function makeCourse(): Course {
  return {
    name: "Test Links",
    holes: Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: 4,
      strokeIndex: i + 1,
    })),
  };
}

const P = {
  a: { id: "a", name: "Alice", handicap: 4 },
  b: { id: "b", name: "Bob", handicap: 10 },
  c: { id: "c", name: "Cara", handicap: 16 },
  d: { id: "d", name: "Dan", handicap: 22 },
} as const;

function fourPlayers(): Player[] {
  return [P.a, P.b, P.c, P.d];
}

function makeRound(
  entries: Round["entries"],
  settings: Partial<RoundSettings> = {}
): Round {
  const players = fourPlayers();
  return {
    course: makeCourse(),
    players,
    teeOrder: players.map((p) => p.id),
    settings: { ...DEFAULT_SETTINGS, ...settings },
    entries,
  };
}

// ── Pops: offLow ───────────────────────────────────────────────────────────

describe("pops — offLow", () => {
  it("subtracts the lowest handicap from everyone", () => {
    const players = fourPlayers(); // handicaps 4,10,16,22 → low = 4
    const r = strokesReceived(players, "offLow");
    expect(r.a).toBe(0);
    expect(r.b).toBe(6);
    expect(r.c).toBe(12);
    expect(r.d).toBe(18);
  });

  it("gives a pop on holes with SI <= strokes received", () => {
    // Bob receives 6 → pops on stroke index 1..6 only.
    expect(popsForHole(6, 1)).toBe(1);
    expect(popsForHole(6, 6)).toBe(1);
    expect(popsForHole(6, 7)).toBe(0);
    expect(popsForHole(6, 18)).toBe(0);
  });

  it("never gives negative pops", () => {
    expect(popsForHole(0, 1)).toBe(0);
    expect(popsForHole(-5, 1)).toBe(0);
  });

  it("computes the full grid relative to the low handicap", () => {
    const grid = computePops(fourPlayers(), makeCourse(), "offLow");
    // Alice is low → no pops anywhere.
    expect(grid.a[1]).toBe(0);
    expect(grid.a[18]).toBe(0);
    // Dan receives 18 → exactly one pop on every hole.
    for (let h = 1; h <= 18; h++) expect(grid.d[h]).toBe(1);
  });
});

// ── Pops: >18 handicap double-pops ─────────────────────────────────────────

describe("pops — double pops for >18 strokes received", () => {
  it("gives 2 pops on the lowest stroke-index holes", () => {
    // received = 22 → base 1 everywhere, extra on SI 1..4.
    expect(popsForHole(22, 1)).toBe(2);
    expect(popsForHole(22, 4)).toBe(2);
    expect(popsForHole(22, 5)).toBe(1);
    expect(popsForHole(22, 18)).toBe(1);
  });

  it("produces double pops in a round where low handicap is 0", () => {
    const players: Player[] = [
      { id: "a", name: "Scratch", handicap: 0 },
      { id: "b", name: "High", handicap: 22 },
    ];
    const grid = computePops(players, makeCourse(), "offLow");
    // High receives 22 → 2 pops on SI 1..4, 1 pop on SI 5..18.
    expect(grid.b[1]).toBe(2);
    expect(grid.b[4]).toBe(2);
    expect(grid.b[5]).toBe(1);
    expect(grid.b[18]).toBe(1);
  });
});

// ── Pops: full mode ────────────────────────────────────────────────────────

describe("pops — full mode", () => {
  it("gives each player their full handicap allotment", () => {
    const players = fourPlayers();
    const r = strokesReceived(players, "full");
    expect(r.a).toBe(4);
    expect(r.b).toBe(10);
    expect(r.c).toBe(16);
    expect(r.d).toBe(22);
  });

  it("low-handicap player still gets pops on the hardest holes", () => {
    const grid = computePops(fourPlayers(), makeCourse(), "full");
    // Alice handicap 4 → pops on SI 1..4 only.
    expect(grid.a[1]).toBe(1);
    expect(grid.a[4]).toBe(1);
    expect(grid.a[5]).toBe(0);
  });
});

// ── Pops: direct mode ──────────────────────────────────────────────────────

describe("pops — direct mode", () => {
  it("uses each player's pops value verbatim, ignoring handicaps", () => {
    const players: Player[] = [
      { id: "a", name: "A", handicap: 99, pops: 0 },
      { id: "b", name: "B", handicap: 0, pops: 6 },
    ];
    const r = strokesReceived(players, "direct");
    expect(r.a).toBe(0);
    expect(r.b).toBe(6);
  });

  it("spreads direct pops across holes by stroke index, with double pops > 18", () => {
    const players: Player[] = [
      { id: "a", name: "A", handicap: 0, pops: 0 },
      { id: "b", name: "B", handicap: 0, pops: 20 },
    ];
    const grid = computePops(players, makeCourse(), "direct");
    expect(grid.a[1]).toBe(0);
    // 20 pops → 1 everywhere, +1 on SI 1..2
    expect(grid.b[1]).toBe(2);
    expect(grid.b[2]).toBe(2);
    expect(grid.b[3]).toBe(1);
    expect(grid.b[18]).toBe(1);
  });

  it("treats a missing pops value as 0", () => {
    const players: Player[] = [{ id: "a", name: "A", handicap: 12 }];
    const r = strokesReceived(players, "direct");
    expect(r.a).toBe(0);
  });
});

// ── Money: 2v2 ─────────────────────────────────────────────────────────────

describe("money — 2v2", () => {
  it("wolf+partner win: winners +stake, losers -stake, sums to 0", () => {
    // Hole 18 (SI 18) → nobody pops except Dan (receives 18 → 1 pop).
    // Wolf = a, partner = b. Team A best vs Team B best.
    const round = makeRound([
      {
        hole: 18,
        wolfId: "a",
        mode: "2v2",
        partnerId: "b",
        grossScores: { a: 4, b: 4, c: 6, d: 6 }, // d nets 5; teamB best = 5; teamA best = 4
      },
    ]);
    const { ledger } = computeRound(round);
    expect(ledger.a).toBe(5);
    expect(ledger.b).toBe(5);
    expect(ledger.c).toBe(-5);
    expect(ledger.d).toBe(-5);
    expect(ledgerSum(ledger)).toBe(0);
  });

  it("wolf+partner lose: net pops can flip the result", () => {
    const round = makeRound([
      {
        hole: 18,
        wolfId: "a",
        mode: "2v2",
        partnerId: "b",
        grossScores: { a: 5, b: 5, c: 5, d: 5 }, // d nets 4 (pop) → teamB best 4 < teamA best 5
      },
    ]);
    const { ledger, results } = computeRound(round);
    expect(results[0].winner).toBe("B");
    expect(ledger.a).toBe(-5);
    expect(ledger.b).toBe(-5);
    expect(ledger.c).toBe(5);
    expect(ledger.d).toBe(5);
    expect(ledgerSum(ledger)).toBe(0);
  });

  it("tie pushes with no money when carryover is off", () => {
    const round = makeRound([
      {
        hole: 18,
        wolfId: "a",
        mode: "2v2",
        partnerId: "b",
        grossScores: { a: 4, b: 9, c: 4, d: 9 }, // both teams best net 4
      },
    ]);
    const { ledger, results } = computeRound(round);
    expect(results[0].winner).toBe("push");
    expect(ledgerSum(ledger)).toBe(0);
    expect(ledger.a).toBe(0);
    expect(ledger.c).toBe(0);
  });
});

// ── Money: carryover ───────────────────────────────────────────────────────

describe("money — carryover", () => {
  it("rolls a pushed stake into the next decided hole", () => {
    const round = makeRound(
      [
        {
          hole: 17, // SI 17 → only Dan pops
          wolfId: "a",
          mode: "2v2",
          partnerId: "b",
          grossScores: { a: 4, b: 9, c: 4, d: 9 }, // push (both best net 4)
        },
        {
          hole: 18,
          wolfId: "a",
          mode: "2v2",
          partnerId: "b",
          grossScores: { a: 4, b: 4, c: 6, d: 6 }, // team A wins
        },
      ],
      { carryover: true, stake: 5 }
    );
    const { results, ledger } = computeRound(round);
    expect(results[0].winner).toBe("push");
    expect(results[0].carriedToNext).toBe(5);
    // Hole 18 plays for stake 5 + carried 5 = 10.
    expect(results[1].stakeApplied).toBe(10);
    expect(ledger.a).toBe(10);
    expect(ledger.b).toBe(10);
    expect(ledger.c).toBe(-10);
    expect(ledger.d).toBe(-10);
    expect(ledgerSum(ledger)).toBe(0);
  });
});

// ── Money: lone wolf ───────────────────────────────────────────────────────

describe("money — lone wolf", () => {
  it("win: wolf +3*mult*stake, each opponent -mult*stake", () => {
    const round = makeRound([
      {
        hole: 18,
        wolfId: "a",
        mode: "lone",
        grossScores: { a: 3, b: 4, c: 4, d: 5 }, // d nets 4; field best 4; wolf 3 wins
      },
    ]);
    const { ledger, results } = computeRound(round);
    expect(results[0].winner).toBe("A");
    expect(ledger.a).toBe(15); // 3 * 1 * 5
    expect(ledger.b).toBe(-5);
    expect(ledger.c).toBe(-5);
    expect(ledger.d).toBe(-5);
    expect(ledgerSum(ledger)).toBe(0);
  });

  it("loss: wolf -3*mult*stake, each opponent +mult*stake", () => {
    const round = makeRound([
      {
        hole: 18,
        wolfId: "a",
        mode: "lone",
        grossScores: { a: 6, b: 4, c: 7, d: 7 }, // field best 4 < wolf 6
      },
    ]);
    const { ledger, results } = computeRound(round);
    expect(results[0].winner).toBe("B");
    expect(ledger.a).toBe(-15);
    expect(ledger.b).toBe(5);
    expect(ledger.c).toBe(5);
    expect(ledger.d).toBe(5);
    expect(ledgerSum(ledger)).toBe(0);
  });
});

// ── Money: blind wolf ──────────────────────────────────────────────────────

describe("money — blind wolf", () => {
  it("applies the blind multiplier on a win", () => {
    const round = makeRound(
      [
        {
          hole: 18,
          wolfId: "a",
          mode: "blind",
          grossScores: { a: 3, b: 4, c: 4, d: 5 },
        },
      ],
      { stake: 5, blindMult: 2 }
    );
    const { ledger, results } = computeRound(round);
    expect(results[0].winner).toBe("A");
    expect(ledger.a).toBe(30); // 3 * 2 * 5
    expect(ledger.b).toBe(-10);
    expect(ledger.c).toBe(-10);
    expect(ledger.d).toBe(-10);
    expect(ledgerSum(ledger)).toBe(0);
  });
});

// ── Wolf rotation helper ───────────────────────────────────────────────────

describe("defaultWolfForHole", () => {
  it("rotates through the tee order", () => {
    const order = ["a", "b", "c", "d"];
    expect(defaultWolfForHole(order, 1)).toBe("a");
    expect(defaultWolfForHole(order, 4)).toBe("d");
    expect(defaultWolfForHole(order, 5)).toBe("a");
    expect(defaultWolfForHole(order, 18)).toBe("b");
  });
});

// ── Full 18-hole round: ledger must sum to exactly 0 ───────────────────────

describe("full 18-hole round", () => {
  it("ledger sums to exactly 0 across a mixed round", () => {
    const wolves = ["a", "b", "c", "d"];
    const modes: Array<"2v2" | "lone" | "blind"> = ["2v2", "lone", "blind"];
    const entries: Round["entries"] = [];
    for (let h = 1; h <= 18; h++) {
      const wolfId = wolves[(h - 1) % 4];
      const mode = modes[h % 3];
      const others = wolves.filter((w) => w !== wolfId);
      const entry: Round["entries"][number] = {
        hole: h,
        wolfId,
        mode,
        grossScores: {
          a: 3 + ((h * 1) % 4),
          b: 3 + ((h * 2) % 4),
          c: 3 + ((h * 3) % 4),
          d: 3 + ((h * 5) % 4),
        },
      };
      if (mode === "2v2") entry.partnerId = others[h % others.length];
      entries.push(entry);
    }
    const round = makeRound(entries, { carryover: true });
    const { ledger, results } = computeRound(round);
    expect(results).toHaveLength(18);
    expect(ledgerSum(ledger)).toBe(0);
    // Every individual hole's deltas also sum to 0.
    for (const res of results) {
      const sum = Object.values(res.deltas).reduce((x, y) => x + y, 0);
      expect(sum).toBe(0);
    }
  });
});
