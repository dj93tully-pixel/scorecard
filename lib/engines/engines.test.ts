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
import { computeElevens } from "./elevens";

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
