// lib/carry.ts
// Per-hole carry breakdown for the Score-tab hole cards: when a hole pushes, how
// much is rolling forward, split into the NORMAL bet, the PRESS bet, and the
// HAMMER amplification — so the card can list them (grey / orange / purple) plus
// a total. Presentation only; reads the engines' carry, never changes settlement.

import { Round, PlayerId, computeRound } from "./wolf";
import { computeBaseGame, gameTypeOf } from "./gametypes";
import {
  pressSubRound,
  pressRange,
  pressScopesOf,
  pushedFrom,
  carryChain,
  decomposePresses,
  RunResult,
} from "./engines/press";

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

// Highest hole number in the round — the base bet's carry on this hole is dead
// (the round ends, nothing receives it).
const lastHole = (round: Round): number =>
  round.course.holes.reduce((m, h) => Math.max(m, h.number), 0);

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
      const range = pressRange(round, e.hole, scope);
      if (range.length === 0) continue;
      const holes = new Set(range);
      // The carry on a press's FINAL hole is dead — the press ends there, so it
      // never reaches a next hole (e.g. a 9-hole press that ends after hole 9).
      const last = range[range.length - 1];
      const sub = carryOf(pressSubRound(round, holes, carryChain(round, e.hole, pushed)));
      for (const [h, c] of sub) {
        if (!holes.has(h) || h === last) continue;
        out.set(h, (out.get(h) ?? 0) + c);
      }
    }
  }
  return out;
}

export function carryByHole(round: Round): Map<number, HoleCarry> {
  const out = new Map<number, HoleCarry>();
  const gt = gameTypeOf(round);

  const end = lastHole(round);

  if (gt === "wolf") {
    const withR = computeRound(round).results;
    const noByHole = new Map(computeRound(noHammer(round)).results.map((r) => [r.hole, r.carriedToNext]));
    const pushed = pushedFrom(round, withR.map((r) => ({ hole: r.hole, decided: r.winner !== "push" })));
    const carryOf = (sub: Round) =>
      new Map(computeRound(sub).results.map((r) => [r.hole, r.carriedToNext]));
    const press = pressCarryByHole(round, pushed, carryOf);
    for (const r of withR) {
      // Base carry on the final hole is dead — the round ends there.
      const orig = r.hole === end ? 0 : noByHole.get(r.hole) ?? 0;
      const hammer = r.hole === end ? 0 : r.carriedToNext - orig;
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
    // Base carry on the final hole is dead — the round ends there.
    const orig = r.hole === end ? 0 : noByHole.get(r.hole) ?? 0;
    const hammer = r.hole === end ? 0 : (r.carry ?? 0) - orig;
    const press = pressCarry.get(r.hole) ?? 0;
    const total = orig + hammer + press;
    if (total > 0) out.set(r.hole, { orig, hammer, press, total });
  }
  return out;
}

// Per-hole WON amount — what the winning side collects on a DECIDED hole, split
// the same way as the carry (normal / press / hammer). Mirrors carryByHole but
// sums the positive per-hole deltas instead of the carry rolling forward, so the
// hole card can show the win as grey / orange / purple badges. Segment/total
// games (Nassau, 11s) settle off the per-hole board, so they get no entries.
export function wonByHole(round: Round): Map<number, HoleCarry> {
  const out = new Map<number, HoleCarry>();
  const gt = gameTypeOf(round);
  if (gt === "nassau" || gt === "elevens") return out;

  // Amount collected by the winners on a hole = sum of the positive deltas.
  const won = (deltas: Record<PlayerId, number>) =>
    Object.values(deltas).reduce((s, v) => (v > 0 ? s + v : s), 0);

  const run = (r: Round): RunResult => {
    if (gt === "wolf") {
      const c = computeRound(r);
      return {
        ledger: c.ledger,
        holeResults: c.results.map((rr) => ({ hole: rr.hole, deltas: rr.deltas, decided: rr.winner !== "push" })),
      };
    }
    const g = computeBaseGame(r);
    return { ledger: g.ledger, holeResults: g.holeResults };
  };

  const withH = run(round);
  const noByHole = new Map(run(noHammer(round)).holeResults.map((r) => [r.hole, r.deltas]));
  const pressByHole = new Map(decomposePresses(round, run).press.holeResults.map((r) => [r.hole, r.deltas]));

  for (const r of withH.holeResults) {
    const orig = won(noByHole.get(r.hole) ?? {});
    const hammer = Math.max(0, won(r.deltas) - orig); // extra the hammer adds
    const press = won(pressByHole.get(r.hole) ?? {});
    const total = orig + hammer + press;
    if (total > 0) out.set(r.hole, { orig, hammer, press, total });
  }
  return out;
}
