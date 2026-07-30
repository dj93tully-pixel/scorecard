// lib/engines/vegas.ts
// Vegas (net). Exactly two teams of two. Each team's two net scores form a number
// with the LOW score first (4 & 5 → 45). The difference between the team numbers,
// times the point value, is what every losing player pays every winning player —
// so each player swings ±points×pointValue (zero-sum across the four).
//
// Birdie-flip house rule (toggle): if a team makes a net birdie, the OPPONENT's
// number flips to high-first (e.g. 54 instead of 45), enlarging their figure.

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";
import { splitTeams } from "./teams";

function teamNumber(a: number, b: number, highFirst: boolean): number {
  // Form the two-figure Vegas number arithmetically (low digit first, or high-first on
  // a birdie flip). Computing it — rather than string-concatenating — is critical: a
  // double-digit net (a blow-up 10) used to become Number("410") = 410 (a ~10× swing),
  // and a net <= 0 (a very low gross with handicap pops) with a flip became
  // Number("3-1") = NaN, which then poisoned every player's total for the whole round.
  // Floor each net at 1 so the number stays a sane, monotonic figure.
  const lo = Math.max(1, Math.min(a, b));
  const hi = Math.max(1, Math.max(a, b));
  return highFirst ? hi * 10 + lo : lo * 10 + hi;
}

export function computeVegas(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const { A, B } = splitTeams(round);
  const pointValue =
    settings.pointValue && settings.pointValue > 0 ? settings.pointValue : 1;
  const flip = settings.birdieFlip ?? true;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const ledger: Record<PlayerId, number> = {};
  const points: Record<PlayerId, number> = {};
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
    if (!allScored || A.length < 2 || B.length < 2) {
      holeResults.push({ hole: h.number, decided: false, detail: "—", deltas });
      continue;
    }

    const net = (id: PlayerId) => e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
    const aNets = A.map(net);
    const bNets = B.map(net);
    const birdieA = Math.min(...aNets) < h.par;
    const birdieB = Math.min(...bNets) < h.par;
    const numA = teamNumber(aNets[0], aNets[1], flip && birdieB);
    const numB = teamNumber(bNets[0], bNets[1], flip && birdieA);
    const diff = numA - numB;

    // Hammer multiplies the money in play (0→1×, 1→2×, 2→4×).
    const hammerMult = 2 ** Math.max(0, Math.floor(e!.hammer ?? 0));

    let detail: string;
    if (diff === 0) {
      detail = "Push";
    } else {
      const pts = Math.abs(diff);
      const amt = pts * pointValue * hammerMult;
      if (diff < 0) {
        for (const id of A) {
          deltas[id] = amt;
          points[id] += pts;
        }
        for (const id of B) {
          deltas[id] = -amt;
          points[id] -= pts;
        }
        detail = `A ${numA} beats ${numB} · ${pts} pt`;
      } else {
        for (const id of B) {
          deltas[id] = amt;
          points[id] += pts;
        }
        for (const id of A) {
          deltas[id] = -amt;
          points[id] -= pts;
        }
        detail = `B ${numB} beats ${numA} · ${pts} pt`;
      }
    }

    for (const id of ids) ledger[id] += deltas[id];
    holeResults.push({ hole: h.number, decided: diff !== 0, detail, deltas });
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { points: points[id] };
  return { ledger, pops, holeResults, stats };
}
