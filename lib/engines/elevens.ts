// lib/engines/elevens.ts
// 11s (net). Each player picks 11 of the 18 holes to count for their score,
// declaring hole-by-hole (the checkbox in the score entry). Only holes a player
// has checked count for them.
//
// Money: on each hole, the players who BOTH checked it play a "dollar a stroke"
// against one another — a player's hole delta is value × Σ(otherNet − theirNet)
// over the other checkers. A hole with fewer than two checkers moves no money.
// Zero-sum per hole, and the per-hole ledger only ever moves among the players
// who chose that hole. Each player's running 11s score = sum of net on the holes
// they've checked.

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";

export function computeElevens(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const value = settings.stake || 1; // dollars per stroke
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const ledger: Record<PlayerId, number> = {};
  const picks: Record<PlayerId, number> = {}; // holes checked (and scored)
  const score: Record<PlayerId, number> = {}; // net total over checked holes
  for (const id of ids) {
    ledger[id] = 0;
    picks[id] = 0;
    score[id] = 0;
  }

  const holeResults: GameHoleResult[] = [];

  for (const h of course.holes) {
    const e = entryByHole.get(h.number);
    const deltas: Record<PlayerId, number> = {};
    for (const id of ids) deltas[id] = 0;

    const sel = e?.elevenPicks ?? {};
    const net = (id: PlayerId) => e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
    // Players who checked this hole AND have a score on it.
    const checkers = ids.filter(
      (id) => sel[id] && typeof e?.grossScores[id] === "number"
    );

    for (const id of checkers) {
      score[id] += net(id);
      picks[id] += 1;
    }

    if (checkers.length >= 2) {
      for (const id of checkers) {
        let d = 0;
        for (const j of checkers) if (j !== id) d += net(j) - net(id);
        deltas[id] = d * value;
      }
      for (const id of ids) ledger[id] += deltas[id];
      const anyMoney = checkers.some((id) => deltas[id] !== 0);
      holeResults.push({
        hole: h.number,
        decided: anyMoney,
        detail: anyMoney ? "" : "Push",
        deltas,
      });
    } else {
      // 0 or 1 player counted the hole → nothing to settle.
      holeResults.push({ hole: h.number, decided: false, detail: "—", deltas });
    }
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { picks: picks[id], score: score[id] };
  return { ledger, pops, holeResults, stats };
}
