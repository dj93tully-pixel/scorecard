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
  handicap: number; // integer
}

export type HandicapMode = "offLow" | "full";

export interface RoundSettings {
  stake: number; // $ per hole
  loneMult: number; // default 1
  blindMult: number; // default 2
  blindEnabled: boolean;
  carryover: boolean; // ties push; if true, roll stake into next hole
  handicapMode: HandicapMode;
}

export type WolfMode = "2v2" | "lone" | "blind";

export interface HoleEntry {
  hole: number; // 1..18
  wolfId: PlayerId;
  mode: WolfMode;
  partnerId?: PlayerId; // only for 2v2
  grossScores: Record<PlayerId, number>;
}

export interface Round {
  course: Course;
  players: Player[];
  teeOrder: PlayerId[];
  settings: RoundSettings;
  entries: HoleEntry[];
}

export const DEFAULT_SETTINGS: RoundSettings = {
  stake: 5,
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
  /** Effective stake actually in play on this hole (base + any carryover). */
  stakeApplied: number;
  /** Money change per player for this hole. Always sums to 0. */
  deltas: Record<PlayerId, number>;
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
 * Resolve the money deltas for a single hole given the effective stake.
 * Guarantees the returned deltas sum to exactly 0.
 *
 * - 2v2: the losing team collectively pays `stake` per losing player; that
 *   pot is split evenly among the winners. For even 4-player teams this is
 *   exactly "each winner +stake, each loser -stake".
 * - lone/blind: the wolf plays EACH opponent for `mult * stake`. With N players
 *   the wolf faces (N-1) opponents, so a winning wolf nets +(N-1)*mult*stake
 *   and each opponent loses mult*stake (matches "+3 units" with 4 players).
 */
function resolveDeltas(
  winner: HoleWinner,
  teamA: PlayerId[],
  teamB: PlayerId[],
  mode: WolfMode,
  stake: number,
  settings: RoundSettings
): Record<PlayerId, number> {
  const deltas: Record<PlayerId, number> = {};
  for (const id of [...teamA, ...teamB]) deltas[id] = 0;
  if (winner === "push") return deltas;

  const winners = winner === "A" ? teamA : teamB;
  const losers = winner === "A" ? teamB : teamA;

  if (mode === "2v2") {
    // Losing team pays `stake` each; pot split evenly among winners.
    const pot = stake * losers.length;
    const share = pot / winners.length;
    for (const id of winners) deltas[id] += share;
    for (const id of losers) deltas[id] -= stake;
    return deltas;
  }

  // lone / blind: wolf vs the field, head-to-head against each opponent.
  const mult = mode === "blind" ? settings.blindMult : settings.loneMult;
  const unit = mult * stake;
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

    const stakeApplied = settings.stake + carried;

    let winner: HoleWinner;
    if (teamABest === null || teamBBest === null) {
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
      settings
    );

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
