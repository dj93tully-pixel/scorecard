// lib/storage.ts
//
// localStorage persistence for the active round and saved courses, plus small
// factory helpers. Browser-only (guards against SSR). No engine math here.

import {
  Course,
  CourseHole,
  Player,
  Round,
  DEFAULT_SETTINGS,
} from "./wolf";

const ROUND_KEY = "wolf:activeRound";
const COURSES_KEY = "wolf:savedCourses";

export function uid(): string {
  // Good enough for client-side player/course ids.
  return Math.random().toString(36).slice(2, 10);
}

export function blankCourse(name = "New Course"): Course {
  return {
    name,
    holes: Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: 4,
      strokeIndex: i + 1,
    })),
  };
}

export function makePlayer(name = "", handicap = 0): Player {
  return { id: uid(), name, handicap };
}

export function defaultPlayers(): Player[] {
  return [
    makePlayer("Player 1", 0),
    makePlayer("Player 2", 0),
    makePlayer("Player 3", 0),
    makePlayer("Player 4", 0),
  ];
}

export function newRound(): Round {
  const players = defaultPlayers();
  return {
    course: blankCourse(),
    players,
    teeOrder: players.map((p) => p.id),
    settings: { ...DEFAULT_SETTINGS },
    entries: [],
  };
}

// ── Persistence ────────────────────────────────────────────────────────────

export function loadRound(): Round | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROUND_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Round;
  } catch {
    return null;
  }
}

export function saveRound(round: Round): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROUND_KEY, JSON.stringify(round));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function loadCourses(): Course[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COURSES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Course[];
  } catch {
    return [];
  }
}

export function saveCourses(courses: Course[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  } catch {
    /* ignore */
  }
}

// ── Misc helpers ───────────────────────────────────────────────────────────

export function coursePar(course: Course): number {
  return course.holes.reduce((sum, h) => sum + h.par, 0);
}

/** Validate that stroke indexes are a 1..18 permutation; return missing/dupes. */
export function strokeIndexIssues(course: Course): string[] {
  const issues: string[] = [];
  const seen = new Map<number, number>();
  for (const h of course.holes) {
    seen.set(h.strokeIndex, (seen.get(h.strokeIndex) ?? 0) + 1);
  }
  for (let si = 1; si <= course.holes.length; si++) {
    const count = seen.get(si) ?? 0;
    if (count === 0) issues.push(`missing SI ${si}`);
    if (count > 1) issues.push(`SI ${si} used ${count}×`);
  }
  return issues;
}

export function formatMoney(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  // Show cents only when needed (carryover splits can be fractional).
  const body = Number.isInteger(abs) ? `${abs}` : abs.toFixed(2);
  return `${sign}$${body}`;
}

export { type CourseHole };
