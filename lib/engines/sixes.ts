// lib/engines/sixes.ts
// Six-Six-Six / Round Robin (net). Exactly four players. The round splits into
// three equal segments; partners rotate each segment so everyone partners
// everyone: 1st AB v CD, 2nd AC v BD, 3rd AD v BC (A..D = tee order). Each hole is
// a 2v2 best-ball (net) match for the stake — even teams, so always zero-sum.

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";

export function computeSixes(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const order = round.teeOrder.length === 4 ? round.teeOrder : ids;
  const [p0, p1, p2, p3] = order;
  const stake = settings.stake || 1;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
  const total = course.holes.length || 18;

  const ledger: Record<PlayerId, number> = {};
  const holesWon: Record<PlayerId, number> = {};
  for (const id of ids) {
    ledger[id] = 0;
    holesWon[id] = 0;
  }

  const name = (id: PlayerId) =>
    players.find((p) => p.id === id)?.name?.split(" ")[0] || "?";
  const teamsForIndex = (i: number): [PlayerId[], PlayerId[]] => {
    const third = total / 3;
    const seg = i < third ? 0 : i < 2 * third ? 1 : 2;
    if (seg === 0) return [[p0, p1], [p2, p3]];
    if (seg === 1) return [[p0, p2], [p1, p3]];
    return [[p0, p3], [p1, p2]];
  };

  const holeResults: GameHoleResult[] = [];

  course.holes.forEach((h, i) => {
    const e = entryByHole.get(h.number);
    const deltas: Record<PlayerId, number> = {};
    for (const id of ids) deltas[id] = 0;

    const [tA, tB] = teamsForIndex(i);
    const allScored = !!e && ids.every((id) => typeof e.grossScores[id] === "number");
    if (!allScored || order.length < 4) {
      holeResults.push({ hole: h.number, decided: false, detail: "—", deltas });
      return;
    }

    const net = (id: PlayerId) => e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
    const bA = Math.min(...tA.map(net));
    const bB = Math.min(...tB.map(net));

    let detail: string;
    if (bA < bB) {
      for (const id of tA) {
        deltas[id] = stake;
        holesWon[id] += 1;
      }
      for (const id of tB) deltas[id] = -stake;
      detail = `${tA.map(name).join("/")} win · ${bA} vs ${bB}`;
    } else if (bB < bA) {
      for (const id of tB) {
        deltas[id] = stake;
        holesWon[id] += 1;
      }
      for (const id of tA) deltas[id] = -stake;
      detail = `${tB.map(name).join("/")} win · ${bB} vs ${bA}`;
    } else {
      detail = `Push at ${bA}`;
    }

    for (const id of ids) ledger[id] += deltas[id];
    holeResults.push({ hole: h.number, decided: bA !== bB, detail, deltas });
  });

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { holesWon: holesWon[id] };
  return { ledger, pops, holeResults, stats };
}
