// lib/engines/teams.ts
// Team assignment shared by Best Ball and Vegas. Players are split into team A/B
// from settings.teams; anyone unassigned is alternated so a fresh game still has
// two playable sides.

import { Round, PlayerId } from "../wolf";

export function splitTeams(round: Round): { A: PlayerId[]; B: PlayerId[] } {
  const ids = round.players.map((p) => p.id);
  const assign = round.settings.teams ?? {};
  const A: PlayerId[] = [];
  const B: PlayerId[] = [];
  ids.forEach((id, i) => {
    const t = assign[id];
    if (t === "A") A.push(id);
    else if (t === "B") B.push(id);
    else (i % 2 === 0 ? A : B).push(id);
  });
  return { A, B };
}

export function teamOfPlayer(round: Round, id: PlayerId): "A" | "B" {
  return splitTeams(round).A.includes(id) ? "A" : "B";
}

// ── Multi-team support (Best Ball can run up to four teams A–D) ────────────────
export type TeamLetter = "A" | "B" | "C" | "D";
export const TEAM_LETTERS: TeamLetter[] = ["A", "B", "C", "D"];

/** True when any player is on team C or D — i.e. Best Ball is in 3–4 team mode. */
export function usesMultiTeam(round: Round): boolean {
  const assign = round.settings.teams ?? {};
  return round.players.some((p) => assign[p.id] === "C" || assign[p.id] === "D");
}

/** Non-empty team groups in A→D order. Unassigned players default to A. Used by
 *  multi-team Best Ball; 2-team games keep splitTeams' A/B alternation. */
export function teamGroups(round: Round): { letter: TeamLetter; ids: PlayerId[] }[] {
  const assign = round.settings.teams ?? {};
  const groups = new Map<TeamLetter, PlayerId[]>();
  for (const p of round.players) {
    const raw = assign[p.id];
    const t: TeamLetter = TEAM_LETTERS.includes(raw as TeamLetter) ? (raw as TeamLetter) : "A";
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(p.id);
  }
  return TEAM_LETTERS.filter((l) => groups.has(l)).map((l) => ({ letter: l, ids: groups.get(l)! }));
}

/** A player's team letter for Best Ball: A–D in multi-team mode, else the A/B split. */
export function teamLetterOf(round: Round, id: PlayerId): TeamLetter {
  if (usesMultiTeam(round)) {
    const t = round.settings.teams?.[id];
    return t === "B" || t === "C" || t === "D" ? t : "A";
  }
  return splitTeams(round).A.includes(id) ? "A" : "B";
}
