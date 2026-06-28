// lib/engines/skins.ts
// Skins (net). Each hole every player antes one skin's value; the lone lowest net
// score wins the hole. Ties carry the skins forward to the next decided hole.
// Money: the winner collects `value × skins` from EACH other player, so every
// decided hole is exactly zero-sum and tied holes that are never won cost nobody.

import { Round, PlayerId, computePops } from "../wolf";
import { GameResult, GameHoleResult } from "./types";

export function computeSkins(round: Round): GameResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);
  const value = settings.skinValue && settings.skinValue > 0 ? settings.skinValue : 1;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const ledger: Record<PlayerId, number> = {};
  const skinsWon: Record<PlayerId, number> = {};
  for (const id of ids) {
    ledger[id] = 0;
    skinsWon[id] = 0;
  }

  const holeResults: GameHoleResult[] = [];
  let carry = 0; // tied holes accumulated, waiting to be won

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
    const best = Math.min(...ids.map((id) => net[id]));
    const winners = ids.filter((id) => net[id] === best);

    // Hammer multiplies the money in play on the hole (1→1×, 1→2×, 2→4×).
    const hammerMult = 2 ** Math.max(0, Math.floor(e!.hammer ?? 0));

    if (winners.length === 1) {
      const w = winners[0];
      const skins = carry + 1;
      for (const id of ids) {
        const raw = id === w ? value * skins * (ids.length - 1) : -value * skins;
        deltas[id] = raw * hammerMult;
        ledger[id] += deltas[id];
      }
      skinsWon[w] += skins;
      carry = 0;
      const name = players.find((p) => p.id === w)?.name || "—";
      holeResults.push({
        hole: h.number,
        decided: true,
        detail: `${name} wins ${skins} skin${skins > 1 ? "s" : ""} · net ${best}`,
        deltas,
      });
    } else {
      carry += 1;
      // Skins riding to the next hole: one skin's value per carried hole.
      holeResults.push({
        hole: h.number,
        decided: false,
        detail: `Push — $${value * carry} carries`,
        deltas,
      });
    }
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { skins: skinsWon[id] };
  return { ledger, pops, holeResults, stats };
}
