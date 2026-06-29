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
// Every bet is +stake / −stake / push, so the ledger stays zero-sum. Money is a
// per-segment thing, so holeResults carry no per-hole deltas — the standings and
// the per-player Front/Back/Overall breakdown carry the money instead.

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";
import { splitTeams } from "./teams";

type SegKey = "front" | "back" | "overall";

export function computeNassau(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const stake = settings.stake || 1; // $ per bet (front / back / overall)
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const holeNums = course.holes.map((h) => h.number);
  const frontNums = holeNums.filter((n) => n <= 9);
  const backNums = holeNums.filter((n) => n >= 10);
  const segHoles: Record<SegKey, number[]> = {
    front: frontNums,
    back: backNums,
    overall: holeNums,
  };

  const ledger: Record<PlayerId, number> = {};
  const seg: Record<PlayerId, Record<SegKey, number>> = {};
  for (const id of ids) {
    ledger[id] = 0;
    seg[id] = { front: 0, back: 0, overall: 0 };
  }

  const netOn = (id: PlayerId, hole: number): number | null => {
    const g = entryByHole.get(hole)?.grossScores[id];
    return typeof g === "number" ? g - (pops[id]?.[hole] ?? 0) : null;
  };

  const format = settings.nassauFormat ?? "teams";

  if (format === "robin") {
    // Everyone vs everyone: each pair plays all three bets.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
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
          seg[winner][key] += stake;
          seg[loser][key] -= stake;
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
      // losing side splits −stake; the money also tallies under `key` for the
      // Front/Back/Overall breakdown.
      const settleBet = (holeList: number[], key: SegKey) => {
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
          ledger[id] += stake / win.length;
          seg[id][key] += stake / win.length;
        }
        for (const id of lose) {
          ledger[id] -= stake / lose.length;
          seg[id][key] -= stake / lose.length;
        }
      };

      // The three base bets.
      settleBet(frontNums, "front");
      settleBet(backNums, "back");
      settleBet(holeNums, "overall");

      // Presses: each flagged hole opens a fresh bet over the remaining holes of
      // that hole's segment (front or back), tallied under that segment.
      for (const n of holeNums) {
        if (!entryByHole.get(n)?.nassauPress) continue;
        const inFront = n <= 9;
        const key: SegKey = inFront ? "front" : "back";
        const pressHoles = (inFront ? frontNums : backNums).filter((h) => h >= n);
        settleBet(pressHoles, key);
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
    stats[id] = {
      front: seg[id].front,
      back: seg[id].back,
      overall: seg[id].overall,
    };
  }
  return { ledger, pops, holeResults, stats };
}
