// lib/carry.ts
// Per-hole carry breakdown for the Score-tab hole cards: when a hole pushes, how
// much is rolling forward, split into the NORMAL bet, the PRESS bet, and the
// HAMMER amplification — so the card can list them (grey / orange / purple) plus
// a total. Presentation only; reads the engines' carry, never changes settlement.

import { Round, computeRound } from "./wolf";
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

// Per-hole press carry — each press's own pending carry on the holes it covers,
// keyed by hole number. `carryOf(sub)` returns that sub-round's carry per hole.
function pressCarryByHole(
  round: Round,
  pushed: Set<number>,
  carryOf: (sub: Round) => Map<number, number>
): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of round.entries) {
    for (const scope of pressScopesOf(e)) {
      const holes = new Set(pressRange(round, e.hole, scope));
      if (holes.size === 0) continue;
      const sub = carryOf(pressSubRound(round, holes, carryChain(round, e.hole, pushed)));
      for (const [h, c] of sub) {
        if (!holes.has(h)) continue;
        out.set(h, (out.get(h) ?? 0) + c);
      }
    }
  }
  return out;
}

export function carryByHole(round: Round): Map<number, HoleCarry> {
  const out = new Map<number, HoleCarry>();
  const gt = gameTypeOf(round);

  if (gt === "wolf") {
    const withR = computeRound(round).results;
    const noByHole = new Map(computeRound(noHammer(round)).results.map((r) => [r.hole, r.carriedToNext]));
    const pushed = pushedFrom(round, withR.map((r) => ({ hole: r.hole, decided: r.winner !== "push" })));
    const carryOf = (sub: Round) =>
      new Map(computeRound(sub).results.map((r) => [r.hole, r.carriedToNext]));
    const press = pressCarryByHole(round, pushed, carryOf);
    for (const r of withR) {
      const orig = noByHole.get(r.hole) ?? 0;
      const hammer = r.carriedToNext - orig;
      const p = press.get(r.hole) ?? 0;
      const total = orig + hammer + p;
      if (total > 0) out.set(r.hole, { orig, hammer, press: p, total });
    }
    return out;
  }

  if (!CARRY_GAMES.has(gt)) return out;

  const baseWith = computeBaseGame(round).holeResults; // base bet, hammers in
  const baseNo = computeBaseGame(noHammer(round)).holeResults; // base bet, no hammers
  const noByHole = new Map(baseNo.map((r) => [r.hole, r.carry ?? 0]));

  const pushed = pushedFrom(round, baseWith);
  const carryOf = (sub: Round) =>
    new Map(computeBaseGame(sub).holeResults.map((r) => [r.hole, r.carry ?? 0]));
  const pressCarry = pressCarryByHole(round, pushed, carryOf);

  for (const r of baseWith) {
    const orig = noByHole.get(r.hole) ?? 0;
    const hammer = (r.carry ?? 0) - orig;
    const press = pressCarry.get(r.hole) ?? 0;
    const total = orig + hammer + press;
    if (total > 0) out.set(r.hole, { orig, hammer, press, total });
  }
  return out;
}
