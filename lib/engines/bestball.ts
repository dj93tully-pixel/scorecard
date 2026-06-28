// lib/engines/bestball.ts
// Best Ball (net). Two teams; a team's hole score is its best (lowest) net ball.
// The lower team score wins the hole, settled with the SAME pot-split Wolf uses,
// including a separate per-team stake so an uneven 2v3 (5 players) stays zero-sum.

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";
import { splitTeams } from "./teams";

export function computeBestBall(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const { A, B } = splitTeams(round);
  const fieldStake = settings.stake || 1;
  const wolfStake =
    settings.wolfStake && settings.wolfStake > 0 ? settings.wolfStake : fieldStake;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const ledger: Record<PlayerId, number> = {};
  for (const id of ids) ledger[id] = 0;

  const bestNet = (team: PlayerId[], net: Record<PlayerId, number>): number | null => {
    const vals = team.map((id) => net[id]).filter((v) => typeof v === "number");
    return vals.length ? Math.min(...vals) : null;
  };

  const holeResults: GameHoleResult[] = [];
  let holesA = 0;
  let holesB = 0;
  let carried = 0;

  for (const h of course.holes) {
    const e = entryByHole.get(h.number);
    const deltas: Record<PlayerId, number> = {};
    for (const id of ids) deltas[id] = 0;

    const forfeit = e?.forfeit; // "A" = team A concedes, "B" = team B concedes
    const allScored = !!e && ids.every((id) => typeof e.grossScores[id] === "number");
    // A forfeit decides the hole even before every score is in.
    const decidable = !!e && (allScored || forfeit === "A" || forfeit === "B");
    if (!decidable || A.length === 0 || B.length === 0) {
      holeResults.push({ hole: h.number, decided: false, detail: "—", deltas });
      continue;
    }

    let bA: number | null = null;
    let bB: number | null = null;
    if (allScored) {
      const net: Record<PlayerId, number> = {};
      for (const id of ids) net[id] = e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
      bA = bestNet(A, net);
      bB = bestNet(B, net);
    }
    const fieldApplied = fieldStake + carried;
    const wolfApplied = wolfStake + carried;
    const hammerMult = 2 ** Math.max(0, Math.floor(e!.hammer ?? 0));

    let winner: "A" | "B" | "push";
    if (forfeit === "A") winner = "B";
    else if (forfeit === "B") winner = "A";
    else if (bA! < bB!) winner = "A";
    else if (bB! < bA!) winner = "B";
    else winner = "push";

    let detail: string;
    if (winner === "A") {
      const pot = fieldApplied * B.length;
      const share = pot / A.length;
      for (const id of A) deltas[id] = share;
      for (const id of B) deltas[id] = -fieldApplied;
      holesA += 1;
      carried = 0;
      detail = forfeit ? "Team A wins · forfeit" : `Team A wins · ${bA} vs ${bB}`;
    } else if (winner === "B") {
      const pot = wolfApplied * A.length;
      const share = pot / B.length;
      for (const id of B) deltas[id] = share;
      for (const id of A) deltas[id] = -wolfApplied;
      holesB += 1;
      carried = 0;
      detail = forfeit ? "Team B wins · forfeit" : `Team B wins · ${bB} vs ${bA}`;
    } else {
      if (settings.carryover) carried = fieldApplied;
      detail = `Push at ${bA}${settings.carryover ? " — carries" : ""}`;
    }

    if (hammerMult !== 1) for (const id of ids) deltas[id] *= hammerMult;
    for (const id of ids) ledger[id] += deltas[id];
    holeResults.push({ hole: h.number, decided: winner !== "push", detail, deltas });
  }

  const up = holesA - holesB;
  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { holesUp: A.includes(id) ? up : -up };
  return { ledger, pops, holeResults, stats };
}
