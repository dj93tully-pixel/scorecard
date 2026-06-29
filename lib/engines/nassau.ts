// lib/engines/nassau.ts
// Nassau (net match play). A Nassau is THREE separate bets: the front 9, the
// back 9, and the overall 18. Each is its own match — whoever wins more holes
// (low net) over those holes wins that bet for the stake; an equal split pushes.
// A "$2 Nassau" sets each of the three bets to $2 (so up to $6 a pairing).
//
// To support 2–6 players we play it ROUND-ROBIN: every unordered pair plays a
// full Nassau (front/back/overall) against each other and the results sum into
// each player's ledger. For exactly two players this is a standard heads-up
// Nassau. Every bet is +stake / −stake / push, so the ledger stays zero-sum.
//
// Segments settle live off the holes scored so far (provisional match standing),
// which becomes the final result once every hole is in. Money is a per-segment
// (not per-hole) thing, so holeResults carry no per-hole deltas — the standings
// and the per-player Front/Back/Overall breakdown carry the money instead.

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";

type SegKey = "front" | "back" | "overall";

export function computeNassau(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const stake = settings.stake || 1; // $ per bet (front / back / overall)
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const holeNums = course.holes.map((h) => h.number);
  const segHoles: Record<SegKey, number[]> = {
    front: holeNums.filter((n) => n <= 9),
    back: holeNums.filter((n) => n >= 10),
    overall: holeNums,
  };
  const segKeys: SegKey[] = ["front", "back", "overall"];

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

  // Round-robin: each pair plays all three bets.
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      for (const key of segKeys) {
        if (segHoles[key].length === 0) continue;
        let aWon = 0;
        let bWon = 0;
        for (const n of segHoles[key]) {
          const na = netOn(a, n);
          const nb = netOn(b, n);
          if (na === null || nb === null) continue; // not both scored yet
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
