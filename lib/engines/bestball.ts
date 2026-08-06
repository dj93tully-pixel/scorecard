// lib/engines/bestball.ts
// Best Ball (net). Each team's hole score is its best (lowest) net ball; the lowest
// team wins the hole. Two teams use the Wolf pot-split (with a separate Team-A stake
// so an uneven 2v3 stays zero-sum). Three-to-four teams (A–D) use a flat model: the
// winning team collects the stake from EVERY non-winning player, split among its
// members. A tie for low pushes and carries (when carryover is on).

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";
import { splitTeams, teamGroups, usesMultiTeam } from "./teams";

export function computeBestBall(round: Round): GameResult {
  return usesMultiTeam(round) ? computeBestBallMulti(round) : computeBestBallTwo(round);
}

// ── Three-to-four team Best Ball ──────────────────────────────────────────────
function computeBestBallMulti(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const stake = settings.stake ?? 1; // 0 = no money; every player risks this
  const groups = teamGroups(round);
  const teamOf = new Map<PlayerId, string>();
  groups.forEach((g) => g.ids.forEach((id) => teamOf.set(id, g.letter)));
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const ledger: Record<PlayerId, number> = {};
  for (const id of ids) ledger[id] = 0;
  const holesWon: Record<string, number> = {};
  groups.forEach((g) => (holesWon[g.letter] = 0));

  const holeResults: GameHoleResult[] = [];
  let carried = 0;

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
    const bests = groups.map((g) => ({ letter: g.letter, best: Math.min(...g.ids.map((id) => net[id])) }));
    const low = Math.min(...bests.map((b) => b.best));
    const winners = bests.filter((b) => b.best === low);

    const applied = stake + carried;
    const hammerMult = 2 ** Math.max(0, Math.floor(e!.hammer ?? 0));

    let detail: string;
    if (winners.length === 1) {
      const win = winners[0].letter;
      const winIds = groups.find((g) => g.letter === win)!.ids;
      const losers = ids.filter((id) => teamOf.get(id) !== win);
      const share = (applied * losers.length) / winIds.length;
      for (const id of losers) deltas[id] = -applied;
      for (const id of winIds) deltas[id] = share;
      holesWon[win] += 1;
      carried = 0;
      detail = `Team ${win} wins · ${low}`;
    } else {
      // Tie for low → push. Carry (hammered when hammerCarry is on) or void.
      carried = settings.carryover ? applied * (settings.hammerCarry ? hammerMult : 1) : 0;
      detail = settings.carryover && carried > 0 ? `Push — $${carried} carries` : "Push";
    }

    if (hammerMult !== 1) for (const id of ids) deltas[id] *= hammerMult;
    for (const id of ids) ledger[id] += deltas[id];
    holeResults.push({
      hole: h.number,
      decided: winners.length === 1,
      detail,
      deltas,
      carry: winners.length === 1 ? 0 : carried,
    });
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { holesUp: holesWon[teamOf.get(id) ?? "A"] ?? 0 };
  return { ledger, pops, holeResults, stats };
}

// ── Two-team Best Ball (original) ─────────────────────────────────────────────
function computeBestBallTwo(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const { A, B } = splitTeams(round);
  const fieldStake = settings.stake ?? 1; // 0 = no money
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
      if (settings.carryover) {
        // Carry the hammered value only when hammerCarry is on; else the base.
        carried = fieldApplied * (settings.hammerCarry ? hammerMult : 1);
        detail = `Push — $${carried} carries`;
      } else {
        detail = "Push";
      }
    }

    if (hammerMult !== 1) for (const id of ids) deltas[id] *= hammerMult;
    for (const id of ids) ledger[id] += deltas[id];
    holeResults.push({
      hole: h.number,
      decided: winner !== "push",
      detail,
      deltas,
      carry: winner === "push" ? carried : 0,
    });
  }

  const up = holesA - holesB;
  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { holesUp: A.includes(id) ? up : -up };
  return { ledger, pops, holeResults, stats };
}
