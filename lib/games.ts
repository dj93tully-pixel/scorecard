// lib/games.ts
// Data layer over localStorage. Maps the stored shape (games + entries) to/from
// the engine's Round, and exposes CRUD + a same-device change-notification
// helper. No engine math here.

import {
  Round,
  HoleEntry,
  Course,
  Player,
  RoundSettings,
  GameTypeId,
  DEFAULT_SETTINGS,
  sanitizeEntries,
} from "./wolf";
import { blankCourse, defaultPlayers, uid } from "./storage";
import { GAME_TYPES } from "./gametypes";

const STORE_KEY = "wolf:games:v1";

export interface GameSummary {
  id: string;
  name: string;
  courseName: string;
  gameType: GameTypeId;
  createdAt: string;
  completed: boolean;
  published: boolean;
}

export interface Game {
  id: string;
  name: string;
  completed: boolean;
  published: boolean;
  round: Round;
}

interface GameRow {
  id: string;
  name: string;
  course: Course;
  players: Player[];
  tee_order: string[];
  settings: RoundSettings;
  game_type: GameTypeId | null;
  created_at: string;
  updated_at: string;
  completed: boolean;
  published: boolean;
  entries: EntryRow[];
}

interface EntryRow {
  hole: number;
  wolf_id: string | null;
  mode: HoleEntry["mode"];
  partner_id: string | null;
  gross_scores: Record<string, number>;
  hammer: number | null;
  forfeit: "A" | "B" | null;
  meta: {
    elevenPicks?: HoleEntry["elevenPicks"];
    pressSeg?: boolean;
    pressFull?: boolean;
    junk?: HoleEntry["junk"];
  } | null;
}

type Store = Record<string, GameRow>;

// ── Raw storage ──────────────────────────────────────────────────────────

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  // Notify same-tab listeners (the `storage` event only fires in OTHER tabs).
  window.dispatchEvent(new CustomEvent("wolf:games-changed"));
}

function rowToEntry(r: EntryRow): HoleEntry {
  return {
    hole: r.hole,
    wolfId: r.wolf_id ?? "",
    mode: r.mode,
    partnerId: r.partner_id ?? undefined,
    grossScores: r.gross_scores ?? {},
    hammer: r.hammer ?? 0,
    forfeit: r.forfeit ?? undefined,
    elevenPicks: r.meta?.elevenPicks ?? undefined,
    pressSeg: !!r.meta?.pressSeg,
    pressFull: !!r.meta?.pressFull,
    junk: r.meta?.junk ?? undefined,
  };
}

function entryToRow(entry: HoleEntry): EntryRow {
  return {
    hole: entry.hole,
    wolf_id: entry.wolfId || null,
    mode: entry.mode,
    partner_id: entry.partnerId ?? null,
    gross_scores: entry.grossScores ?? {},
    hammer: entry.hammer ?? 0,
    forfeit: entry.forfeit ?? null,
    meta: {
      elevenPicks: entry.elevenPicks ?? {},
      pressSeg: entry.pressSeg ?? false,
      pressFull: entry.pressFull ?? false,
      junk: entry.junk ?? {},
    },
  };
}

function rowToRound(game: GameRow): Round {
  // Guard the raw JSON fields: a hand-edited/legacy row with a null course/
  // players/tee_order would otherwise crash the game screen (settings already
  // default-merge).
  const players = Array.isArray(game.players) ? game.players : [];
  const course =
    game.course && Array.isArray(game.course.holes) ? game.course : blankCourse();
  const teeOrder =
    Array.isArray(game.tee_order) && game.tee_order.length > 0
      ? game.tee_order
      : players.map((p) => p.id); // re-derive from players when absent
  return {
    course,
    players,
    teeOrder,
    settings: { ...DEFAULT_SETTINGS, ...game.settings },
    // sanitizeEntries makes a stale wolf/partner reference (e.g. a player removed
    // in a prior session) self-heal on every load, so it never voids a hole.
    entries: sanitizeEntries(
      (game.entries ?? []).map(rowToEntry).sort((a, b) => a.hole - b.hole),
      players,
      teeOrder
    ),
    gameType: game.game_type ?? "wolf",
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listGames(): Promise<GameSummary[]> {
  const store = readStore();
  return Object.values(store)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((g) => ({
      id: g.id,
      name: g.name,
      courseName: g.course?.name ?? "",
      gameType: g.game_type ?? "wolf",
      createdAt: g.created_at,
      completed: Boolean(g.completed),
      published: Boolean(g.published),
    }));
}

export async function getGame(id: string): Promise<Game | null> {
  const game = readStore()[id];
  if (!game) return null;
  return {
    id: game.id,
    name: game.name,
    completed: Boolean(game.completed),
    published: Boolean(game.published),
    round: rowToRound(game),
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────

function touch(id: string, patch: (row: GameRow) => void): void {
  const store = readStore();
  const row = store[id];
  if (!row) return;
  patch(row);
  row.updated_at = new Date().toISOString();
  writeStore(store);
}

export async function createGame(
  name: string,
  gameType: GameTypeId = "wolf"
): Promise<string> {
  const meta = GAME_TYPES[gameType];
  const players = defaultPlayers();
  const settings: RoundSettings = { ...DEFAULT_SETTINGS, ...meta.defaultSettings };
  // Seed a balanced default team split for the team games (A,B,A,B…). Nassau
  // defaults to team format, so seed it a split too (the user can re-split or
  // switch to everyone-vs-everyone in Setup).
  if (meta.hasTeams || gameType === "nassau") {
    settings.teams = Object.fromEntries(
      players.map((p, i) => [p.id, i % 2 === 0 ? "A" : "B"])
    );
  }
  const id = uid();
  const now = new Date().toISOString();
  const row: GameRow = {
    id,
    name: name.trim() || `${meta.label} Game`,
    game_type: gameType,
    course: blankCourse(),
    players,
    tee_order: players.map((p) => p.id),
    settings,
    created_at: now,
    updated_at: now,
    completed: false,
    published: true, // active immediately — no separate publish step
    entries: [],
  };
  const store = readStore();
  store[id] = row;
  writeStore(store);
  return id;
}

export async function deleteGame(id: string): Promise<void> {
  const store = readStore();
  delete store[id];
  writeStore(store);
}

export async function setCompleted(id: string, completed: boolean): Promise<void> {
  touch(id, (row) => {
    row.completed = completed;
  });
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  touch(id, (row) => {
    row.published = published;
  });
}

export async function renameGame(id: string, name: string): Promise<void> {
  touch(id, (row) => {
    row.name = name.trim() || "Untitled";
  });
}

/** Persist the static round setup (course, players, tee order, settings). */
export async function saveSetup(id: string, round: Round): Promise<void> {
  touch(id, (row) => {
    row.course = round.course;
    row.players = round.players;
    row.tee_order = round.teeOrder;
    row.settings = round.settings;
  });
}

/** Upsert a single hole's entry. */
export async function saveEntry(gameId: string, entry: HoleEntry): Promise<void> {
  touch(gameId, (row) => {
    const idx = row.entries.findIndex((e) => e.hole === entry.hole);
    const next = entryToRow(entry);
    if (idx === -1) row.entries.push(next);
    else row.entries[idx] = next;
  });
}

// ── Change notifications ────────────────────────────────────────────────────
// Everything lives in this browser's localStorage, so there's no server to push
// updates from other devices. These just let other components/tabs on this same
// device react when the store changes — the `storage` event covers other tabs,
// the custom event covers this one.

/** Subscribe to any change in the games list. Returns unsubscribe. */
export function subscribeGamesList(onChange: () => void): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY) onChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener("wolf:games-changed", onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("wolf:games-changed", onChange);
  };
}

/** Subscribe to changes to a single game. Returns unsubscribe. */
export function subscribeGame(id: string, onChange: () => void): () => void {
  // Any store write could touch this id; getGame() is cheap, so the consumer
  // just re-fetches and diffs.
  return subscribeGamesList(onChange);
}
