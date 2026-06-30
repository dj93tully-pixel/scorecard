import { describe, it, expect } from "vitest";
import { Course, Player, Round, RoundSettings, DEFAULT_SETTINGS } from "./wolf";
import { computeGame } from "./gametypes";
import { buildResults } from "./results";

function makeCourse(): Course {
  return {
    name: "Test Links",
    holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 })),
  };
}
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
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

describe("buildResults (results page data)", () => {
  it("skins with a hammer + press: columns/holes reconcile to the engine total", () => {
    const round = makeRound(
      "skins",
      scratch(["a", "b", "c", "d"]),
      [
        { hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 5, d: 5 }, hammer: 1 },
        { hole: 5, wolfId: "", mode: "2v2", grossScores: { a: 4, b: 3, c: 5, d: 5 }, pressSeg: true },
        { hole: 12, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 5, d: 5 } },
      ],
      { skinValue: 2, carryover: false }
    );
    const data = buildResults(round);
    const ledger = computeGame(round).ledger;

    expect(data.betTypes).toEqual(["original", "press", "hammer"]);

    for (const p of data.players) {
      // total[i] = original + press + hammer at every hole
      p.holes.forEach((_, i) => {
        expect(p.money.total[i]).toBeCloseTo(
          p.money.original[i] + p.money.press[i] + p.money.hammer[i]
        );
      });
      // grand = sum of per-hole totals = the engine's ledger for that player
      expect(sum(p.money.total)).toBeCloseTo(p.grand);
      expect(p.grand).toBeCloseTo(ledger[p.id] ?? 0);
    }
    // zero-sum across players
    expect(data.players.reduce((s, p) => s + p.grand, 0)).toBeCloseTo(0);
  });

  it("nassau: no hammer tile; grand reconciles to the engine ledger", () => {
    const entries = Array.from({ length: 18 }, (_, i) => {
      const h = i + 1;
      // a/c beat b/d on the front; a presses on hole 5.
      const grossScores = h <= 9 ? { a: 4, b: 5, c: 4, d: 5 } : { a: 4, b: 4, c: 4, d: 4 };
      return {
        hole: h,
        wolfId: "",
        mode: "2v2" as const,
        grossScores,
        ...(h === 5 ? { pressSeg: true } : {}),
      };
    });
    const round = makeRound("nassau", scratch(["a", "b", "c", "d"]), entries, {
      stake: 2,
      nassauFormat: "teams",
      teams: { a: "A", b: "B", c: "A", d: "B" },
    });
    const data = buildResults(round);
    const ledger = computeGame(round).ledger;

    expect(data.betTypes).not.toContain("hammer");
    for (const p of data.players) {
      expect(sum(p.money.hammer)).toBe(0);
      expect(sum(p.money.total)).toBeCloseTo(p.grand);
      expect(p.grand).toBeCloseTo(ledger[p.id] ?? 0);
    }
  });

  it("exposes course tees with per-hole distances aligned to the holes", () => {
    const round = makeRound("stroke", scratch(["a", "b"]), [], { stake: 1 });
    round.course.tees = [
      { name: "Blue", color: "#2D6CDF", yards: 6800, distances: Array.from({ length: 18 }, (_, i) => 300 + i) },
      { name: "White", distances: Array.from({ length: 18 }, () => null) },
    ];
    const data = buildResults(round);
    expect(data.tees).toHaveLength(2);
    expect(data.tees[0].name).toBe("Blue");
    expect(data.tees[0].color).toBe("#2D6CDF");
    expect(data.tees[0].distanceByHole[1]).toBe(300);
    expect(data.tees[0].distanceByHole[18]).toBe(317);
    expect(data.tees[1].distanceByHole[1]).toBeNull();
  });

  it("no tees on the course → empty tees array", () => {
    const round = makeRound("stroke", scratch(["a", "b"]), [], { stake: 1 });
    expect(buildResults(round).tees).toEqual([]);
  });

  it("plain stroke (no press/hammer): only the Total column, still reconciles", () => {
    const round = makeRound(
      "stroke",
      scratch(["a", "b", "c"]),
      [{ hole: 1, wolfId: "", mode: "2v2", grossScores: { a: 3, b: 4, c: 5 } }],
      { stake: 1 }
    );
    const data = buildResults(round);
    expect(data.betTypes).toEqual([]); // no Original tile when nothing is split
    const ledger = computeGame(round).ledger;
    for (const p of data.players) {
      expect(p.grand).toBeCloseTo(ledger[p.id] ?? 0);
      expect(sum(p.money.total)).toBeCloseTo(p.grand);
    }
  });
});
