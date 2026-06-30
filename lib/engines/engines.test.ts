import { describe, it, expect } from "vitest";
import {
  Course,
  Player,
  Round,
  RoundSettings,
  DEFAULT_SETTINGS,
} from "../wolf";
import { computeSkins } from "./skins";
import { computeBestBall } from "./bestball";
import { computeVegas } from "./vegas";
import { computeSixes } from "./sixes";
import { computeStroke } from "./strokeplay";
import { computeStableford, computeModifiedStableford } from "./stableford";
import { computeElevens } from "./elevens";
import { computeNassau } from "./nassau";
import { withPresses, pressRange, combinedHoleResults } from "./press";
import { carryByHole } from "../carry";

// ── Fixtures ────────────────────────────────────────────────────────────────

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

/** Scratch players so net === gross and pops are 0 everywhere. */
function scratch(ids: string[]): Player[] {
  return ids.map((id) => ({ id, name: id.toUpperCase(), handicap: 0 }));
}

function makeRound(
  gameType: Round["gameType"],
  players: Player[],
  entries: Round["entries"],
  settings: Partial<RoundSettings> = {}
): Round {
  return {
    course: makeCourse(),
    players,
    teeOrder: players.map((p) => p.id),
    settings: { ...DEFAULT_SETTINGS, ...settings },
    entries,
    gameType,
  };
}

const sum = (l: Record<string, number>) =>
  Object.values(l).reduce((a, b) => a + b, 0);

// ── Skins ─────────────────────────────────────────────────────────────────

describe("skins", () => {
  it("lone low net wins the hole; zero-sum", () => {
    const round = makeRound(
      "skins",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 5, d: 5 } }],
      { skinValue: 2 }
    );
    const { ledger, stats } = computeSkins(round);
    expect(ledger.a).toBe(6); // 2 × 1 skin × 3 opponents
    expect(ledger.b).toBe(-2);
    expect(ledger.c).toBe(-2);
    expect(ledger.d).toBe(-2);
    expect(stats.a.skins).toBe(1);
    expect(sum(ledger)).toBe(0);
  });

  it("ties carry the skins to the next decided hole", () => {
    const round = makeRound(
      "skins",
      scratch(["a", "b", "c", "d"]),
      [
        { hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 4, c: 4, d: 4 } }, // tie → carry
        { hole: 2, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 4, d: 4 } }, // a wins 2
      ],
      { skinValue: 2, carryover: true }
    );
    const { ledger, stats } = computeSkins(round);
    expect(stats.a.skins).toBe(2);
    expect(ledger.a).toBe(12); // 2 × 2 skins × 3 opponents
    expect(ledger.b).toBe(-4);
    expect(sum(ledger)).toBe(0);
  });
});

// ── Best Ball ──────────────────────────────────────────────────────────────

describe("best ball", () => {
  it("2v2: team best net wins the hole", () => {
    const round = makeRound(
      "bestball",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 18, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 5, c: 5, d: 6 } }],
      { stake: 5, teams: { a: "A", b: "A", c: "B", d: "B" } }
    );
    const { ledger } = computeBestBall(round);
    expect(ledger.a).toBe(5);
    expect(ledger.b).toBe(5);
    expect(ledger.c).toBe(-5);
    expect(ledger.d).toBe(-5);
    expect(sum(ledger)).toBe(0);
  });

  it("uneven 2v3 stays zero-sum with a separate team stake", () => {
    const teams = { a: "A", b: "A", c: "B", d: "B", e: "B" } as const;
    // Team A wins: field $2 each (×3 = 6) split among 2 → +3 each.
    const winA = makeRound(
      "bestball",
      scratch(["a", "b", "c", "d", "e"]),
      [
        {
          hole: 18,
          wolfId: "",
          mode: "2v2",
          grossScores: { a: 4, b: 5, c: 5, d: 5, e: 5 },
        },
      ],
      { stake: 2, wolfStake: 3, teams: { ...teams } }
    );
    const a = computeBestBall(winA).ledger;
    expect(a.a).toBe(3);
    expect(a.b).toBe(3);
    expect(a.c).toBe(-2);
    expect(a.d).toBe(-2);
    expect(a.e).toBe(-2);
    expect(sum(a)).toBe(0);

    // Team B wins: wolf $3 each (×2 = 6) split among 3 → +2 each.
    const winB = makeRound(
      "bestball",
      scratch(["a", "b", "c", "d", "e"]),
      [
        {
          hole: 18,
          wolfId: "",
          mode: "2v2",
          grossScores: { a: 5, b: 5, c: 4, d: 5, e: 5 },
        },
      ],
      { stake: 2, wolfStake: 3, teams: { ...teams } }
    );
    const b = computeBestBall(winB).ledger;
    expect(b.c).toBe(2);
    expect(b.d).toBe(2);
    expect(b.e).toBe(2);
    expect(b.a).toBe(-3);
    expect(b.b).toBe(-3);
    expect(sum(b)).toBe(0);
  });
});

// ── Vegas ────────────────────────────────────────────────────────────────

describe("vegas", () => {
  const teams = { a: "A", b: "A", c: "B", d: "B" } as const;

  it("low-digit-first numbers; difference × value, zero-sum", () => {
    const round = makeRound(
      "vegas",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 18, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 5, c: 4, d: 6 } }],
      { pointValue: 1, birdieFlip: true, teams: { ...teams } }
    );
    // A = 45, B = 46 → A wins by 1.
    const { ledger } = computeVegas(round);
    expect(ledger.a).toBe(1);
    expect(ledger.b).toBe(1);
    expect(ledger.c).toBe(-1);
    expect(ledger.d).toBe(-1);
    expect(sum(ledger)).toBe(0);
  });

  it("opponent birdie flips your number high-first", () => {
    // A birdies (3). With flip on, B's 4&5 becomes 54 instead of 45.
    const flip = makeRound(
      "vegas",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 4, d: 5 } }],
      { pointValue: 1, birdieFlip: true, teams: { ...teams } }
    );
    // A = 34, B = 54 → A wins by 20.
    expect(computeVegas(flip).ledger.a).toBe(20);

    const noFlip = makeRound(
      "vegas",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 4, d: 5 } }],
      { pointValue: 1, birdieFlip: false, teams: { ...teams } }
    );
    // A = 34, B = 45 → A wins by 11.
    expect(computeVegas(noFlip).ledger.a).toBe(11);
  });
});

// ── Six-Six-Six ──────────────────────────────────────────────────────────

// ── Stroke play ──────────────────────────────────────────────────────────────

describe("stroke play", () => {
  it("pays the net-stroke difference vs the field each hole; zero-sum", () => {
    const round = makeRound(
      "stroke",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 18, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 4, d: 5 } }],
      { stake: 1 }
    );
    const { ledger, stats } = computeStroke(round);
    expect(ledger.a).toBe(4); // (4-3)+(4-3)+(5-3)
    expect(ledger.b).toBe(0);
    expect(ledger.c).toBe(0);
    expect(ledger.d).toBe(-4);
    expect(stats.a.strokes).toBe(3); // net total
    expect(sum(ledger)).toBe(0);
  });

  it("scales by the per-stroke value", () => {
    const round = makeRound(
      "stroke",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 18, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 4, d: 5 } }],
      { stake: 2 }
    );
    const { ledger } = computeStroke(round);
    expect(ledger.a).toBe(8); // 4 strokes × $2
    expect(ledger.d).toBe(-8);
    expect(sum(ledger)).toBe(0);
  });
});

// ── Stableford ────────────────────────────────────────────────────────────────

describe("stableford", () => {
  // Par 4 everywhere, scratch → net = gross. a birdie(3), b/c par(2), d bogey(1).
  const entries = [
    { hole: 18, wolfId: "", mode: "2v2" as const, grossScores: { a: 3, b: 4, c: 4, d: 5 } },
  ];

  it("pays the points difference vs the field; zero-sum", () => {
    const round = makeRound("stableford", scratch(["a", "b", "c", "d"]), entries, { stake: 1 });
    const { ledger, stats } = computeStableford(round);
    expect(stats.a.points).toBe(3); // birdie
    expect(stats.d.points).toBe(1); // bogey
    expect(ledger.a).toBe(4); // (3-2)+(3-2)+(3-1)
    expect(ledger.b).toBe(0);
    expect(ledger.d).toBe(-4);
    expect(sum(ledger)).toBe(0);
  });

  it("scales by the per-point value", () => {
    const round = makeRound("stableford", scratch(["a", "b", "c", "d"]), entries, { stake: 2 });
    const { ledger } = computeStableford(round);
    expect(ledger.a).toBe(8);
    expect(ledger.d).toBe(-8);
    expect(sum(ledger)).toBe(0);
  });

  it("caps a double bogey or worse at 0 points", () => {
    const round = makeRound(
      "stableford",
      scratch(["a", "b"]),
      [{ hole: 18, wolfId: "", mode: "2v2", grossScores: { a: 6, b: 7 } }], // both ≥ double bogey
      { stake: 1 }
    );
    const { ledger, stats } = computeStableford(round);
    expect(stats.a.points).toBe(0);
    expect(stats.b.points).toBe(0);
    expect(sum(ledger)).toBe(0);
  });
});

describe("modified stableford", () => {
  it("uses the PGA point table (eagle 5, birdie 2, bogey −1, double+ −3)", () => {
    const round = makeRound(
      "modifiedstableford",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 18, wolfId: "", mode: "2v2", grossScores: { a: 2, b: 3, c: 5, d: 6 } }],
      { stake: 1 }
    );
    const { ledger, stats } = computeModifiedStableford(round);
    expect(stats.a.points).toBe(5); // eagle
    expect(stats.b.points).toBe(2); // birdie
    expect(stats.c.points).toBe(-1); // bogey
    expect(stats.d.points).toBe(-3); // double bogey
    // a: (5-2)+(5-(-1))+(5-(-3)) = 3+6+8 = 17
    expect(ledger.a).toBe(17);
    expect(sum(ledger)).toBe(0);
  });
});

// ── 11s ──────────────────────────────────────────────────────────────────────

describe("elevens", () => {
  const allPick = { a: true, b: true, c: true, d: true } as const;

  it("low selected total wins, paid stroke-play style on the totals", () => {
    const round = makeRound(
      "elevens",
      scratch(["a", "b", "c", "d"]),
      [
        { hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 4, d: 5 }, elevenPicks: { ...allPick } },
        { hole: 2, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 4, c: 5, d: 5 }, elevenPicks: { ...allPick } },
      ],
      { stake: 1 }
    );
    // Par 4 each. To-par totals: a -1, b 0, c +1, d +2 → money = Σ(other − self).
    const { ledger, stats } = computeElevens(round);
    expect(stats.a.score).toBe(-1);
    expect(stats.a.picks).toBe(2);
    expect(ledger.a).toBe(6); // (0-(-1))+(1-(-1))+(2-(-1))
    expect(ledger.b).toBe(2);
    expect(ledger.c).toBe(-2);
    expect(ledger.d).toBe(-6);
    expect(sum(ledger)).toBe(0);
  });

  it("an unchecked hole adds nothing to that player's total", () => {
    const round = makeRound(
      "elevens",
      scratch(["a", "b", "c", "d"]),
      [
        // a does NOT count hole 1; everyone else does (par 4, they each bogey).
        {
          hole: 1,
          wolfId: "",
          mode: "2v2",
          grossScores: { a: 9, b: 5, c: 5, d: 5 },
          elevenPicks: { b: true, c: true, d: true },
        },
      ],
      { stake: 1 }
    );
    const { ledger, stats } = computeElevens(round);
    expect(stats.a.score).toBe(0); // a's 9 doesn't count — a didn't check it
    expect(stats.a.picks).toBe(0);
    // a's counted to-par is 0 (best), so a is up; b/c/d each carry +1 over par.
    expect(ledger.a).toBe(3); // (1-0)×3
    expect(sum(ledger)).toBe(0);
  });

  it("a hole nobody counts moves no money", () => {
    const round = makeRound(
      "elevens",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 5, d: 6 } }],
      { stake: 1 }
    );
    const { ledger } = computeElevens(round);
    expect(Object.values(ledger).every((v) => v === 0)).toBe(true);
  });
});

// ── Nassau ─────────────────────────────────────────────────────────────────

describe("nassau", () => {
  // 2-player, par-4 course, scratch (net === gross).
  const headsUp = (score: (hole: number) => { a: number; b: number }) =>
    Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      wolfId: "",
      mode: "2v2" as const,
      grossScores: score(i + 1),
    }));

  it("front, back, and overall settle as three separate bets", () => {
    // a sweeps the front (wins holes 1–5), b takes the back (wins 10–13),
    // and a edges the overall 18 (5 holes to 4).
    const entries = headsUp((h) => {
      if (h <= 5) return { a: 3, b: 4 }; // a wins
      if (h >= 10 && h <= 13) return { a: 4, b: 3 }; // b wins
      return { a: 4, b: 4 }; // halve
    });
    const round = makeRound("nassau", scratch(["a", "b"]), entries, {
      stake: 2,
      nassauFormat: "robin",
    });
    const { ledger, stats } = computeNassau(round);
    expect(stats.a.front).toBe(2); // a wins the front
    expect(stats.a.back).toBe(-2); // a loses the back
    expect(stats.a.overall).toBe(2); // a wins the overall
    expect(ledger.a).toBe(2); // +2 −2 +2
    expect(ledger.b).toBe(-2);
    expect(sum(ledger)).toBe(0);
  });

  it("a clean sweep wins all three bets", () => {
    const entries = headsUp(() => ({ a: 4, b: 5 })); // a wins every hole
    const round = makeRound("nassau", scratch(["a", "b"]), entries, {
      stake: 2,
      nassauFormat: "robin",
    });
    const { ledger, stats } = computeNassau(round);
    expect(stats.a.front).toBe(2);
    expect(stats.a.back).toBe(2);
    expect(stats.a.overall).toBe(2);
    expect(ledger.a).toBe(6); // all three bets
    expect(ledger.b).toBe(-6);
  });

  it("an all-square segment pushes (no money)", () => {
    // Identical scores everywhere → every bet halves.
    const entries = headsUp(() => ({ a: 4, b: 4 }));
    const round = makeRound("nassau", scratch(["a", "b"]), entries, {
      stake: 2,
      nassauFormat: "robin",
    });
    const { ledger } = computeNassau(round);
    expect(ledger.a).toBe(0);
    expect(ledger.b).toBe(0);
  });

  it("round-robin across 4 players stays zero-sum", () => {
    const entries = Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      wolfId: "",
      mode: "2v2" as const,
      grossScores: { a: 4, b: 5, c: 4, d: 6 },
    }));
    const round = makeRound("nassau", scratch(["a", "b", "c", "d"]), entries, {
      stake: 2,
      nassauFormat: "robin",
    });
    const { ledger } = computeNassau(round);
    expect(sum(ledger)).toBe(0);
  });

  it("team format settles better-ball match play, split within each side", () => {
    // A = a,c  B = b,d. A takes the front (holes 1–5) and overall; B the back.
    const entries = Array.from({ length: 18 }, (_, i) => {
      const h = i + 1;
      if (h <= 5) return { hole: h, wolfId: "", mode: "2v2" as const, grossScores: { a: 3, b: 4, c: 5, d: 5 } };
      if (h >= 10 && h <= 13) return { hole: h, wolfId: "", mode: "2v2" as const, grossScores: { a: 4, b: 3, c: 5, d: 5 } };
      return { hole: h, wolfId: "", mode: "2v2" as const, grossScores: { a: 4, b: 4, c: 4, d: 4 } };
    });
    const round = makeRound("nassau", scratch(["a", "b", "c", "d"]), entries, {
      stake: 2,
      nassauFormat: "teams",
      teams: { a: "A", b: "B", c: "A", d: "B" },
    });
    const { ledger, stats } = computeNassau(round);
    // $2 bets split across the 2-player sides → ±$1 each per bet.
    expect(stats.a.front).toBe(1);
    expect(stats.a.back).toBe(-1);
    expect(stats.a.overall).toBe(1);
    expect(ledger.a).toBe(1);
    expect(ledger.c).toBe(1);
    expect(ledger.b).toBe(-1);
    expect(ledger.d).toBe(-1);
    expect(sum(ledger)).toBe(0);
  });

  it("uneven teams (1 v 3) — the single wins/loses the full stake", () => {
    // A = a alone vs B = b,c,d. a wins every hole → sweeps all three bets.
    const entries = Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      wolfId: "",
      mode: "2v2" as const,
      grossScores: { a: 3, b: 5, c: 5, d: 5 },
    }));
    const round = makeRound("nassau", scratch(["a", "b", "c", "d"]), entries, {
      stake: 2,
      nassauFormat: "teams",
      teams: { a: "A", b: "B", c: "B", d: "B" },
    });
    const { ledger, stats } = computeNassau(round);
    expect(ledger.a).toBeCloseTo(6); // 3 bets × $2
    expect(stats.a.overall).toBeCloseTo(2);
    expect(ledger.b).toBeCloseTo(-2); // each of the 3 splits −$2 over the round
    expect(sum(ledger)).toBeCloseTo(0);
  });

  it("a press opens an offsetting bet on the rest of the nine", () => {
    // Heads-up (A=a, B=b). Front halved. On the back b wins 10–14 (5 holes),
    // a wins 15–18 (4). Base back + overall go to b. a presses on 15 and sweeps
    // 15–18, winning that press back.
    const make = (press: boolean) =>
      Array.from({ length: 18 }, (_, i) => {
        const h = i + 1;
        const grossScores =
          h <= 9 ? { a: 4, b: 4 } : h <= 14 ? { a: 5, b: 4 } : { a: 4, b: 5 };
        return {
          hole: h,
          wolfId: "",
          mode: "2v2" as const,
          grossScores,
          ...(press && h === 15 ? { pressSeg: true } : {}),
        };
      });
    const opts = {
      stake: 2,
      nassauFormat: "teams" as const,
      teams: { a: "A" as const, b: "B" as const },
    };

    // Without the press: a loses the back base (−2) and the overall (−2) = −4.
    const noPress = computeNassau(
      makeRound("nassau", scratch(["a", "b"]), make(false), opts)
    );
    expect(noPress.ledger.a).toBe(-4);

    // With the press: a wins the press (+2), netting the back to a wash; only
    // the overall (−2) is left.
    const withPress = computeNassau(
      makeRound("nassau", scratch(["a", "b"]), make(true), opts)
    );
    expect(withPress.ledger.a).toBe(-2);
    expect(withPress.stats.a.original).toBe(-4); // back −2 + overall −2
    expect(withPress.stats.a.press).toBe(2); // press won back
    expect(sum(withPress.ledger)).toBe(0);
  });
});

// ── Press (generic, all games) ───────────────────────────────────────────────

describe("press", () => {
  it("ranges: seg = rest of the nine (six in 666), full = rest of the round", () => {
    const round = makeRound("stroke", scratch(["a", "b"]), [], { stake: 1 });
    expect(pressRange(round, 3, "seg")).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(pressRange(round, 12, "seg")).toEqual([12, 13, 14, 15, 16, 17, 18]);
    expect(pressRange(round, 3, "full")).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 3)
    );
    const sixes = makeRound("sixes", scratch(["a", "b", "c", "d"]), [], {});
    expect(pressRange(sixes, 3, "seg")).toEqual([3, 4, 5, 6]);
    expect(pressRange(sixes, 8, "seg")).toEqual([8, 9, 10, 11, 12]);
  });

  it("withPresses adds a fresh same-stake bet over the pressed holes", () => {
    // Stroke play, scratch. Only hole 18 separates them (a by one). A press on
    // hole 16 re-bets holes 16–18 → another +1 to a.
    const entries = Array.from({ length: 18 }, (_, i) => {
      const h = i + 1;
      const grossScores = h === 18 ? { a: 4, b: 5 } : { a: 4, b: 4 };
      return {
        hole: h,
        wolfId: "",
        mode: "2v2" as const,
        grossScores,
        ...(h === 16 ? { pressSeg: true } : {}),
      };
    });
    const round = makeRound("stroke", scratch(["a", "b"]), entries, { stake: 1 });
    const r = withPresses(round, computeStroke);
    expect(r.stats.a.original).toBe(1); // base: hole 18 only
    expect(r.stats.a.press).toBe(1); // press re-bets holes 16–18
    expect(r.ledger.a).toBe(2);
    expect(r.ledger.b).toBe(-2);
    expect(sum(r.ledger)).toBe(0);
  });

  it("a press carries its own ties per the MAIN carryover setting", () => {
    // Press on hole 1 (covers 1–9): hole 1 ties, a wins hole 2.
    const entries = [1, 2].map((h) => ({
      hole: h,
      wolfId: "",
      mode: "2v2" as const,
      grossScores: h === 1 ? { a: 4, b: 4 } : { a: 3, b: 4 },
      ...(h === 1 ? { pressSeg: true } : {}),
    }));
    const on = withPresses(
      makeRound("skins", scratch(["a", "b"]), entries, { skinValue: 5, carryover: true }),
      computeSkins
    );
    expect(on.stats.a.press).toBe(10); // tie on 1 carries → 2 skins on 2
    const off = withPresses(
      makeRound("skins", scratch(["a", "b"]), entries, { skinValue: 5, carryover: false }),
      computeSkins
    );
    expect(off.stats.a.press).toBe(5); // tie on 1 dead → 1 skin on 2
  });

  it("'carryover ties into press bets' duplicates the live carry into the press", () => {
    // carryover ON: hole 1 pushes ($5 carries); press opened on hole 2; a wins hole 2.
    const entries = [1, 2].map((h) => ({
      hole: h,
      wolfId: "",
      mode: "2v2" as const,
      grossScores: h === 1 ? { a: 4, b: 4 } : { a: 3, b: 4 },
      ...(h === 2 ? { pressSeg: true } : {}),
    }));
    const base = { skinValue: 5, carryover: true };
    // Off: the press is just hole 2's single skin; the carry stays in the base only.
    const off = withPresses(
      makeRound("skins", scratch(["a", "b"]), entries, { ...base, pressCarryover: false }),
      computeSkins
    );
    expect(off.stats.a.original).toBe(10); // base: hole 1 carry + hole 2 = 2 skins
    expect(off.stats.a.press).toBe(5); // press: hole 2 only
    expect(off.ledger.a).toBe(15);
    // On: the hole-1 carry rides into the press too (duplicated — still in base).
    const on = withPresses(
      makeRound("skins", scratch(["a", "b"]), entries, { ...base, pressCarryover: true }),
      computeSkins
    );
    expect(on.stats.a.press).toBe(10); // press: carry $5 + hole 2 $5 = 2 skins
    expect(on.ledger.a).toBe(20); // base 10 + press 10
    expect(sum(on.ledger)).toBe(0);
  });

  it("carryByHole splits a pushed hole's carry into normal / press / hammer", () => {
    const round = makeRound(
      "skins",
      scratch(["a", "b"]),
      [{ hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 4 }, hammer: 1, pressSeg: true }],
      { skinValue: 5, carryover: true, hammerCarry: true }
    );
    const c = carryByHole(round).get(1)!;
    expect(c.orig).toBe(5); // un-hammered base carry
    expect(c.hammer).toBe(5); // extra from the ×2 hammer (base bet)
    expect(c.press).toBe(5); // the press's own carry (pressHammerCarry off → base value)
    expect(c.total).toBe(15);
  });

  it("'carryover hammers into press bets' rides the carry in at its hammered size", () => {
    // Hole 1 hammered + pushed; press on hole 2; a wins hole 2. carryover + duplication on.
    const entries = [
      { hole: 1, wolfId: "", mode: "2v2" as const, grossScores: { a: 4, b: 4 }, hammer: 1 },
      { hole: 2, wolfId: "", mode: "2v2" as const, grossScores: { a: 3, b: 4 }, pressSeg: true },
    ];
    const base = { skinValue: 5, carryover: true, pressCarryover: true };
    const plain = withPresses(
      makeRound("skins", scratch(["a", "b"]), entries, { ...base, pressHammerCarry: false }),
      computeSkins
    );
    expect(plain.stats.a.press).toBe(10); // carry $5 (base value) + hole 2 $5
    const hammered = withPresses(
      makeRound("skins", scratch(["a", "b"]), entries, { ...base, pressHammerCarry: true }),
      computeSkins
    );
    expect(hammered.stats.a.press).toBe(15); // carry $10 (hammered) + hole 2 $5
  });

  it("combinedHoleResults sums base + press money on each hole", () => {
    const entries = Array.from({ length: 18 }, (_, i) => {
      const h = i + 1;
      const grossScores = h === 18 ? { a: 4, b: 5 } : { a: 4, b: 4 };
      return {
        hole: h,
        wolfId: "",
        mode: "2v2" as const,
        grossScores,
        ...(h === 16 ? { pressSeg: true } : {}),
      };
    });
    const round = makeRound("stroke", scratch(["a", "b"]), entries, { stake: 1 });
    const combined = combinedHoleResults(round, (r) => {
      const g = computeStroke(r);
      return { ledger: g.ledger, holeResults: g.holeResults };
    });
    const h18 = combined.find((r) => r.hole === 18)!;
    expect(h18.deltas.a).toBe(2); // base +1 + press +1
    expect(h18.deltas.b).toBe(-2);
  });

  it("overlapping presses on different holes stack (double press)", () => {
    // Press hole 16 AND hole 17 (each rest-of-nine). Only hole 18 separates a
    // and b, and it's in both press ranges → both presses pay there.
    const entries = Array.from({ length: 18 }, (_, i) => {
      const h = i + 1;
      const grossScores = h === 18 ? { a: 4, b: 5 } : { a: 4, b: 4 };
      return {
        hole: h,
        wolfId: "",
        mode: "2v2" as const,
        grossScores,
        ...(h === 16 || h === 17 ? { pressSeg: true } : {}),
      };
    });
    const round = makeRound("stroke", scratch(["a", "b"]), entries, { stake: 1 });
    const r = withPresses(round, computeStroke);
    expect(r.stats.a.press).toBe(2); // press(16) +1 and press(17) +1 on hole 18
    expect(r.ledger.a).toBe(3); // base +1 + presses +2
    expect(sum(r.ledger)).toBe(0);
  });
});

// ── Carryover ────────────────────────────────────────────────────────────────

describe("carryover option", () => {
  it("skins: with carryover off, a tied hole is dead (no carry)", () => {
    const round = makeRound(
      "skins",
      scratch(["a", "b", "c", "d"]),
      [
        { hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 4, c: 4, d: 4 } }, // dead tie
        { hole: 2, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 4, d: 4 } }, // a wins 1
      ],
      { skinValue: 2, carryover: false }
    );
    const { ledger, stats } = computeSkins(round);
    expect(stats.a.skins).toBe(1); // not 2 — the tie didn't carry
    expect(ledger.a).toBe(6);
    expect(ledger.b).toBe(-2);
    expect(sum(ledger)).toBe(0);
  });

  it("six-six-six: a push carries within a segment", () => {
    const round = makeRound(
      "sixes",
      scratch(["a", "b", "c", "d"]),
      [
        { hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 5, c: 4, d: 5 } }, // push
        { hole: 2, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 5, c: 5, d: 6 } }, // A wins 5+5
      ],
      { stake: 5, carryover: true }
    );
    const { ledger } = computeSixes(round);
    expect(ledger.a).toBe(10); // carried stake doubled the hole
    expect(ledger.c).toBe(-10);
    expect(sum(ledger)).toBe(0);
  });

  it("six-six-six: a carry dies when partners rotate (segment boundary)", () => {
    const round = makeRound(
      "sixes",
      scratch(["a", "b", "c", "d"]),
      [
        { hole: 6, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 5, c: 4, d: 5 } }, // push, last of seg 1
        { hole: 7, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 5, c: 5, d: 5 } }, // seg 2: a,c vs b,d
      ],
      { stake: 5, carryover: true }
    );
    const { ledger } = computeSixes(round);
    expect(ledger.a).toBe(5); // not 10 — the carry was voided at the rotation
    expect(ledger.c).toBe(5);
    expect(ledger.b).toBe(-5);
    expect(sum(ledger)).toBe(0);
  });
});

// ── Hammer & forfeit ────────────────────────────────────────────────────────

describe("hammer & forfeit", () => {
  it("skins: hammer doubles the hole payout", () => {
    const round = makeRound(
      "skins",
      scratch(["a", "b", "c", "d"]),
      [
        {
          hole: 1,
          wolfId: "",
          mode: "2v2",
          grossScores: { a: 3, b: 4, c: 5, d: 5 },
          hammer: 1,
        },
      ],
      { skinValue: 2 }
    );
    const { ledger } = computeSkins(round);
    expect(ledger.a).toBe(12); // 6 × 2 (hammer)
    expect(ledger.b).toBe(-4);
    expect(sum(ledger)).toBe(0);
  });

  it("vegas: hammer doubles the point money", () => {
    const round = makeRound(
      "vegas",
      scratch(["a", "b", "c", "d"]),
      [
        {
          hole: 18,
          wolfId: "",
          mode: "2v2",
          grossScores: { a: 4, b: 5, c: 4, d: 6 },
          hammer: 1,
        },
      ],
      { pointValue: 1, birdieFlip: true, teams: { a: "A", b: "A", c: "B", d: "B" } }
    );
    expect(computeVegas(round).ledger.a).toBe(2); // 1 pt × 2 (hammer)
  });

  it("best ball: forfeit forces the other team to win (no scores needed)", () => {
    const round = makeRound(
      "bestball",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 18, wolfId: "", mode: "2v2", grossScores: {}, forfeit: "A" }],
      { stake: 5, teams: { a: "A", b: "A", c: "B", d: "B" } }
    );
    const { ledger } = computeBestBall(round);
    expect(ledger.c).toBe(5); // team B wins by team A's concession
    expect(ledger.d).toBe(5);
    expect(ledger.a).toBe(-5);
    expect(ledger.b).toBe(-5);
    expect(sum(ledger)).toBe(0);
  });

  it("best ball: hammer doubles a normal hole win", () => {
    const round = makeRound(
      "bestball",
      scratch(["a", "b", "c", "d"]),
      [
        {
          hole: 18,
          wolfId: "",
          mode: "2v2",
          grossScores: { a: 4, b: 5, c: 5, d: 6 },
          hammer: 1,
        },
      ],
      { stake: 5, teams: { a: "A", b: "A", c: "B", d: "B" } }
    );
    const { ledger } = computeBestBall(round);
    expect(ledger.a).toBe(10);
    expect(ledger.c).toBe(-10);
    expect(sum(ledger)).toBe(0);
  });

  it("skins: a hammered tie carries the hammered value only when hammerCarry is on", () => {
    const entries = [
      { hole: 1, wolfId: "", mode: "2v2" as const, grossScores: { a: 4, b: 4 }, hammer: 1 }, // hammered tie
      { hole: 2, wolfId: "", mode: "2v2" as const, grossScores: { a: 3, b: 4 } }, // a wins
    ];
    const off = computeSkins(
      makeRound("skins", scratch(["a", "b"]), entries, { skinValue: 5, carryover: true })
    );
    expect(off.ledger.a).toBe(10); // carried base $5 + hole 2 $5

    const on = computeSkins(
      makeRound("skins", scratch(["a", "b"]), entries, {
        skinValue: 5,
        carryover: true,
        hammerCarry: true,
      })
    );
    expect(on.ledger.a).toBe(15); // carried hammered $10 + hole 2 $5
    expect(sum(on.ledger)).toBe(0);
  });

  it("best ball: a hammered push carries the hammered value only when hammerCarry is on", () => {
    const teams = { a: "A", b: "A", c: "B", d: "B" } as const;
    const entries = [
      { hole: 17, wolfId: "", mode: "2v2" as const, grossScores: { a: 4, b: 5, c: 4, d: 5 }, hammer: 1 }, // push, hammered
      { hole: 18, wolfId: "", mode: "2v2" as const, grossScores: { a: 4, b: 5, c: 6, d: 6 } }, // A wins
    ];
    const off = computeBestBall(
      makeRound("bestball", scratch(["a", "b", "c", "d"]), entries, { stake: 5, carryover: true, teams: { ...teams } })
    );
    expect(off.ledger.a).toBe(10); // hole 18 stake 5 + carried base 5

    const on = computeBestBall(
      makeRound("bestball", scratch(["a", "b", "c", "d"]), entries, {
        stake: 5,
        carryover: true,
        hammerCarry: true,
        teams: { ...teams },
      })
    );
    expect(on.ledger.a).toBe(15); // hole 18 stake 5 + carried hammered 10
    expect(sum(on.ledger)).toBe(0);
  });

  it("six-six-six: forfeit decides the segment hole", () => {
    const round = makeRound(
      "sixes",
      scratch(["a", "b", "c", "d"]),
      [{ hole: 1, wolfId: "", mode: "2v2", grossScores: {}, forfeit: "B" }],
      { stake: 5 }
    );
    const { ledger } = computeSixes(round);
    // Segment 1: A=a,b vs B=c,d. B concedes → a,b win.
    expect(ledger.a).toBe(5);
    expect(ledger.b).toBe(5);
    expect(ledger.c).toBe(-5);
    expect(ledger.d).toBe(-5);
    expect(sum(ledger)).toBe(0);
  });
});

describe("six-six-six", () => {
  it("partners rotate by segment (AB|CD then AC|BD)", () => {
    const round = makeRound(
      "sixes",
      scratch(["a", "b", "c", "d"]),
      [
        // Segment 1 (holes 1-6): A,B vs C,D — AB win.
        { hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 5, c: 5, d: 6 } },
        // Segment 2 (holes 7-12): A,C vs B,D — AC win.
        { hole: 7, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 5, c: 5, d: 5 } },
      ],
      { stake: 5 }
    );
    const { ledger, stats } = computeSixes(round);
    // a partnered b (win) then c (win): +10. b won once, lost once: 0.
    expect(ledger.a).toBe(10);
    expect(ledger.b).toBe(0);
    expect(ledger.c).toBe(0);
    expect(ledger.d).toBe(-10);
    expect(stats.a.holesWon).toBe(2);
    expect(sum(ledger)).toBe(0);
  });
});
