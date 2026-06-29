// lib/engines/strokeplay.ts
// Stroke Play (net) — "a dollar a stroke". Each hole, every player plays each
// opponent for the net-stroke difference at the per-stroke value, so a player's
// hole delta is value × Σ(opponentNet − theirNet). Summed over the round this
// equals each pairing's total net-stroke difference, and it's zero-sum per hole.
// Net totals drive the standings. (No hammer — it doesn't fit stroke play.)

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";

export function computeStroke(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const value = settings.stake || 1; // dollars per stroke
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const ledger: Record<PlayerId, number> = {};
  const strokes: Record<PlayerId, number> = {}; // running net-stroke total
  for (const id of ids) {
    ledger[id] = 0;
    strokes[id] = 0;
  }

  const holeResults: GameHoleResult[] = [];

  for (const h of course.holes) {
    const e = entryByHole.get(h.number);
    const deltas: Record<PlayerId, number> = {};
    for (const id of ids) deltas[id] = 0;

    const allScored = !!e && ids.every((id) => typeof e.grossScores[id] === "number");
    if (!allScored) {
      holeResults.push({ hole: h.number, decided: false, detail: "—", deltas });
      continue;
    }

    const net: Record<PlayerId, number> = {};
    for (const id of ids) net[id] = e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
    for (const id of ids) strokes[id] += net[id];

    for (const id of ids) {
      let d = 0;
      for (const j of ids) if (j !== id) d += net[j] - net[id];
      deltas[id] = d * value;
    }

    for (const id of ids) ledger[id] += deltas[id];
    const anyMoney = ids.some((id) => deltas[id] !== 0);
    holeResults.push({
      hole: h.number,
      decided: anyMoney,
      detail: anyMoney ? "" : "Push",
      deltas,
    });
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { strokes: strokes[id] };
  return { ledger, pops, holeResults, stats };
}
