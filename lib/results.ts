// lib/results.ts
// Read-only presentation selector for the interactive results page. It re-runs
// the EXISTING engines (never changes them) and reshapes what they already
// compute into per-player, per-hole values split by bet type:
//   • original — the base bet, hammers removed
//   • press    — the press bets
//   • hammer   — the extra from hammers (base WITH hammer − base WITHOUT)
//   • total    — original + press + hammer (summed here, not re-settled)
// Money reconciles: per-hole totals sum to each player's grand total, which
// equals the engine's ledger. Nassau settles per segment (no per-hole money), so
// its segment money is attributed to the segment's last hole for display.

import { Round, PlayerId, computeRound } from "./wolf";
import { gameTypeOf, computeBaseGame, computeGame } from "./gametypes";
import { decomposePresses, hasAnyPress, RunResult } from "./engines/press";

export type BetType = "original" | "press" | "hammer";

export interface HoleCell {
  hole: number;
  par: number;
  gross: number | null;
  net: number | null;
}

export interface PlayerResults {
  id: string;
  name: string;
  handicap: number;
  holes: HoleCell[]; // course hole order
  // Per-hole winnings, aligned to holes[] (same length). total = the three summed.
  money: { original: number[]; press: number[]; hammer: number[]; total: number[] };
  grand: number; // sum of total
}

export interface ResultsData {
  players: PlayerResults[];
  betTypes: BetType[]; // the non-total bet types that EXIST (Total is always shown)
}

const zeroHammer = (round: Round): Round => ({
  ...round,
  entries: round.entries.map((e) => ({ ...e, hammer: 0 })),
});

export function buildResults(round: Round): ResultsData {
  const gt = gameTypeOf(round);
  const isWolf = gt === "wolf";
  const ids = round.players.map((p) => p.id);
  const holes = round.course.holes;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const wolfComp = isWolf ? computeRound(round) : null;
  const result = isWolf ? null : computeGame(round); // pops + Nassau stats
  const pops = (isWolf ? wolfComp!.pops : result!.pops) ?? {};

  const zeros = () => holes.map(() => 0);
  const orig: Record<PlayerId, number[]> = {};
  const prs: Record<PlayerId, number[]> = {};
  const ham: Record<PlayerId, number[]> = {};
  for (const id of ids) {
    orig[id] = zeros();
    prs[id] = zeros();
    ham[id] = zeros();
  }

  if (gt === "nassau" && result) {
    // No per-hole money — attribute each segment bet to its last hole. Front to
    // the last hole ≤ 9; back + overall + press to the last hole of the round.
    let frontIdx = -1;
    for (let i = 0; i < holes.length; i++) if (holes[i].number <= 9) frontIdx = i;
    const lastIdx = holes.length - 1;
    for (const id of ids) {
      const s = result.stats[id] ?? {};
      if (frontIdx >= 0) orig[id][frontIdx] += Number(s.front ?? 0);
      if (lastIdx >= 0) {
        orig[id][lastIdx] += Number(s.back ?? 0) + Number(s.overall ?? 0);
        prs[id][lastIdx] += Number(s.press ?? 0);
      }
    }
  } else {
    // Per-hole games (incl. Wolf): isolate hammer by re-running with hammers off,
    // and the press by decomposition.
    const run = (r: Round): RunResult => {
      if (isWolf) {
        const c = computeRound(r);
        return { ledger: c.ledger, holeResults: c.results.map((rr) => ({ hole: rr.hole, deltas: rr.deltas })) };
      }
      const g = computeBaseGame(r);
      return { ledger: g.ledger, holeResults: g.holeResults };
    };
    const idxOf = new Map(holes.map((h, i) => [h.number, i]));
    const withH = run(round);
    const noH = run(zeroHammer(round));
    const press = decomposePresses(round, run).press;
    const noByHole = new Map(noH.holeResults.map((r) => [r.hole, r.deltas]));

    for (const hr of noH.holeResults) {
      const i = idxOf.get(hr.hole);
      if (i === undefined) continue;
      for (const id of ids) orig[id][i] += hr.deltas[id] ?? 0;
    }
    for (const hr of withH.holeResults) {
      const i = idxOf.get(hr.hole);
      if (i === undefined) continue;
      const n = noByHole.get(hr.hole) ?? {};
      for (const id of ids) ham[id][i] += (hr.deltas[id] ?? 0) - (n[id] ?? 0);
    }
    for (const hr of press.holeResults) {
      const i = idxOf.get(hr.hole);
      if (i === undefined) continue;
      for (const id of ids) prs[id][i] += hr.deltas[id] ?? 0;
    }
  }

  const hasPress = hasAnyPress(round);
  const hasHammer = round.entries.some((e) => (e.hammer ?? 0) > 0);
  const betTypes: BetType[] = [];
  if (hasPress || hasHammer) betTypes.push("original"); // only meaningful once split
  if (hasPress) betTypes.push("press");
  if (hasHammer) betTypes.push("hammer");

  const players: PlayerResults[] = round.players.map((p) => {
    const holeCells: HoleCell[] = holes.map((h) => {
      const g = entryByHole.get(h.number)?.grossScores[p.id];
      const gross = typeof g === "number" ? g : null;
      const net = gross === null ? null : gross - (pops[p.id]?.[h.number] ?? 0);
      return { hole: h.number, par: h.par, gross, net };
    });
    const total = holes.map((_, i) => orig[p.id][i] + prs[p.id][i] + ham[p.id][i]);
    const grand = total.reduce((s, v) => s + v, 0);
    return {
      id: p.id,
      name: p.name || "Unnamed",
      handicap: p.handicap ?? 0,
      holes: holeCells,
      money: { original: orig[p.id], press: prs[p.id], hammer: ham[p.id], total },
      grand,
    };
  });

  return { players, betTypes };
}
