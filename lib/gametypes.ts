// lib/gametypes.ts
// Registry for every money game. Holds per-type metadata (label, player range,
// stat columns, default settings) and dispatches scoring to the right pure
// engine. Wolf keeps its own computeRound + bespoke UI; the four others share the
// generic ScoreEntryTab / StandingsView driven by the engines in lib/engines/*.

import { Round, GameTypeId, RoundSettings } from "./wolf";
import { GameResult } from "./engines/types";
import { computeSkins } from "./engines/skins";
import { computeBestBall } from "./engines/bestball";
import { computeVegas } from "./engines/vegas";
import { computeSixes } from "./engines/sixes";
import { computeStroke } from "./engines/strokeplay";
import { computeElevens } from "./engines/elevens";
import { computeFieldHammer } from "./engines/fieldhammer";
import { computeNassau } from "./engines/nassau";
import { withPresses } from "./engines/press";
import { splitTeams } from "./engines/teams";

export interface StatColumn {
  key: string;
  label: string;
  /** number = plain, plusminus = signed (+2/-1), money = $ formatting. */
  kind: "number" | "plusminus" | "money";
}

export interface GameTypeMeta {
  id: GameTypeId;
  label: string;
  blurb: string;
  players: { min: number; max: number };
  /** Fixed two-team assignment (Best Ball, Vegas). */
  hasTeams: boolean;
  /** Partners rotate by hole (Six-Six-Six) — no manual team picker. */
  rotatesTeams: boolean;
  statColumns: StatColumn[];
  defaultSettings: Partial<RoundSettings>;
}

export const GAME_TYPES: Record<GameTypeId, GameTypeMeta> = {
  wolf: {
    id: "wolf",
    label: "Wolf",
    blurb: "Rotating wolf picks a partner, goes lone, or blind each hole.",
    players: { min: 3, max: 5 },
    hasTeams: false,
    rotatesTeams: false,
    statColumns: [],
    defaultSettings: { carryover: true, hammerCarry: true },
  },
  skins: {
    id: "skins",
    label: "Skins",
    blurb: "Lowest net score wins the hole; ties carry the skins forward.",
    players: { min: 2, max: 6 },
    hasTeams: false,
    rotatesTeams: false,
    statColumns: [{ key: "skins", label: "Skins", kind: "number" }],
    defaultSettings: { skinValue: 5, carryover: true, hammerCarry: true },
  },
  bestball: {
    id: "bestball",
    label: "Best Ball",
    blurb: "Two teams; each team's best net ball wins the hole. Plays 4 or 5.",
    players: { min: 4, max: 5 },
    hasTeams: true,
    rotatesTeams: false,
    statColumns: [{ key: "holesUp", label: "Holes", kind: "plusminus" }],
    defaultSettings: { carryover: true, hammerCarry: true },
  },
  vegas: {
    id: "vegas",
    label: "Vegas",
    blurb: "Teams of two combine scores into a number — low digit first.",
    players: { min: 4, max: 4 },
    hasTeams: true,
    rotatesTeams: false,
    statColumns: [{ key: "points", label: "Points", kind: "plusminus" }],
    defaultSettings: { pointValue: 1, birdieFlip: true },
  },
  sixes: {
    id: "sixes",
    label: "Six-Six-Six",
    blurb: "Partners rotate every 6 holes; each hole a 2v2 best ball.",
    players: { min: 4, max: 4 },
    hasTeams: false,
    rotatesTeams: true,
    statColumns: [{ key: "holesWon", label: "Holes won", kind: "number" }],
    defaultSettings: { carryover: true, hammerCarry: true },
  },
  stroke: {
    id: "stroke",
    label: "Stroke Play",
    blurb: "Net total strokes; win or lose money per stroke vs the field each hole.",
    players: { min: 2, max: 6 },
    hasTeams: false,
    rotatesTeams: false,
    statColumns: [{ key: "strokes", label: "Net", kind: "number" }],
    defaultSettings: { stake: 1 },
  },
  elevens: {
    id: "elevens",
    label: "11s",
    blurb: "Pick 11 of 18 holes; lowest net total wins, paid like stroke play.",
    players: { min: 2, max: 6 },
    hasTeams: false,
    rotatesTeams: false,
    statColumns: [{ key: "picks", label: "Picks", kind: "number" }],
    defaultSettings: { stake: 1 },
  },
  fieldhammer: {
    id: "fieldhammer",
    label: "Hammerskin",
    blurb: "Round-robin skins; tap hammer (×2), double (×4), or forfeit per player.",
    players: { min: 3, max: 6 },
    hasTeams: false,
    rotatesTeams: false,
    statColumns: [],
    defaultSettings: { stake: 5, carryover: false },
  },
  nassau: {
    id: "nassau",
    label: "Nassau",
    blurb: "Three match-play bets — front 9, back 9, and overall 18.",
    players: { min: 2, max: 6 },
    hasTeams: false,
    rotatesTeams: false,
    statColumns: [
      { key: "front", label: "Front", kind: "money" },
      { key: "back", label: "Back", kind: "money" },
      { key: "overall", label: "Overall", kind: "money" },
    ],
    defaultSettings: { stake: 2, nassauFormat: "teams" },
  },
};

export const GAME_TYPE_LIST: GameTypeMeta[] = [
  GAME_TYPES.wolf,
  GAME_TYPES.skins,
  GAME_TYPES.bestball,
  GAME_TYPES.vegas,
  GAME_TYPES.sixes,
  GAME_TYPES.stroke,
  GAME_TYPES.elevens,
  GAME_TYPES.fieldhammer,
  GAME_TYPES.nassau,
];

export function gameTypeOf(round: Round): GameTypeId {
  return round.gameType ?? "wolf";
}
export function gameTypeMeta(round: Round): GameTypeMeta {
  return GAME_TYPES[gameTypeOf(round)];
}

/**
 * The RAW per-hole engine for a game, WITHOUT presses — used to decompose a
 * round into its base bet and (by re-running over the pressed holes) its press
 * bets for the Card tab's original / press / total views.
 */
export function computeBaseGame(round: Round): GameResult {
  switch (gameTypeOf(round)) {
    case "skins":
      return computeSkins(round);
    case "bestball":
      return computeBestBall(round);
    case "vegas":
      return computeVegas(round);
    case "sixes":
      return computeSixes(round);
    case "stroke":
      return computeStroke(round);
    case "fieldhammer":
      return computeFieldHammer(round);
    case "elevens":
      return computeElevens(round);
    case "nassau":
      return computeNassau(round);
    default:
      return { ledger: {}, pops: {}, holeResults: [], stats: {} };
  }
}

/** Compute a non-Wolf game. (Wolf uses computeRound from lib/wolf directly.) */
export function computeGame(round: Round): GameResult {
  switch (gameTypeOf(round)) {
    // Per-hole games — presses re-run the engine over the pressed holes.
    case "skins":
      return withPresses(round, computeSkins);
    case "bestball":
      return withPresses(round, computeBestBall);
    case "vegas":
      return withPresses(round, computeVegas);
    case "sixes":
      return withPresses(round, computeSixes);
    case "stroke":
      return withPresses(round, computeStroke);
    case "fieldhammer":
      return withPresses(round, computeFieldHammer);
    // 11s has no press; Nassau settles its own (match play per segment).
    case "elevens":
      return computeElevens(round);
    case "nassau":
      return computeNassau(round);
    default:
      return { ledger: {}, pops: {}, holeResults: [], stats: {} };
  }
}

export const TEAM_COLORS: Record<"A" | "B", string> = {
  A: "#2D78FF",
  B: "#F0524B",
};

/**
 * Team tag (label + colour) for a player on a hole, or null when the type has no
 * per-hole team. Fixed teams for Best Ball/Vegas; rotating pairs for Six-Six-Six.
 */
export function teamTag(
  round: Round,
  playerId: string,
  hole: number
): { label: string; color: string } | null {
  const t = gameTypeOf(round);
  if (t === "bestball" || t === "vegas") {
    const team = splitTeams(round).A.includes(playerId) ? "A" : "B";
    return { label: team, color: TEAM_COLORS[team] };
  }
  if (t === "sixes") {
    const order =
      round.teeOrder.length === 4 ? round.teeOrder : round.players.map((p) => p.id);
    const total = round.course.holes.length || 18;
    const idx = round.course.holes.findIndex((h) => h.number === hole);
    const third = total / 3;
    const seg = idx < third ? 0 : idx < 2 * third ? 1 : 2;
    const pairs =
      seg === 0
        ? [
            [order[0], order[1]],
            [order[2], order[3]],
          ]
        : seg === 1
          ? [
              [order[0], order[2]],
              [order[1], order[3]],
            ]
          : [
              [order[0], order[3]],
              [order[1], order[2]],
            ];
    const team = pairs[0].includes(playerId) ? "A" : "B";
    return { label: team, color: TEAM_COLORS[team] };
  }
  return null;
}
