import { describe, it, expect } from "vitest";
import { Course, Player, Round, DEFAULT_SETTINGS, computeRound } from "./wolf";
import { suggestForHole } from "./caddie";

function makeCourse(): Course {
  return {
    name: "Test",
    holes: Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: 4,
      strokeIndex: i + 1,
    })),
  };
}

function round(players: Player[], entries: Round["entries"]): Round {
  return {
    course: makeCourse(),
    players,
    teeOrder: players.map((p) => p.id),
    settings: { ...DEFAULT_SETTINGS },
    entries,
  };
}

const P = (id: string, handicap = 0): Player => ({ id, name: id.toUpperCase(), handicap });

describe("caddie — suggestForHole", () => {
  it("always returns one of the valid modes", () => {
    const players = [P("a"), P("b"), P("c"), P("d")];
    const r = round(players, []);
    const s = suggestForHole(r, computeRound(r), 1);
    expect(s).not.toBeNull();
    expect(["2v2", "lone", "blind"]).toContain(s!.mode);
  });

  it("suggests partnering with the clearly best-form opponent", () => {
    // Wolf = a (rotation hole 1). b has been scoring great (under par); c, d poor.
    const players = [P("a"), P("b"), P("c"), P("d")];
    const entries: Round["entries"] = [2, 3, 4].map((h) => ({
      hole: h,
      wolfId: "a",
      mode: "2v2" as const,
      grossScores: { a: 4, b: 3, c: 6, d: 6 }, // b birdies, c/d double
    }));
    const r = round(players, entries);
    const s = suggestForHole(r, computeRound(r), 1);
    expect(s!.mode).toBe("2v2");
    expect(s!.partnerId).toBe("b");
  });

  it("leans lone/blind when the wolf is clearly the strongest", () => {
    // Wolf = a, crushing it; everyone else poor.
    const players = [P("a"), P("b"), P("c"), P("d")];
    const entries: Round["entries"] = [2, 3, 4].map((h) => ({
      hole: h,
      wolfId: "a",
      mode: "2v2" as const,
      grossScores: { a: 3, b: 6, c: 6, d: 6 },
    }));
    const r = round(players, entries);
    const s = suggestForHole(r, computeRound(r), 1);
    expect(["lone", "blind"]).toContain(s!.mode);
  });

  it("favors a partner who gets a pop on the hole, all else equal", () => {
    // Fresh round (no form). d has a high handicap → pops on low stroke-index
    // holes. On hole 1 (SI 1) d gets a stroke, so d is the strongest net ball.
    const players = [P("a", 0), P("b", 0), P("c", 0), P("d", 18)];
    const r = round(players, []);
    const s = suggestForHole(r, computeRound(r), 1);
    expect(s!.mode).toBe("2v2");
    expect(s!.partnerId).toBe("d");
  });
});
