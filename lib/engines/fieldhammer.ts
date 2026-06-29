// lib/engines/fieldhammer.ts
// GameResult adapter for Field Hammer: round-robin skins + hammer-the-field. The
// money math lives in the pure lib/fieldHammer engine; this just feeds it each
// hole (gross scores + pops from the existing pops engine + per-pairing state)
// and threads the carry, producing the standard GameResult the Card view uses.

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";
import { settleHole, toPairStates, PairKey, LivePairings } from "../fieldHammer";

export function computeFieldHammer(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const popsGrid = computePops(players, course, settings.handicapMode);
  const baseStake = settings.stake || 1;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const ledger: Record<PlayerId, number> = {};
  for (const id of ids) ledger[id] = 0;

  const holeResults: GameHoleResult[] = [];
  let carry: Record<PairKey, number> = {};

  for (const h of course.holes) {
    const e = entryByHole.get(h.number);
    const pops = Object.fromEntries(ids.map((id) => [id, popsGrid[id]?.[h.number] ?? 0]));
    const pairings = toPairStates((e?.fhPairings ?? {}) as LivePairings);
    const r = settleHole({
      players: ids,
      grossScores: e?.grossScores ?? {},
      pops,
      pairings,
      baseStake,
      carryIn: carry,
      carryTies: settings.carryover,
    });
    for (const id of ids) ledger[id] += r.deltas[id];
    carry = r.carryOut;
    const anyMoney = ids.some((id) => r.deltas[id] !== 0);
    holeResults.push({ hole: h.number, decided: anyMoney, detail: "", deltas: r.deltas });
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = {};
  return { ledger, pops: popsGrid, holeResults, stats };
}
