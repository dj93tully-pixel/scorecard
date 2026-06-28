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
