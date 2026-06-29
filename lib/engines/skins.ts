// lib/engines/skins.ts
// Skins (net) with per-player hammers. Each hole every player antes one skin's
// value; the lone lowest net wins the hole. Ties carry the skins forward.
//
// Per-player hammers (entry.skinActions):
//   "hammer"  — accepted a hammer: if this player loses the hole they pay DOUBLE.
//   "forfeit" — conceded: pays the single bet and is out of contention (can't win,
//               which can also break a tie and hand the skin to the next-lowest).
// The winner collects exactly the sum of what the losers pay, so every decided
// hole is zero-sum. With no actions set this is identical to plain Skins.

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

    const actions = e?.skinActions ?? {};
    const forfeited = (id: PlayerId) => actions[id] === "forfeit";
    const accepted = (id: PlayerId) => actions[id] === "hammer";

    // Only non-forfeited players need a score to settle (forfeiters conceded).
    const contenders = ids.filter((id) => !forfeited(id));
    const allScored =
      !!e && contenders.length > 0 && contenders.every((id) => typeof e.grossScores[id] === "number");
    if (!allScored) {
      holeResults.push({ hole: h.number, decided: false, detail: "—", deltas });
      continue;
    }

    const net: Record<PlayerId, number> = {};
    for (const id of contenders) net[id] = e!.grossScores[id]! - (pops[id]?.[h.number] ?? 0);
    const best = Math.min(...contenders.map((id) => net[id]));
    const winners = contenders.filter((id) => net[id] === best);

    if (winners.length === 1) {
      const w = winners[0];
      const skins = carry + 1;
      // Each non-winner pays the skin value × skins, doubled if they accepted.
      let pot = 0;
      for (const id of ids) {
        if (id === w) continue;
        const owed = value * skins * (accepted(id) ? 2 : 1);
        deltas[id] = -owed;
        pot += owed;
      }
      deltas[w] = pot;
      for (const id of ids) ledger[id] += deltas[id];
      skinsWon[w] += skins;
      carry = 0;
      const name = players.find((p) => p.id === w)?.name?.split(" ")[0] || "—";
      holeResults.push({
        hole: h.number,
        decided: true,
        detail: `${name} wins ${skins} skin${skins > 1 ? "s" : ""}`,
        deltas,
      });
    } else if (settings.carryover) {
      carry += 1;
      holeResults.push({
        hole: h.number,
        decided: false,
        detail: `Push — $${value * carry} carries`,
        deltas,
      });
    } else {
      holeResults.push({ hole: h.number, decided: false, detail: "Push", deltas });
    }
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { skins: skinsWon[id] };
  return { ledger, pops, holeResults, stats };
}
