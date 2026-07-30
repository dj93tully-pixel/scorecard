// lib/engines/stableford.ts
// Stableford & Modified Stableford — points games settled for money. Each hole a
// player earns points from their NET score vs par; then, like stroke play, every
// player plays each opponent for the POINT difference at the per-point value, so
// a hole delta is value × Σ(theirPoints − opponentPoints). Higher points win
// (the opposite sign of stroke play). Zero-sum per hole; total points drive the
// standings. (No hammer — a points race doesn't fit one.)
//
//   Standard       diff = net − par     points
//     double bogey+ (≥ +2)                 0
//     bogey         (+1)                    1
//     par            (0)                    2
//     birdie        (−1)                    3
//     eagle         (−2)                    4
//     albatross     (−3) …                  5 …      (points = max(0, 2 − diff))
//
//   Modified (PGA-style)
//     double bogey+ (≥ +2)                 −3
//     bogey         (+1)                   −1
//     par            (0)                    0
//     birdie        (−1)                    2
//     eagle         (−2)                    5
//     albatross+    (≤ −3)                  8

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";

/** Standard Stableford points for a net-to-par difference. */
export function stablefordPoints(diff: number): number {
  return Math.max(0, 2 - diff);
}

/** Modified (PGA-style) Stableford points for a net-to-par difference. */
export function modifiedStablefordPoints(diff: number): number {
  if (diff >= 2) return -3;
  if (diff === 1) return -1;
  if (diff === 0) return 0;
  if (diff === -1) return 2;
  if (diff === -2) return 5;
  return 8; // albatross or better
}

function computeStablefordLike(
  round: Round,
  pointsOf: (diff: number) => number
): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const value = settings.stake ?? 1; // dollars per point (0 = no money)
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const ledger: Record<PlayerId, number> = {};
  const points: Record<PlayerId, number> = {}; // running points total
  for (const id of ids) {
    ledger[id] = 0;
    points[id] = 0;
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

    const pts: Record<PlayerId, number> = {};
    for (const id of ids) {
      const net = e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
      pts[id] = pointsOf(net - h.par);
    }
    for (const id of ids) points[id] += pts[id];

    for (const id of ids) {
      let d = 0;
      for (const j of ids) if (j !== id) d += pts[id] - pts[j];
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
  for (const id of ids) stats[id] = { points: points[id] };
  return { ledger, pops, holeResults, stats };
}

export function computeStableford(round: Round): GameResult {
  return computeStablefordLike(round, stablefordPoints);
}

export function computeModifiedStableford(round: Round): GameResult {
  return computeStablefordLike(round, modifiedStablefordPoints);
}
