// lib/engines/skins.ts
// Skins (net) with per-player hammers. Each hole every player antes one skin's
// value; the lone lowest net wins the hole. Ties carry the skins forward.
//
// Per-player hammers (entry.skinActions):
//   "hammer"  — accepted a hammer: if this player loses the hole they pay ×2.
//   "double"  — double hammer: if this player loses they pay ×4.
//   "forfeit" — conceded: pays the single bet and is out of contention (can't
//               win, which can break a tie and hand the skin to the next-lowest).
//
// On a PUSH (the contenders tie), each forfeiter still owes their single bet —
// that money is held in the carry pot and paid to whoever wins the carry. To
// keep every settled hole exactly zero-sum, those forfeiter debts are deferred
// and applied on the hole the pot is finally won (an unwon pot at round end is
// simply void). With no actions set this is identical to plain Skins.

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
  let carry = 0; // tied holes (skins) waiting to be won
  let deferred: Record<PlayerId, number> = {}; // forfeiter debts riding the pot

  for (const h of course.holes) {
    const e = entryByHole.get(h.number);
    const deltas: Record<PlayerId, number> = {};
    for (const id of ids) deltas[id] = 0;

    const actions = e?.skinActions ?? {};
    const forfeited = (id: PlayerId) => actions[id] === "forfeit";
    // Loss multiplier when a non-winner pays: double 4×, hammer 2×, else 1×.
    const multOf = (id: PlayerId) =>
      actions[id] === "double" ? 4 : actions[id] === "hammer" ? 2 : 1;

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
      let pot = 0;
      // Current-hole non-winners pay value × skins × their multiplier.
      for (const id of ids) {
        if (id === w) continue;
        const owed = value * skins * multOf(id);
        deltas[id] -= owed;
        pot += owed;
      }
      // Forfeiter debts carried from earlier pushed holes come due now.
      let deferredTotal = 0;
      for (const id of Object.keys(deferred)) {
        deltas[id] -= deferred[id];
        deferredTotal += deferred[id];
      }
      deltas[w] += pot + deferredTotal;

      for (const id of ids) ledger[id] += deltas[id];
      skinsWon[w] += skins;
      carry = 0;
      deferred = {};
      const name = players.find((p) => p.id === w)?.name?.split(" ")[0] || "—";
      holeResults.push({
        hole: h.number,
        decided: true,
        detail: `${name} wins ${skins} skin${skins > 1 ? "s" : ""}`,
        deltas,
      });
    } else if (settings.carryover) {
      // Push: the skin carries, and each forfeiter's single bet joins the pot.
      carry += 1;
      for (const id of ids) {
        if (forfeited(id)) deferred[id] = (deferred[id] ?? 0) + value;
      }
      const potNow =
        value * carry + Object.values(deferred).reduce((s, v) => s + v, 0);
      // No money moves on the hole itself (forfeiter debts are deferred).
      holeResults.push({
        hole: h.number,
        decided: false,
        detail: `Push — $${potNow} carries`,
        deltas,
      });
    } else {
      // No carryover: a tied hole is dead (forfeiter concessions void too).
      holeResults.push({ hole: h.number, decided: false, detail: "Push", deltas });
    }
  }

  const stats: Record<PlayerId, Record<string, number>> = {};
  for (const id of ids) stats[id] = { skins: skinsWon[id] };
  return { ledger, pops, holeResults, stats };
}
