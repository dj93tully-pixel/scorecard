// lib/engines/nassau.ts
// Nassau (net match play). A Nassau is THREE separate bets: the front 9, the
// back 9, and the overall 18. Each is its own match — whoever wins more holes
// (low net) over those holes wins that bet for the stake; an equal split pushes.
// A "$2 Nassau" sets each of the three bets to $2 (so up to $6 a side).
//
// Two formats (settings.nassauFormat):
//  • "teams"  — two sides A/B (any split: 1v1, 1v3, 2v2, 2v3…). Each hole is
//    decided by each side's BEST net ball; the segment stake is won by the side
//    and split evenly within it. Supports the PRESS (see below).
//  • "robin"  — everyone vs everyone: every pair plays its own full Nassau and
//    the results sum into the ledger. (No press — it needs two fixed sides.)
//
// THE PRESS (teams only): when a side falls behind it can "press" — a fresh,
// same-stake match-play bet over the REMAINING holes of that segment, running
// alongside the original. It's flagged per hole (entry.nassauPress) and starts
// on that hole. Presses stack. Settlement is symmetric match play over the
// pressed holes, so the bet only needs to know it exists, not who called it.
//
// Money is tracked in two buckets so the UI can show original vs press:
//   • base.{front,back,overall} — the three original bets
//   • press                     — every press bet combined
// stats exposes those plus `original` (the 3 base bets) so the standings, the
// Totals row, and the Scores-tab summary can all show original / press / total.
// Every bet is +stake / −stake / push, so the ledger stays zero-sum. holeResults
// carry no per-hole deltas (money is per-segment, not per-hole).

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";
import { splitTeams } from "./teams";
import { pressRange, pressScopesOf } from "./press";

type SegKey = "front" | "back" | "overall";

/**
 * One Nassau press's money over a set of holes — a single better-ball (teams)
 * match: most holes won takes the stake, split within the side. Robin format has
 * no press. Used for the Card tab's per-press sub-views.
 */
export function nassauPressLedger(
  round: Round,
  holes: Set<number>
): Record<PlayerId, number> {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const ledger: Record<PlayerId, number> = {};
  for (const id of ids) ledger[id] = 0;
  if ((settings.nassauFormat ?? "teams") !== "teams") return ledger;
  const { A, B } = splitTeams(round);
  if (A.length === 0 || B.length === 0) return ledger;

  const pops = computePops(players, course, settings.handicapMode);
  const stake = settings.stake || 1;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
  const netOn = (id: PlayerId, hole: number): number | null => {
    const g = entryByHole.get(hole)?.grossScores[id];
    return typeof g === "number" ? g - (pops[id]?.[hole] ?? 0) : null;
  };
  const teamNet = (team: PlayerId[], hole: number): number | null => {
    const nets = team.map((id) => netOn(id, hole)).filter((n): n is number => n !== null);
    return nets.length ? Math.min(...nets) : null;
  };

  let aWon = 0;
  let bWon = 0;
  for (const n of holes) {
    const na = teamNet(A, n);
    const nb = teamNet(B, n);
    if (na === null || nb === null) continue;
    if (na < nb) aWon++;
    else if (nb < na) bWon++;
  }
  if (aWon === bWon) return ledger;
  const win = aWon > bWon ? A : B;
  const lose = aWon > bWon ? B : A;
  for (const id of win) ledger[id] += stake / win.length;
  for (const id of lose) ledger[id] -= stake / lose.length;
  return ledger;
}

export function computeNassau(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const stake = settings.stake || 1; // $ per bet (front / back / overall)
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const holeNums = course.holes.map((h) => h.number);
  const frontNums = holeNums.filter((n) => n <= 9);
  const backNums = holeNums.filter((n) => n >= 10);

  const ledger: Record<PlayerId, number> = {};
  const base: Record<PlayerId, Record<SegKey, number>> = {};
  const press: Record<PlayerId, number> = {};
  // Same press money as `press`, but split by which segment's press it was — a
  // "seg" press on the front/back nine, or a "full" press (overall). Presentation
  // only: feeds the Card tab's Front/Back/Overall × Original/Press/Total matrix.
  const pressSeg: Record<PlayerId, Record<SegKey, number>> = {};
  for (const id of ids) {
    ledger[id] = 0;
    base[id] = { front: 0, back: 0, overall: 0 };
    press[id] = 0;
    pressSeg[id] = { front: 0, back: 0, overall: 0 };
  }

  const netOn = (id: PlayerId, hole: number): number | null => {
    const g = entryByHole.get(hole)?.grossScores[id];
    return typeof g === "number" ? g - (pops[id]?.[hole] ?? 0) : null;
  };

  const format = settings.nassauFormat ?? "teams";

  if (format === "robin") {
    // Everyone vs everyone: each pair plays all three (base) bets.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        const segHoles: Record<SegKey, number[]> = {
          front: frontNums,
          back: backNums,
          overall: holeNums,
        };
        for (const key of ["front", "back", "overall"] as SegKey[]) {
          if (segHoles[key].length === 0) continue;
          let aWon = 0;
          let bWon = 0;
          for (const n of segHoles[key]) {
            const na = netOn(a, n);
            const nb = netOn(b, n);
            if (na === null || nb === null) continue;
            if (na < nb) aWon++;
            else if (nb < na) bWon++;
          }
          if (aWon === bWon) continue; // all-square → push
          const winner = aWon > bWon ? a : b;
          const loser = aWon > bWon ? b : a;
          ledger[winner] += stake;
          ledger[loser] -= stake;
          base[winner][key] += stake;
          base[loser][key] -= stake;
        }
      }
    }
  } else {
    // Teams: two sides, better-ball match play.
    const { A, B } = splitTeams(round);
    if (A.length > 0 && B.length > 0) {
      const teamNet = (team: PlayerId[], hole: number): number | null => {
        const nets = team
          .map((id) => netOn(id, hole))
          .filter((n): n is number => n !== null);
        return nets.length ? Math.min(...nets) : null;
      };

      // Settle one match-play bet over `holeList`; winning side splits +stake,
      // losing side splits −stake. `apply(id, amount)` buckets the money (base
      // segment or press) for the breakdown; the ledger is updated here.
      const settleBet = (
        holeList: number[],
        apply: (id: PlayerId, amount: number) => void
      ) => {
        let aWon = 0;
        let bWon = 0;
        for (const n of holeList) {
          const na = teamNet(A, n);
          const nb = teamNet(B, n);
          if (na === null || nb === null) continue;
          if (na < nb) aWon++;
          else if (nb < na) bWon++;
        }
        if (aWon === bWon) return; // all-square → push
        const win = aWon > bWon ? A : B;
        const lose = aWon > bWon ? B : A;
        for (const id of win) {
          const amt = stake / win.length;
          ledger[id] += amt;
          apply(id, amt);
        }
        for (const id of lose) {
          const amt = -stake / lose.length;
          ledger[id] += amt;
          apply(id, amt);
        }
      };

      // The three base bets.
      settleBet(frontNums, (id, amt) => (base[id].front += amt));
      settleBet(backNums, (id, amt) => (base[id].back += amt));
      settleBet(holeNums, (id, amt) => (base[id].overall += amt));

      // Presses: each flagged hole opens a fresh match-play bet over the rest of
      // its nine ("seg") and/or the rest of the round ("full"), into `press`. We
      // also bucket it by segment (front/back for "seg", overall for "full").
      for (const e of round.entries) {
        for (const scope of pressScopesOf(e)) {
          const seg: SegKey = scope === "full" ? "overall" : e.hole <= 9 ? "front" : "back";
          settleBet(pressRange(round, e.hole, scope), (id, amt) => {
            press[id] += amt;
            pressSeg[id][seg] += amt;
          });
        }
      }
    }
  }

  // Money is per-segment, not per-hole, so no per-hole deltas here.
  const holeResults: GameHoleResult[] = course.holes.map((h) => {
    const deltas: Record<PlayerId, number> = {};
    for (const id of ids) deltas[id] = 0;
    return { hole: h.number, decided: false, detail: "", deltas };
  });

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) {
    const original = base[id].front + base[id].back + base[id].overall;
    stats[id] = {
      front: base[id].front,
      back: base[id].back,
      overall: base[id].overall,
      original,
      press: press[id],
      pressFront: pressSeg[id].front,
      pressBack: pressSeg[id].back,
      pressOverall: pressSeg[id].overall,
    };
  }
  return { ledger, pops, holeResults, stats };
}
