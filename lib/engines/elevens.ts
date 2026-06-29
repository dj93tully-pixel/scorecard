// lib/engines/elevens.ts
// 11s (net). Each player picks 11 of the 18 holes to count for their score,
// declaring hole-by-hole (the checkbox in the score entry). A player's 11s score
// is the sum of net on the holes they've checked — lowest total wins.
//
// Payout is stroke-play style on those selected totals: each player's money is
// value × Σ(otherTotal − theirTotal). Equivalently, per hole each player's
// "counted net" is their net if they checked that hole (else 0), and we settle a
// dollar a stroke vs the field on those counted nets — summed over 18 holes this
// equals the total comparison and stays zero-sum every hole. A hole settles once
// all of its checkers have a score (non-checkers need none).

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
    const checkers = ids.filter((id) => sel[id]);
    const ready =
      checkers.length > 0 &&
      checkers.every((id) => typeof e?.grossScores[id] === "number");
    if (!ready) {
      holeResults.push({ hole: h.number, decided: false, detail: "—", deltas });
      continue;
    }

    // counted net: a player's net if they checked this hole, otherwise 0.
    const counted: Record<PlayerId, number> = {};
    for (const id of ids) {
      if (sel[id]) {
        counted[id] = e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
        score[id] += counted[id];
        picks[id] += 1;
      } else {
        counted[id] = 0;
      }
    }

    // Dollar a stroke vs the field on the counted nets.
    for (const id of ids) {
      let d = 0;
      for (const j of ids) if (j !== id) d += counted[j] - counted[id];
      deltas[id] = d * value;
    }
    for (const id of ids) ledger[id] += deltas[id];
    holeResults.push({ hole: h.number, decided: true, detail: "", deltas });
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { picks: picks[id], score: score[id] };
  return { ledger, pops, holeResults, stats };
}
