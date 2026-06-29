// lib/fieldHammerStore.ts
// Local-first persistence + types for the Field Hammer game mode. One active game
// lives in localStorage (no backend). Reuses the existing pops engine for net
// scoring — it never reimplements handicaps.

import { Course, Player, computePops, HandicapMode } from "@/lib/wolf";
import { blankCourse, uid } from "@/lib/storage";
import { PairKey } from "@/lib/fieldHammer";

export type FHHandicapMode = "offLow" | "full" | "gross";

export interface FHSettings {
  baseStake: number;
  handicapMode: FHHandicapMode;
  linesCap: number; // max doublings per pairing
  carryTies: boolean;
}

// Live per-pairing state on a hole — the engine's PairState plus the UI-only
// bookkeeping needed to drive the hammer/accept/fold flow.
export interface FHPairLive {
  doublings: number;
  fold?: { folder: string; settleStake: number };
  lastHammerer?: string; // who last hammered this pairing (alternation rule)
  pending?: string; // a hammer awaiting the opponent's accept/fold
}

export interface FHHole {
  number: number;
  grossScores: Record<string, number>;
  pairings: Record<PairKey, FHPairLive>;
}

export interface FHGame {
  id: string;
  createdAt: string;
  players: Player[];
  course: Course;
  settings: FHSettings;
  holes: Record<number, FHHole>;
}

const KEY = "fieldHammer:active";

export function loadFH(): FHGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FHGame) : null;
  } catch {
    return null;
  }
}

export function saveFH(g: FHGame | null): void {
  if (typeof window === "undefined") return;
  try {
    if (g) window.localStorage.setItem(KEY, JSON.stringify(g));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore quota / serialization */
  }
}

export function defaultFHSettings(): FHSettings {
  return { baseStake: 5, handicapMode: "offLow", linesCap: 2, carryTies: false };
}

export function newFHGame(players: Player[], settings: FHSettings): FHGame {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    players,
    course: blankCourse("Field Hammer"),
    settings,
    holes: {},
  };
}

export function emptyHole(n: number): FHHole {
  return { number: n, grossScores: {}, pairings: {} };
}

/** Strokes received on a hole via the existing pops engine; "gross" = none. */
export function fhPopsForHole(game: FHGame, holeNumber: number): Record<string, number> {
  const ids = game.players.map((p) => p.id);
  if (game.settings.handicapMode === "gross") {
    return Object.fromEntries(ids.map((id) => [id, 0]));
  }
  const grid = computePops(game.players, game.course, game.settings.handicapMode as HandicapMode);
  return Object.fromEntries(ids.map((id) => [id, grid[id]?.[holeNumber] ?? 0]));
}
