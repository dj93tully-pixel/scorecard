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
  const segOf = (i: number) => {
    const third = total / 3;
    return i < third ? 0 : i < 2 * third ? 1 : 2;
  };
  const teamsForIndex = (i: number): [PlayerId[], PlayerId[]] => {
    const seg = segOf(i);
    if (seg === 0) return [[p0, p1], [p2, p3]];
    if (seg === 1) return [[p0, p2], [p1, p3]];
    return [[p0, p3], [p1, p2]];
  };

  const holeResults: GameHoleResult[] = [];
  let carried = 0; // pushed stake riding forward — only within the same segment

  course.holes.forEach((h, i) => {
    const e = entryByHole.get(h.number);
    const deltas: Record<PlayerId, number> = {};
    for (const id of ids) deltas[id] = 0;

    const seg = segOf(i);
    const [tA, tB] = teamsForIndex(i);
    const forfeit = e?.forfeit; // "A" = tA concedes, "B" = tB concedes
    const allScored = !!e && ids.every((id) => typeof e.grossScores[id] === "number");
    const decidable = !!e && (allScored || forfeit === "A" || forfeit === "B");
    if (!decidable || order.length < 4) {
      holeResults.push({ hole: h.number, decided: false, detail: "—", deltas });
      return;
    }

    const net = (id: PlayerId) => e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
    const bA = allScored ? Math.min(...tA.map(net)) : null;
    const bB = allScored ? Math.min(...tB.map(net)) : null;
    const hammerMult = 2 ** Math.max(0, Math.floor(e!.hammer ?? 0));
    const stakeApplied = stake + carried;

    let winner: "A" | "B" | "push";
    if (forfeit === "A") winner = "B";
    else if (forfeit === "B") winner = "A";
    else if (bA! < bB!) winner = "A";
    else if (bB! < bA!) winner = "B";
    else winner = "push";

    let detail: string;
    if (winner === "A") {
      for (const id of tA) {
        deltas[id] = stakeApplied;
        holesWon[id] += 1;
      }
      for (const id of tB) deltas[id] = -stakeApplied;
      carried = 0;
      detail = forfeit
        ? `${tA.map(name).join("/")} win · forfeit`
        : `${tA.map(name).join("/")} win · ${bA} vs ${bB}`;
    } else if (winner === "B") {
      for (const id of tB) {
        deltas[id] = stakeApplied;
        holesWon[id] += 1;
      }
      for (const id of tA) deltas[id] = -stakeApplied;
      carried = 0;
      detail = forfeit
        ? `${tB.map(name).join("/")} win · forfeit`
        : `${tB.map(name).join("/")} win · ${bB} vs ${bA}`;
    } else {
      // Carry only within the same segment — when partners rotate, the carry dies.
      const nextSameSegment = i + 1 < total && segOf(i + 1) === seg;
      if (settings.carryover && nextSameSegment) {
        // Carry the hammered value only when hammerCarry is on; else the base.
        carried = stakeApplied * (settings.hammerCarry ? hammerMult : 1);
        detail = `Push — $${carried} carries`;
      } else {
        carried = 0;
        detail = "Push";
      }
    }

    if (hammerMult !== 1) for (const id of ids) deltas[id] *= hammerMult;
    for (const id of ids) ledger[id] += deltas[id];
    holeResults.push({ hole: h.number, decided: winner !== "push", detail, deltas });
  });

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { holesWon: holesWon[id] };
  return { ledger, pops, holeResults, stats };
}
