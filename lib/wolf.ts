// lib/wolf.ts
//
// Pure, framework-agnostic Wolf engine: pops (handicap strokes) + money + ledger.
// NO React / Next imports may ever be added to this file. The UI consumes these
// pure functions; it must never reimplement or edit the math here.

// ───────────────────────────────────────────────────────────────────────────
// Data model
// ───────────────────────────────────────────────────────────────────────────

export type PlayerId = string;

export interface CourseHole {
  number: number; // 1..18
  par: number;
  strokeIndex: number; // 1..18, each used once
}

export interface Course {
  name: string;
  holes: CourseHole[];
}

export interface Player {
  id: PlayerId;
  name: string;
  handicap: number; // integer; used when handicapMode is offLow/full
  pops?: number; // direct strokes received; used when handicapMode is "direct"
}

// "offLow"/"full" derive pops from handicaps; "direct" uses each player's `pops`
// value verbatim (still spread across holes by stroke index).
export type HandicapMode = "offLow" | "full" | "direct";

export interface RoundSettings {
  stake: number; // $ per hole each FIELD player risks
  /**
   * Optional separate stake each WOLF-TEAM player risks in a 2v2 hole. Useful
   * for uneven teams (e.g. 5 players): set wolf=$3, field=$2 so 2×$3 balances
   * 3×$2. 0 or undefined means "same as stake" (symmetric).
   */
  wolfStake?: number;
  loneMult: number; // default 1
  blindMult: number; // default 2
  blindEnabled: boolean;
  carryover: boolean; // ties push; if true, roll stake into next hole
  handicapMode: HandicapMode;

  // ── Fields for the non-Wolf game types (all optional; ignored by Wolf) ──
  /** Team assignment for Best Ball / Vegas: playerId → "A" | "B". */
  teams?: Record<PlayerId, "A" | "B">;
  /** Skins: value of one skin, contributed by each player. */
  skinValue?: number;
  /** Vegas: dollars per point of the team-number difference. */
  pointValue?: number;
  /** Vegas: opponent birdie flips your team number high-digit-first. */
  birdieFlip?: boolean;
}

export type WolfMode = "2v2" | "lone" | "blind";

// Which money game a round is. "wolf" is the original engine; the others live in
// lib/engines/* and are dispatched via lib/gametypes.ts. All non-wolf types use
// only each hole's gross_scores as input (teams live in settings / are derived).
export type GameTypeId =
  | "wolf"
  | "skins"
  | "bestball"
  | "vegas"
  | "sixes"
  | "stroke"
  | "elevens"
  | "fieldhammer";

export interface HoleEntry {
  hole: number; // 1..18
  wolfId: PlayerId;
  mode: WolfMode;
  partnerId?: PlayerId; // only for 2v2
  grossScores: Record<PlayerId, number>;
  /** Accepted hammers on the hole: 0/undefined = none, 1 = hammer (2×), 2 = double hammer (4×). */
  hammer?: number;
  /**
   * A side conceded the hole (a thrown hammer wasn't accepted). The OTHER side
   * wins regardless of net scores. "A" = wolf side concedes, "B" = field concedes.
   */
  forfeit?: "A" | "B";
  /**
   * 11s only: per-player "I'm counting this hole" flag. Each player picks 11 of
   * 18 holes; only the holes they check count. Persisted in game_entries.meta.
   */
  elevenPicks?: Record<PlayerId, boolean>;
  /**
   * Field Hammer only: per-player stance on the hole — "hammer" (×2 your loss),
   * "double" (×4), or "forfeit" (concede). Persisted in game_entries.meta.
   */
  fhActions?: Record<PlayerId, import("./fieldHammer").FHAction>;
}

export interface Round {
  course: Course;
  players: Player[];
  teeOrder: PlayerId[];
  settings: RoundSettings;
  entries: HoleEntry[];
  /** Which money game this is. Defaults to "wolf" when absent (legacy rows). */
  gameType?: GameTypeId;
}

export const DEFAULT_SETTINGS: RoundSettings = {
  stake: 5,
  wolfStake: 0, // 0 = same as stake (symmetric)
  loneMult: 1,
  blindMult: 2,
  blindEnabled: true,
  carryover: false,
  handicapMode: "offLow",
};

// ───────────────────────────────────────────────────────────────────────────
// Pops engine (handicap strokes)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Strokes received per player for the round.
 *   offLow: each player gets (handicap - lowestHandicap), floored at 0.
 *   full:   each player gets their full handicap.
 */
export function strokesReceived(
  players: Player[],
  mode: HandicapMode
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  if (players.length === 0) return out;
  if (mode === "direct") {
    // Pops entered directly per player; ignore handicaps entirely.
    for (const p of players) out[p.id] = Math.max(0, Math.floor(p.pops ?? 0));
    return out;
  }
  const low = Math.min(...players.map((p) => p.handicap));
  for (const p of players) {
    out[p.id] = mode === "full" ? Math.max(0, p.handicap) : Math.max(0, p.handicap - low);
  }
  return out;
}

/**
 * Pops a player receives on a hole with the given stroke index, supporting
 * double-pops when strokesReceived > 18.
 */
export function popsForHole(received: number, strokeIndex: number): number {
  if (received <= 0) return 0;
  const base = Math.floor(received / 18);
  const extra = strokeIndex <= received % 18 ? 1 : 0;
  return base + extra;
}

/**
 * Full pops grid: pops[playerId][holeNumber] = strokes received on that hole.
 */
export function computePops(
  players: Player[],
  course: Course,
  mode: HandicapMode
): Record<PlayerId, Record<number, number>> {
  const received = strokesReceived(players, mode);
  const grid: Record<PlayerId, Record<number, number>> = {};
  for (const p of players) {
    grid[p.id] = {};
    for (const h of course.holes) {
      grid[p.id][h.number] = popsForHole(received[p.id] ?? 0, h.strokeIndex);
    }
  }
  return grid;
}

export function netScore(gross: number, pops: number): number {
  return gross - pops;
}

// ───────────────────────────────────────────────────────────────────────────
// Money model
// ───────────────────────────────────────────────────────────────────────────

export type HoleWinner = "A" | "B" | "push";

export interface HoleResult {
  hole: number;
  wolfId: PlayerId;
  mode: WolfMode;
  teamA: PlayerId[]; // wolf (+ partner if 2v2)
  teamB: PlayerId[]; // everyone else
  net: Record<PlayerId, number>; // net score per player on this hole
  teamABest: number | null; // best (lowest) net ball for team A
  teamBBest: number | null;
  winner: HoleWinner;
  /** Effective field stake in play on this hole (base + any carryover). */
  stakeApplied: number;
  /** Money change per player for this hole. Always sums to 0. */
  deltas: Record<PlayerId, number>;
  /** Total money moved on the hole (sum of the positive deltas). */
  pot: number;
  /** Carryover amount rolled into the NEXT hole after this one resolves. */
  carriedToNext: number;
}

export interface RoundComputation {
  pops: Record<PlayerId, Record<number, number>>;
  results: HoleResult[];
  /** Running ledger total per player across all entered holes. Sums to 0. */
  ledger: Record<PlayerId, number>;
}

function teamsForEntry(
  entry: HoleEntry,
  playerIds: PlayerId[]
): { teamA: PlayerId[]; teamB: PlayerId[] } {
  const teamA: PlayerId[] = [entry.wolfId];
  if (entry.mode === "2v2" && entry.partnerId) {
    teamA.push(entry.partnerId);
  }
  const teamB = playerIds.filter((id) => !teamA.includes(id));
  return { teamA, teamB };
}

/** Best (lowest) net ball among a team's members; null if no scores present. */
function bestNet(team: PlayerId[], net: Record<PlayerId, number>): number | null {
  const vals = team.map((id) => net[id]).filter((v) => typeof v === "number");
  if (vals.length === 0) return null;
  return Math.min(...vals);
}

/**
 * Resolve the money deltas for a single hole. Guarantees the returned deltas
 * sum to exactly 0. `fieldStake` is what each field player risks; `wolfStake`
 * is what each wolf-team player risks (equal to fieldStake unless a separate
 * wolf-team stake is configured).
 *
 * - 2v2 (with a partner): the losing side pays its per-player risk; that pot is
 *   split evenly among the winners. For even 4-player teams with equal stakes
 *   this is exactly "each winner +stake, each loser -stake". With a higher
 *   wolfStake on uneven teams (e.g. 5 players) the totals balance (2×$3 vs 3×$2).
 * - no partner / lone / blind: the wolf is alone and plays EACH opponent for
 *   `mult * fieldStake` (no partner → 1×, lone → loneMult, blind → blindMult).
 *   With N players the wolf faces (N-1) opponents, so a winning wolf nets
 *   +(N-1)*mult*fieldStake and each opponent loses mult*fieldStake.
 */
function resolveDeltas(
  winner: HoleWinner,
  teamA: PlayerId[],
  teamB: PlayerId[],
  mode: WolfMode,
  fieldStake: number,
  wolfStake: number,
  settings: RoundSettings
): Record<PlayerId, number> {
  const deltas: Record<PlayerId, number> = {};
  for (const id of [...teamA, ...teamB]) deltas[id] = 0;
  if (winner === "push") return deltas;

  // Genuine 2v2 (wolf + a partner). A "2v2" hole with NO partner selected is the
  // wolf alone vs the field and is settled head-to-head below, not pot-split.
  if (mode === "2v2" && teamA.length >= 2) {
    // teamA is always the wolf team; teamB is the field.
    if (winner === "A") {
      // Wolf team wins: each field player pays fieldStake; split among wolf team.
      const pot = fieldStake * teamB.length;
      const share = pot / teamA.length;
      for (const id of teamA) deltas[id] += share;
      for (const id of teamB) deltas[id] -= fieldStake;
    } else {
      // Field wins: each wolf-team player pays wolfStake; split among the field.
      const pot = wolfStake * teamA.length;
      const share = pot / teamB.length;
      for (const id of teamB) deltas[id] += share;
      for (const id of teamA) deltas[id] -= wolfStake;
    }
    return deltas;
  }

  // Wolf alone vs the field, head-to-head against EACH opponent. The wolf wins
  // (or loses) the per-opponent unit against all of them, so with N players the
  // wolf swings ±(N-1)*unit and each opponent swings ∓unit. Multiplier:
  //   no partner → 1×, lone → loneMult, blind → blindMult.
  const mult =
    mode === "blind" ? settings.blindMult : mode === "lone" ? settings.loneMult : 1;
  const unit = mult * fieldStake;
  const wolfId = teamA[0];
  const opponents = teamB;
  const wolfWon = winner === "A";
  if (wolfWon) {
    deltas[wolfId] += unit * opponents.length;
    for (const id of opponents) deltas[id] -= unit;
  } else {
    deltas[wolfId] -= unit * opponents.length;
    for (const id of opponents) deltas[id] += unit;
  }
  return deltas;
}

/**
 * Compute the full round: pops grid, per-hole results, and a running ledger.
 * Handles carryover by accumulating pushed stake into the next decided hole.
 */
export function computeRound(round: Round): RoundComputation {
  const { players, course, settings } = round;
  const playerIds = players.map((p) => p.id);
  const pops = computePops(players, course, settings.handicapMode);

  const ledger: Record<PlayerId, number> = {};
  for (const id of playerIds) ledger[id] = 0;

  const results: HoleResult[] = [];
  let carried = 0; // money carried INTO the current hole from prior pushes

  // Process entries in hole order so carryover flows correctly.
  const ordered = [...round.entries].sort((a, b) => a.hole - b.hole);

  for (const entry of ordered) {
    const { teamA, teamB } = teamsForEntry(entry, playerIds);

    // Net scores for this hole.
    const net: Record<PlayerId, number> = {};
    for (const id of playerIds) {
      const gross = entry.grossScores[id];
      if (typeof gross === "number") {
        net[id] = gross - (pops[id]?.[entry.hole] ?? 0);
      }
    }

    const teamABest = bestNet(teamA, net);
    const teamBBest = bestNet(teamB, net);

    // Hammer multiplies the whole value in play on the hole (base + carryover):
    // 0 → 1×, 1 → 2× (hammer), 2 → 4× (double hammer).
    const hammerMult = 2 ** Math.max(0, Math.floor(entry.hammer ?? 0));
    const baseWolf =
      settings.wolfStake && settings.wolfStake > 0 ? settings.wolfStake : settings.stake;
    const stakeApplied = (settings.stake + carried) * hammerMult; // field stake
    const wolfStakeApplied = (baseWolf + carried) * hammerMult;

    let winner: HoleWinner;
    if (entry.forfeit === "A") {
      winner = "B"; // wolf side conceded → field wins regardless of scores
    } else if (entry.forfeit === "B") {
      winner = "A"; // field conceded → wolf side wins regardless of scores
    } else if (teamABest === null || teamBBest === null) {
      winner = "push"; // incomplete hole — nothing decided yet
    } else if (teamABest < teamBBest) {
      winner = "A";
    } else if (teamBBest < teamABest) {
      winner = "B";
    } else {
      winner = "push";
    }

    const deltas = resolveDeltas(
      winner,
      teamA,
      teamB,
      entry.mode,
      stakeApplied,
      wolfStakeApplied,
      settings
    );
    const pot = Object.values(deltas).reduce((s, v) => (v > 0 ? s + v : s), 0);

    // Carryover bookkeeping.
    let carriedToNext = 0;
    if (winner === "push") {
      if (settings.carryover) {
        // Roll the whole accumulated pot forward.
        carriedToNext = stakeApplied;
      }
      // If carryover is off, the push simply voids this hole's stake.
    }
    carried = carriedToNext;

    for (const id of playerIds) ledger[id] += deltas[id] ?? 0;

    results.push({
      hole: entry.hole,
      wolfId: entry.wolfId,
      mode: entry.mode,
      teamA,
      teamB,
      net,
      teamABest,
      teamBBest,
      winner,
      stakeApplied,
      deltas,
      pot,
      carriedToNext,
    });
  }

  return { pops, results, ledger };
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers for the UI
// ───────────────────────────────────────────────────────────────────────────

/** Default wolf for a hole by tee-order rotation. Wolf tees last. */
export function defaultWolfForHole(
  teeOrder: PlayerId[],
  hole: number
): PlayerId | undefined {
  if (teeOrder.length === 0) return undefined;
  return teeOrder[(hole - 1) % teeOrder.length];
}

/** Total of all ledger values — should always be 0 (money invariant). */
export function ledgerSum(ledger: Record<PlayerId, number>): number {
  return Object.values(ledger).reduce((a, b) => a + b, 0);
}
