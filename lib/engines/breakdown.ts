// lib/engines/breakdown.ts
// Splits a player's money into Original (base, no hammer) / Press / Hammer for
// the Card tab's per-player breakdown matrix, bucketed by nine (Front 1–9, Back
// 10–18). Presentation only: it re-runs the SAME engine with hammers zeroed to
// isolate the hammer money, and reuses decomposePresses for the press money, so
// no settlement/scoring changes. The columns reconcile: orig + press + hammer =
// the player's full total, both per nine and overall.
//
// Total/segment games that carry no per-hole money (Nassau, 11s) don't go
// through here — the caller builds their rows from the engine stats / ledger.

import { Round, PlayerId } from "../wolf";
import { GameHoleResult } from "./types";
import { decomposePresses, RunResult } from "./press";

export interface SegBreak {
  label: string;
  orig: number;
  press: number;
  hammer: number;
}

export interface BetBreakdown {
  segs: Record<PlayerId, SegBreak[]>; // Front / Back rows per player
  orig: Record<PlayerId, number>; // grand totals — the matrix Total row
  press: Record<PlayerId, number>;
  hammer: Record<PlayerId, number>;
  hasHammer: boolean;
  hammerResults: GameHoleResult[]; // per-hole hammer deltas (for the hammer view)
}

const zeroHammer = (round: Round): Round => ({
  ...round,
  entries: round.entries.map((e) => ({ ...e, hammer: 0 })),
});

export function segBreakdown(round: Round, run: (r: Round) => RunResult): BetBreakdown {
  const ids = round.players.map((p) => p.id);
  const withH = run(round); // base bet, hammers in
  const noH = run(zeroHammer(round)); // base bet, hammers removed
  const { press } = decomposePresses(round, run); // the press bets

  const withByHole = new Map(withH.holeResults.map((r) => [r.hole, r.deltas]));
  const noByHole = new Map(noH.holeResults.map((r) => [r.hole, r.deltas]));
  const pressByHole = new Map(press.holeResults.map((r) => [r.hole, r.deltas]));

  const segs: Record<PlayerId, SegBreak[]> = {};
  const orig: Record<PlayerId, number> = {};
  const pressTot: Record<PlayerId, number> = {};
  const hammerTot: Record<PlayerId, number> = {};
  for (const id of ids) {
    segs[id] = [];
    orig[id] = 0;
    pressTot[id] = 0;
    hammerTot[id] = 0;
  }

  const nine = (label: string, lo: number, hi: number) => {
    const per: Record<PlayerId, SegBreak> = {};
    for (const id of ids) per[id] = { label, orig: 0, press: 0, hammer: 0 };
    for (const h of round.course.holes) {
      if (h.number < lo || h.number > hi) continue;
      const w = withByHole.get(h.number);
      const n = noByHole.get(h.number);
      const p = pressByHole.get(h.number);
      for (const id of ids) {
        const o = n?.[id] ?? 0;
        per[id].orig += o;
        per[id].hammer += (w?.[id] ?? 0) - o; // hammer = with − without
        per[id].press += p?.[id] ?? 0;
      }
    }
    for (const id of ids) {
      segs[id].push(per[id]);
      orig[id] += per[id].orig;
      pressTot[id] += per[id].press;
      hammerTot[id] += per[id].hammer;
    }
  };

  nine("Front", 1, 9);
  nine("Back", 10, 18);

  const hammerResults: GameHoleResult[] = round.course.holes.map((h) => {
    const w = withByHole.get(h.number);
    const n = noByHole.get(h.number);
    const deltas: Record<PlayerId, number> = {};
    let any = false;
    for (const id of ids) {
      const v = (w?.[id] ?? 0) - (n?.[id] ?? 0);
      deltas[id] = v;
      if (v !== 0) any = true;
    }
    return { hole: h.number, deltas, decided: any, detail: "" };
  });

  const hasHammer = round.entries.some((e) => (e.hammer ?? 0) > 0);
  return { segs, orig, press: pressTot, hammer: hammerTot, hasHammer, hammerResults };
}
