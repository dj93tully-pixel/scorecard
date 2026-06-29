// lib/engines/press.ts
// The press — shared across every game except 11s. A press opens a fresh,
// same-stake bet settled by the game's OWN rules over a set of remaining holes,
// running alongside the original. Two scopes per hole:
//   • "seg"  — the rest of this hole's segment (the nine, or the six in 666)
//   • "full" — the rest of the round (through the last hole)
//
// For per-hole-settled games the press is computed by RE-RUNNING the engine over
// just the pressed holes (a copy of the round with only those holes scored) and
// adding the resulting ledger — so carry resets within the press and any fixed
// rotation (Six-Six-Six) stays tied to the real hole numbers. Nassau settles its
// presses itself (match play per segment); 11s has no press.

import { Round, PlayerId } from "../wolf";
import { GameResult, GameHoleResult } from "./types";

export type PressScope = "seg" | "full";

/** Whether any press has been called in the round. */
export function hasAnyPress(round: Round): boolean {
  return round.entries.some((e) => (e.pressSeg ?? 0) > 0 || (e.pressFull ?? 0) > 0);
}

/** The set of holes covered by ANY press (the union of every press's range). */
export function pressedHoles(round: Round): Set<number> {
  const out = new Set<number>();
  for (const e of round.entries) {
    for (const { scope } of pressScopesOf(e)) {
      for (const h of pressRange(round, e.hole, scope)) out.add(h);
    }
  }
  return out;
}

/** How many presses cover each hole (summed counts) — for the ⚡×N badge. */
export function pressCountByHole(round: Round): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of round.entries) {
    for (const { scope, count } of pressScopesOf(e)) {
      for (const h of pressRange(round, e.hole, scope)) {
        out.set(h, (out.get(h) ?? 0) + count);
      }
    }
  }
  return out;
}

/** Hole numbers a press started on `hole` with `scope` covers. */
export function pressRange(round: Round, hole: number, scope: PressScope): number[] {
  const nums = round.course.holes.map((h) => h.number).sort((a, b) => a - b);
  if (nums.length === 0) return [];
  const maxHole = nums[nums.length - 1];
  let end: number;
  if (scope === "full") {
    end = maxHole;
  } else {
    const size = round.gameType === "sixes" ? 6 : 9;
    end = Math.min(Math.ceil(hole / size) * size, maxHole);
  }
  return nums.filter((n) => n >= hole && n <= end);
}

/** The press scopes flagged on a hole entry, with how many of each (stacked). */
export function pressScopesOf(e: {
  pressSeg?: number;
  pressFull?: number;
}): { scope: PressScope; count: number }[] {
  const out: { scope: PressScope; count: number }[] = [];
  if ((e.pressSeg ?? 0) > 0) out.push({ scope: "seg", count: e.pressSeg! });
  if ((e.pressFull ?? 0) > 0) out.push({ scope: "full", count: e.pressFull! });
  return out;
}

/**
 * A copy of the round scoped to a press's holes. The press is its own bet, so it
 * carries (or not) on the `pressCarryover` setting — independent of the base
 * bet's carryover.
 */
export function pressSubRound(round: Round, holes: Set<number>): Round {
  return {
    ...round,
    settings: {
      ...round.settings,
      carryover: round.settings.pressCarryover ?? true,
    },
    entries: round.entries.filter((x) => holes.has(x.hole)),
  };
}

/**
 * Total press money per player: for every flagged hole, re-settle the game over
 * the press's holes (via `computeLedger`) and sum the results. `computeLedger`
 * must be the RAW per-hole engine (not a press-wrapped one) to avoid recursion.
 */
export function computePressMoney(
  round: Round,
  computeLedger: (r: Round) => Record<PlayerId, number>
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const p of round.players) out[p.id] = 0;
  for (const e of round.entries) {
    for (const { scope, count } of pressScopesOf(e)) {
      const holes = new Set(pressRange(round, e.hole, scope));
      if (holes.size === 0) continue;
      const l = computeLedger(pressSubRound(round, holes));
      for (const p of round.players) out[p.id] += (l[p.id] ?? 0) * count;
    }
  }
  return out;
}

/**
 * Wrap a GameResult engine so per-hole presses add fresh same-stake bets. The
 * ledger becomes original + press, and each player's stats gain `original` and
 * `press` for the money breakdown.
 */
export function withPresses(
  round: Round,
  engine: (r: Round) => GameResult
): GameResult {
  const base = engine(round);
  const press = computePressMoney(round, (r) => engine(r).ledger);
  const ledger: Record<PlayerId, number> = {};
  const stats: Record<PlayerId, Record<string, number | string>> = {};
  for (const p of round.players) {
    const id = p.id;
    const original = base.ledger[id] ?? 0;
    ledger[id] = original + (press[id] ?? 0);
    stats[id] = { ...(base.stats[id] ?? {}), original, press: press[id] ?? 0 };
  }
  return { ledger, pops: base.pops, holeResults: base.holeResults, stats };
}

// Per-hole ledger shape both the GameResult engines and Wolf's computeRound can
// be adapted to, so presses can be decomposed for any game.
export interface RunResult {
  ledger: Record<PlayerId, number>;
  holeResults: {
    hole: number;
    deltas: Record<PlayerId, number>;
    detail?: string;
    decided?: boolean;
  }[];
}

/**
 * Split a round into its base bet and its press bets — each as a ledger + the
 * per-hole money — by re-running `run` over each press's holes. The press's
 * money lands only on the holes it covers (from where it started to where it
 * ends), so the Card tab can show original / press / total as separate views.
 */
export function decomposePresses(
  round: Round,
  run: (r: Round) => RunResult
): { base: RunResult; press: RunResult } {
  const ids = round.players.map((p) => p.id);
  const base = run(round);

  const pressLedger: Record<PlayerId, number> = {};
  for (const id of ids) pressLedger[id] = 0;
  const pressByHole = new Map<number, Record<PlayerId, number>>();

  for (const e of round.entries) {
    for (const { scope, count } of pressScopesOf(e)) {
      const holes = new Set(pressRange(round, e.hole, scope));
      if (holes.size === 0) continue;
      const r = run(pressSubRound(round, holes));
      for (const id of ids) pressLedger[id] += (r.ledger[id] ?? 0) * count;
      for (const hr of r.holeResults) {
        if (!holes.has(hr.hole)) continue;
        const acc =
          pressByHole.get(hr.hole) ??
          Object.fromEntries(ids.map((id) => [id, 0]));
        for (const id of ids) acc[id] = (acc[id] ?? 0) + (hr.deltas[id] ?? 0) * count;
        pressByHole.set(hr.hole, acc);
      }
    }
  }

  const pressHoleResults = round.course.holes.map((h) => {
    const deltas =
      pressByHole.get(h.number) ?? Object.fromEntries(ids.map((id) => [id, 0]));
    const anyMoney = ids.some((id) => (deltas[id] ?? 0) !== 0);
    return { hole: h.number, deltas, decided: anyMoney, detail: "" };
  });

  return { base, press: { ledger: pressLedger, holeResults: pressHoleResults } };
}

/**
 * Per-hole results with the base bet AND the press bets combined, so a score
 * tab's per-hole money note shows the total moved on that hole (original +
 * press), not just the original.
 */
export function combinedHoleResults(
  round: Round,
  run: (r: Round) => RunResult
): GameHoleResult[] {
  const { base, press } = decomposePresses(round, run);
  const pByHole = new Map(press.holeResults.map((r) => [r.hole, r.deltas]));
  return base.holeResults.map((hr) => {
    const pr = pByHole.get(hr.hole);
    const deltas = { ...hr.deltas };
    if (pr) for (const id of Object.keys(pr)) deltas[id] = (deltas[id] ?? 0) + (pr[id] ?? 0);
    return { hole: hr.hole, deltas, detail: hr.detail ?? "", decided: hr.decided ?? false };
  });
}

export interface PressEntry {
  hole: number; // where the press was started
  scope: PressScope;
  count: number; // stacked copies
  holes: number[]; // the holes it covers
  ledger: Record<PlayerId, number>; // its money (× count), zero-sum
}

/**
 * Every press as its own line item (for the Card tab's per-press breakdown).
 * `single(holes)` settles ONE copy of a press over those holes; listPresses
 * multiplies by the stacked count.
 */
export function listPresses(
  round: Round,
  single: (holes: Set<number>) => Record<PlayerId, number>
): PressEntry[] {
  const out: PressEntry[] = [];
  for (const e of round.entries) {
    for (const { scope, count } of pressScopesOf(e)) {
      const list = pressRange(round, e.hole, scope);
      const base = single(new Set(list));
      const ledger: Record<PlayerId, number> = {};
      for (const p of round.players) ledger[p.id] = (base[p.id] ?? 0) * count;
      out.push({ hole: e.hole, scope, count, holes: list, ledger });
    }
  }
  return out;
}

export interface PressSplit {
  original: number; // the base bet
  press: number; // every press combined
  total: number; // original + press
}

/** Pull a player's original / press / total out of a GameResult's stats. */
export function pressSplit(
  stats: Record<string, Record<string, number | string>> | undefined,
  pid: string
): PressSplit {
  const s = stats?.[pid] ?? {};
  const original = Number(s.original ?? 0);
  const press = Number(s.press ?? 0);
  return { original, press, total: original + press };
}
