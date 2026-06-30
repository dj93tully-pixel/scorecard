// lib/engines/types.ts
// Normalized output shared by every non-Wolf game engine. Each engine is pure
// (no React / Supabase) and takes a Round, returning money + per-hole outcomes
// the generic StandingsView renders. Money always sums to 0 (zero-sum invariant).

import { PlayerId } from "../wolf";

export interface GameHoleResult {
  hole: number;
  /** true once the hole is fully scored AND money moved (a tie/carry is false). */
  decided: boolean;
  /** Short human description for the per-hole breakdown list. */
  detail: string;
  /** Money change per player for this hole; sums to 0. */
  deltas: Record<PlayerId, number>;
  /** Dollar amount carrying forward from this hole when it pushes (0 otherwise). */
  carry?: number;
}

export interface GameResult {
  /** Running money total per player across the round; sums to 0. */
  ledger: Record<PlayerId, number>;
  /** Pops grid for display: playerId → holeNumber → strokes received. */
  pops: Record<PlayerId, Record<number, number>>;
  /** Per-hole outcomes in hole order. */
  holeResults: GameHoleResult[];
  /** Extra per-player stats for the standings table (e.g. { skins: 3 }). */
  stats: Record<PlayerId, Record<string, number | string>>;
}

/** Net score for a player on a hole. */
export function netOf(
  gross: number | undefined,
  pops: number
): number | null {
  return typeof gross === "number" ? gross - pops : null;
}
