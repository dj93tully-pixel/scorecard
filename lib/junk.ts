// lib/junk.ts
// Side bets ("junk") — small wagers that ride ON TOP of whatever main game is
// being played (Wolf, Skins, Stableford, anything). Fully independent of the
// main engines: a separate, always zero-sum ledger that gets folded into the
// settle-up. Three settlement archetypes cover the common bets:
//
//   • pot    — per occurrence: each player who earns it collects the stake from
//              everyone who didn't (birdies, eagles, sandies, barkies). If
//              everyone earns it, it washes.
//   • carry  — skins-style: one winner per eligible hole takes the pot; a hole
//              with no clear winner carries the value forward, doubling the next
//              payout (greenies / closest-to-pin on the par 3s).
//   • holder — hold-the-token: only the LAST player to trigger it over the round
//              pays everyone at the end (the snake — last 3-putt holds it).
//
// Auto bets (birdies/eagles) are derived from the score; the rest are manual taps
// stored per player per hole in entry.junk. Gross by default; `net` flips the
// auto bets to net (pops applied). Manual bets are inherently gross achievements.

import { Round, RoundSettings, PlayerId, JunkSetting, computePops } from "./wolf";

export type JunkSettle = "pot" | "carry" | "holder";

export interface JunkType {
  id: string;
  label: string;
  /** UI grouping so birdie/eagle and sandie/barkie sit together in Setup. */
  group: string;
  groupLabel: string;
  detect: "auto" | "manual";
  settle: JunkSettle;
  /** Only eligible on par 3s (greenies / KP). */
  par3Only?: boolean;
  defaultValue: number;
  blurb: string;
}

export const JUNK_TYPES: JunkType[] = [
  {
    id: "birdie",
    label: "Birdie",
    group: "birdies",
    groupLabel: "Birdie / eagle pots",
    detect: "auto",
    settle: "pot",
    defaultValue: 2,
    blurb: "One under par — collected from everyone who didn't make it.",
  },
  {
    id: "eagle",
    label: "Eagle",
    group: "birdies",
    groupLabel: "Birdie / eagle pots",
    detect: "auto",
    settle: "pot",
    defaultValue: 5,
    blurb: "Two under or better — collected from everyone who didn't.",
  },
  {
    id: "greenie",
    label: "Greenie / KP",
    group: "greenie",
    groupLabel: "Greenies (par 3s)",
    detect: "manual",
    settle: "carry",
    par3Only: true,
    defaultValue: 2,
    blurb: "Closest to the pin on a par 3; carries to the next par 3 if unclaimed.",
  },
  {
    id: "sandie",
    label: "Sandie",
    group: "sandie",
    groupLabel: "Sandies / barkies",
    detect: "manual",
    settle: "pot",
    defaultValue: 2,
    blurb: "Par or better after being in a bunker.",
  },
  {
    id: "barkie",
    label: "Barkie",
    group: "sandie",
    groupLabel: "Sandies / barkies",
    detect: "manual",
    settle: "pot",
    defaultValue: 2,
    blurb: "Par or better after hitting a tree.",
  },
  {
    id: "snake",
    label: "Snake",
    group: "snake",
    groupLabel: "Snake (3-putt)",
    detect: "manual",
    settle: "holder",
    defaultValue: 2,
    blurb: "Three-putt. The last player holding the snake pays everyone.",
  },
];

const TYPE_BY_ID = new Map(JUNK_TYPES.map((t) => [t.id, t]));

export function junkTypeOf(id: string): JunkType | undefined {
  return TYPE_BY_ID.get(id);
}

/** Whether any side bet is enabled. */
export function junkEnabled(settings: RoundSettings): boolean {
  return (settings.junk ?? []).length > 0;
}

/** The enabled config for a junk id, or undefined if off. */
export function junkConfig(settings: RoundSettings, id: string): JunkSetting | undefined {
  return (settings.junk ?? []).find((j) => j.id === id);
}

/**
 * The MANUAL junk bets that are enabled AND eligible to be tapped on a hole of
 * this par (par-3-only bets are filtered out elsewhere) — drives the scoring
 * chips. Auto bets (birdies) need no tap, so they're excluded here.
 */
export function manualJunkForHole(settings: RoundSettings, par: number | null): JunkType[] {
  const on = new Set((settings.junk ?? []).map((j) => j.id));
  return JUNK_TYPES.filter(
    (t) => t.detect === "manual" && on.has(t.id) && (!t.par3Only || par === 3)
  );
}

/**
 * Toggle a player's manual junk flag on a hole, returning the next junk map.
 * `single` (greenies) clears the bet from everyone else first — only one winner.
 */
export function toggleJunkFlag(
  current: Record<PlayerId, string[]> | undefined,
  allIds: PlayerId[],
  betId: string,
  pid: PlayerId,
  single: boolean
): Record<PlayerId, string[]> {
  const next: Record<PlayerId, string[]> = {};
  for (const id of allIds) next[id] = [...(current?.[id] ?? [])];
  const had = next[pid].includes(betId);
  if (single) {
    for (const id of allIds) next[id] = next[id].filter((x) => x !== betId);
  }
  if (had) {
    next[pid] = next[pid].filter((x) => x !== betId);
  } else {
    next[pid] = [...next[pid].filter((x) => x !== betId), betId];
  }
  // Drop empty arrays to keep the stored map tidy.
  for (const id of allIds) if (next[id].length === 0) delete next[id];
  return next;
}

// ── Engine ───────────────────────────────────────────────────────────────────

export interface JunkBetView {
  id: string;
  label: string;
  settle: JunkSettle;
  /** Money per player for this bet alone; sums to 0. */
  total: Record<PlayerId, number>;
  /** Holes where the bet was earned (for the breakdown); player ids per hole. */
  events: { hole: number; players: PlayerId[] }[];
}

export interface JunkResult {
  /** Combined junk money per player; sums to 0. */
  ledger: Record<PlayerId, number>;
  /** Per-bet breakdown for the Side-bets card. */
  bets: JunkBetView[];
}

export function computeJunk(round: Round): JunkResult {
  const { players, course, settings } = round;
  const ids = players.map((p) => p.id);
  const ledger: Record<PlayerId, number> = {};
  for (const id of ids) ledger[id] = 0;

  const configs = settings.junk ?? [];
  if (configs.length === 0) return { ledger, bets: [] };

  const pops = computePops(players, course, settings.handicapMode);
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  // Players who earn `type` on a hole (auto = from the score; manual = flags).
  const earnersOn = (type: JunkType, cfg: JunkSetting, holeNum: number, par: number): PlayerId[] => {
    const e = entryByHole.get(holeNum);
    if (!e) return [];
    if (type.detect === "auto") {
      const out: PlayerId[] = [];
      for (const id of ids) {
        const g = e.grossScores[id];
        if (typeof g !== "number") continue;
        const score = cfg.net ? g - (pops[id]?.[holeNum] ?? 0) : g;
        const diff = score - par;
        if (type.id === "birdie" && diff === -1) out.push(id);
        else if (type.id === "eagle" && diff <= -2) out.push(id);
      }
      return out;
    }
    return ids.filter((id) => (e.junk?.[id] ?? []).includes(type.id));
  };

  const bets: JunkBetView[] = [];

  for (const cfg of configs) {
    const type = TYPE_BY_ID.get(cfg.id);
    if (!type) continue;
    const value = cfg.value || 0;
    const total: Record<PlayerId, number> = {};
    for (const id of ids) total[id] = 0;
    const events: { hole: number; players: PlayerId[] }[] = [];

    if (type.settle === "pot") {
      for (const h of course.holes) {
        if (type.par3Only && h.par !== 3) continue;
        const E = earnersOn(type, cfg, h.number, h.par);
        if (E.length === 0) continue;
        const O = ids.filter((id) => !E.includes(id));
        if (O.length === 0) continue; // everyone earned → washes
        for (const id of E) total[id] += value * O.length;
        for (const id of O) total[id] -= value * E.length;
        events.push({ hole: h.number, players: E });
      }
    } else if (type.settle === "carry") {
      let mult = 1;
      for (const h of course.holes) {
        if (type.par3Only && h.par !== 3) continue;
        const e = entryByHole.get(h.number);
        const played = !!e && ids.some((id) => typeof e!.grossScores[id] === "number");
        if (!played) continue; // not reached yet — don't carry past it
        const E = earnersOn(type, cfg, h.number, h.par);
        if (E.length === 1) {
          const w = E[0];
          const O = ids.filter((id) => id !== w);
          total[w] += value * mult * O.length;
          for (const id of O) total[id] -= value * mult;
          events.push({ hole: h.number, players: E });
          mult = 1;
        } else {
          mult += 1; // no clear winner (none or tie) → carry
        }
      }
    } else {
      // holder — only the last player(s) to trigger it pay, at the end. "Last" is by
      // hole number (the only ordering we have), so sort rather than trust array order.
      let holders: PlayerId[] = [];
      const holesInOrder = [...course.holes].sort((a, b) => a.number - b.number);
      for (const h of holesInOrder) {
        const E = earnersOn(type, cfg, h.number, h.par);
        if (E.length > 0) {
          holders = E;
          events.push({ hole: h.number, players: E });
        }
      }
      const O = ids.filter((id) => !holders.includes(id));
      if (holders.length > 0 && O.length > 0) {
        const out = value * O.length; // total the holders pay
        for (const id of O) total[id] += value;
        for (const id of holders) total[id] -= out / holders.length;
      }
    }

    for (const id of ids) ledger[id] += total[id];
    bets.push({ id: type.id, label: type.label, settle: type.settle, total, events });
  }

  return { ledger, bets };
}
