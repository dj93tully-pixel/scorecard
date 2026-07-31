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
import {
  decomposePresses,
  hasAnyPress,
  pressedHoles,
  eachPress,
  RunResult,
} from "./engines/press";
import { nassauPressLedger } from "./engines/nassau";
import { computeJunk, JunkBetView } from "./junk";
import { carryByHole } from "./carry";

export type BetType = "original" | "press" | "hammer";

// One individual press for the Press tab's sub-selector. money is per-player,
// per-hole (aligned to the course holes; 0 outside the press's holes).
export interface PressInfo {
  label: string; // "F9", "B9", "18", "F9×2"…
  holes: number[]; // holes it covers
  money: Record<PlayerId, number[]>;
}

export interface HoleCell {
  hole: number;
  par: number;
  si: number; // stroke index (the hole's handicap rating)
  gross: number | null;
  net: number | null;
  pop: number; // handicap strokes received on this hole
  picked: boolean; // 11s: this player counts this hole
}

export interface PlayerResults {
  id: string;
  name: string;
  handicap: number;
  holes: HoleCell[]; // course hole order
  // Per-hole winnings, aligned to holes[] (same length). total = the three summed.
  money: { original: number[]; press: number[]; hammer: number[]; total: number[] };
  grand: number; // sum of total — the MAIN game only
  junk: number; // side-bet total (separate ledger); grand + junk is what's owed
}

export interface ResultTee {
  name: string;
  color?: string;
  distanceByHole: Record<number, number | null>;
}

export interface ResultsData {
  players: PlayerResults[];
  betTypes: BetType[]; // the non-total bet types that EXIST (Total is always shown)
  hammerHoles: number[]; // holes that had a hammer (filled purple dot)
  pressHoles: number[]; // union of every press's holes (filled orange dot)
  carriedHoles: number[]; // holes that RECEIVED a base-bet carry (gray dot)
  carriedHammerHoles: number[]; // holes that received a carried hammer (hollow purple ring)
  presses: PressInfo[]; // each individual press (Press tab sub-selector)
  tees: ResultTee[]; // course tee yardages (scorecard distance rows)
  isElevens: boolean; // 11s: hide ledger/trendline, show picked-hole tally + dots
  junkBets: JunkBetView[]; // side bets, per-bet per-player breakdown (empty if none)
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
  const junk = computeJunk(round); // side bets — separate, zero-sum ledger

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
        return { ledger: c.ledger, holeResults: c.results.map((rr) => ({ hole: rr.hole, deltas: rr.deltas, decided: rr.winner !== "push" })) };
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
      const pop = pops[p.id]?.[h.number] ?? 0;
      const net = gross === null ? null : gross - pop;
      const picked = entryByHole.get(h.number)?.elevenPicks?.[p.id] === true;
      return { hole: h.number, par: h.par, si: h.strokeIndex, gross, net, pop, picked };
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
      junk: junk.ledger[p.id] ?? 0,
    };
  });

  const hammerHoles = round.entries.filter((e) => (e.hammer ?? 0) > 0).map((e) => e.hole);
  const pressHoles = [...pressedHoles(round)].sort((a, b) => a - b);

  // Carry-in markers: a base-bet push rolls its pot to the NEXT played hole. That
  // recipient shows a gray "carried" dot; if the carried pot included a hammered
  // value (Carryover hammers on), it also shows a hollow purple hammer ring.
  const holeOrder = round.course.holes.map((h) => h.number).sort((a, b) => a - b);
  const carriedHoles: number[] = [];
  const carriedHammerHoles: number[] = [];
  for (const [h, c] of carryByHole(round)) {
    const next = holeOrder[holeOrder.indexOf(h) + 1];
    if (next === undefined) continue; // last hole's carry is dead
    if (c.orig + c.hammer > 0) carriedHoles.push(next); // base-bet carry landed here
    if (c.hammer > 0) carriedHammerHoles.push(next); // a hammered value carried in
  }

  // Individual presses, each settled over its own holes (same engine, read-only).
  const idxOf = new Map(holes.map((h, i) => [h.number, i]));
  const counts: Record<string, number> = {};
  const presses: PressInfo[] = hasPress
    ? eachPress(round, (sub): RunResult => {
        if (gt === "nassau") {
          return { ledger: nassauPressLedger(round, new Set(sub.entries.map((e) => e.hole))), holeResults: [] };
        }
        if (isWolf) {
          const c = computeRound(sub);
          return { ledger: c.ledger, holeResults: c.results.map((rr) => ({ hole: rr.hole, deltas: rr.deltas, decided: rr.winner !== "push" })) };
        }
        const g = computeBaseGame(sub);
        return { ledger: g.ledger, holeResults: g.holeResults };
      }).map((pr) => {
        const lbl =
          pr.scope === "full"
            ? "18"
            : gt === "sixes"
              ? pr.hole <= 6
                ? "F6"
                : pr.hole <= 12
                  ? "M6"
                  : "B6"
              : pr.hole <= 9
                ? "F9"
                : "B9";
        counts[lbl] = (counts[lbl] ?? 0) + 1;
        const k = counts[lbl];
        const money: Record<PlayerId, number[]> = {};
        for (const id of ids) money[id] = holes.map(() => 0);
        if (gt === "nassau") {
          const li = idxOf.get(pr.holes[pr.holes.length - 1] ?? -1);
          if (li !== undefined) for (const id of ids) money[id][li] = pr.result.ledger[id] ?? 0;
        } else {
          for (const hr of pr.result.holeResults) {
            const i = idxOf.get(hr.hole);
            if (i === undefined) continue;
            for (const id of ids) money[id][i] = hr.deltas[id] ?? 0;
          }
        }
        return { label: `${lbl}${k > 1 ? `×${k}` : ""}`, holes: pr.holes, money };
      })
    : [];

  const tees: ResultTee[] = (round.course.tees ?? []).map((t) => {
    const distanceByHole: Record<number, number | null> = {};
    holes.forEach((h, i) => {
      distanceByHole[h.number] = t.distances?.[i] ?? null;
    });
    return { name: t.name, color: t.color, distanceByHole };
  });

  return {
    players,
    betTypes,
    hammerHoles,
    pressHoles,
    carriedHoles,
    carriedHammerHoles,
    presses,
    tees,
    isElevens: gt === "elevens",
    junkBets: junk.bets,
  };
}
