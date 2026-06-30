// lib/carry.ts
// Per-hole carry breakdown for the Score-tab hole cards: when a hole pushes, how
// much is rolling forward, split into the NORMAL bet, the PRESS bet, and the
// HAMMER amplification — so the card can list them (grey / orange / purple) plus
// a total. Presentation only; reads the engines' carry, never changes settlement.

import { Round } from "./wolf";
import { computeBaseGame, gameTypeOf } from "./gametypes";
import { pressSubRound, pressRange, pressScopesOf, pushedFrom, carryChain } from "./engines/press";

export interface HoleCarry {
  orig: number; // normal (un-hammered base) carry
  press: number; // press bet carry
  hammer: number; // extra carry from hammering the base bet
  total: number; // orig + press + hammer
}

const CARRY_GAMES = new Set(["skins", "bestball", "sixes"]);
const noHammer = (round: Round): Round => ({
  ...round,
  entries: round.entries.map((e) => ({ ...e, hammer: 0 })),
});

export function carryByHole(round: Round): Map<number, HoleCarry> {
  const out = new Map<number, HoleCarry>();
  if (!CARRY_GAMES.has(gameTypeOf(round))) return out; // Wolf handled in its own tab

  const baseWith = computeBaseGame(round).holeResults; // base bet, hammers in
  const baseNo = computeBaseGame(noHammer(round)).holeResults; // base bet, no hammers
  const noByHole = new Map(baseNo.map((r) => [r.hole, r.carry ?? 0]));

  // Press carry per hole — each press's own pending carry on that hole.
  const pressCarry = new Map<number, number>();
  const pushed = pushedFrom(round, baseWith);
  for (const e of round.entries) {
    for (const scope of pressScopesOf(e)) {
      const holes = new Set(pressRange(round, e.hole, scope));
      if (holes.size === 0) continue;
      const sub = computeBaseGame(
        pressSubRound(round, holes, carryChain(round, e.hole, pushed))
      ).holeResults;
      for (const r of sub) {
        if (!holes.has(r.hole)) continue;
        pressCarry.set(r.hole, (pressCarry.get(r.hole) ?? 0) + (r.carry ?? 0));
      }
    }
  }

  for (const r of baseWith) {
    const withC = r.carry ?? 0;
    const orig = noByHole.get(r.hole) ?? 0;
    const hammer = withC - orig;
    const press = pressCarry.get(r.hole) ?? 0;
    const total = orig + hammer + press;
    if (total > 0) out.set(r.hole, { orig, hammer, press, total });
  }
  return out;
}
