// lib/games.ts
// Data layer over Supabase. Maps the DB shape (games + game_entries) to/from the
// engine's Round, and exposes CRUD + realtime helpers. No engine math here.

import { supabase } from "./supabase";
import {
  Round,
  HoleEntry,
  Course,
  Player,
  RoundSettings,
  GameTypeId,
  DEFAULT_SETTINGS,
} from "./wolf";
import { blankCourse, defaultPlayers } from "./storage";
import { GAME_TYPES } from "./gametypes";

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
  completed: boolean;
  published: boolean;
}

interface EntryRow {
  game_id: string;
  hole: number;
  wolf_id: string | null;
  mode: HoleEntry["mode"];
  partner_id: string | null;
  gross_scores: Record<string, number>;
  hammer: number | null;
  forfeit: "A" | "B" | null;
  meta: { elevenPicks?: HoleEntry["elevenPicks"] } | null;
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
  };
}

function rowsToRound(game: GameRow, entries: EntryRow[]): Round {
  return {
    course: game.course,
    players: game.players,
    teeOrder: game.tee_order,
    settings: { ...DEFAULT_SETTINGS, ...game.settings },
    entries: entries.map(rowToEntry).sort((a, b) => a.hole - b.hole),
    gameType: game.game_type ?? "wolf",
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listGames(): Promise<GameSummary[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id, name, game_type, created_at, completed, published, courseName:course->>name")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    courseName: (g.courseName as string) ?? "",
    gameType: ((g.game_type as GameTypeId) ?? "wolf"),
    createdAt: g.created_at,
    completed: Boolean(g.completed),
    published: Boolean(g.published),
  }));
}

export async function getGame(id: string): Promise<Game | null> {
  const [{ data: game, error: gErr }, { data: entries, error: eErr }] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase.from("game_entries").select("*").eq("game_id", id),
  ]);
  if (gErr) throw gErr;
  if (eErr) throw eErr;
  if (!game) return null;
  return {
    id: game.id,
    name: game.name,
    completed: Boolean(game.completed),
    published: Boolean(game.published),
    round: rowsToRound(game as GameRow, (entries ?? []) as EntryRow[]),
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────

export async function createGame(
  name: string,
  gameType: GameTypeId = "wolf"
): Promise<string> {
  const meta = GAME_TYPES[gameType];
  const players = defaultPlayers();
  const settings: RoundSettings = { ...DEFAULT_SETTINGS, ...meta.defaultSettings };
  // Seed a balanced default team split for the team games (A,B,A,B…).
  if (meta.hasTeams) {
    settings.teams = Object.fromEntries(
      players.map((p, i) => [p.id, i % 2 === 0 ? "A" : "B"])
    );
  }
  const { data, error } = await supabase
    .from("games")
    .insert({
      name: name.trim() || `New ${meta.label} game`,
      game_type: gameType,
      course: blankCourse(),
      players,
      tee_order: players.map((p) => p.id),
      settings,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}

export async function setCompleted(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function renameGame(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update({ name: name.trim() || "Untitled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Persist the static round setup (course, players, tee order, settings). */
export async function saveSetup(id: string, round: Round): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update({
      course: round.course,
      players: round.players,
      tee_order: round.teeOrder,
      settings: round.settings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Upsert a single hole's entry (per-hole row → no cross-hole clobbering). */
export async function saveEntry(gameId: string, entry: HoleEntry): Promise<void> {
  const { error } = await supabase.from("game_entries").upsert(
    {
      game_id: gameId,
      hole: entry.hole,
      wolf_id: entry.wolfId || null,
      mode: entry.mode,
      partner_id: entry.partnerId ?? null,
      gross_scores: entry.grossScores ?? {},
      hammer: entry.hammer ?? 0,
      forfeit: entry.forfeit ?? null,
      meta: { elevenPicks: entry.elevenPicks ?? {} },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "game_id,hole" }
  );
  if (error) throw error;
}

// ── Realtime ───────────────────────────────────────────────────────────────

/** Subscribe to inserts/updates/deletes on the games list. Returns unsubscribe. */
export function subscribeGamesList(onChange: () => void): () => void {
  const channel = supabase
    .channel("games-list")
    .on("postgres_changes", { event: "*", schema: "public", table: "games" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Subscribe to a single game (its row + all its entries). Returns unsubscribe. */
export function subscribeGame(id: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`game-${id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `id=eq.${id}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_entries", filter: `game_id=eq.${id}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
