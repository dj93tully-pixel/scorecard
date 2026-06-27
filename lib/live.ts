// lib/live.ts
// Presentation helper: derive a broadcast-ticker summary from a round + its
// computed ledger. Reads values only — no engine math.

import { Round, RoundComputation, defaultWolfForHole } from "./wolf";
import { formatMoney } from "./storage";
import { suggestForHole } from "./caddie";
import type { TickerData } from "./header-context";

export function liveSummary(round: Round, computation: RoundComputation): TickerData {
  const { players, course, teeOrder } = round;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const allScored = (hole: number) => {
    const e = entryByHole.get(hole);
    if (!e) return false;
    return players.every((p) => typeof e.grossScores[p.id] === "number");
  };

  const playedCount = course.holes.filter((h) => allScored(h.number)).length;
  const next = course.holes.find((h) => !allScored(h.number));
  const isFinal = !next && course.holes.length > 0;
  const currentHole = next?.number ?? course.holes.length;

  const wolfId =
    entryByHole.get(currentHole)?.wolfId ?? defaultWolfForHole(teeOrder, currentHole);
  const wolf = players.find((p) => p.id === wolfId);

  let leader = players[0];
  let best = -Infinity;
  for (const p of players) {
    const v = computation.ledger[p.id] ?? 0;
    if (v > best) {
      best = v;
      leader = p;
    }
  }
  const anyMoney = players.some((p) => (computation.ledger[p.id] ?? 0) !== 0);

  const meta: string[] = [];
  if (!isFinal && wolf) meta.push(`Wolf: ${wolf.name || "—"}`);
  if (anyMoney && leader) meta.push(`Lead: ${leader.name || "—"} ${formatMoney(best)}`);

  // Caddie suggestion for the hole currently up (right of the leader).
  if (!isFinal) {
    const suggestion = suggestForHole(round, computation, currentHole);
    if (suggestion) meta.push(`Magic: ${suggestion.label}`);
  }

  return {
    live: playedCount > 0 && !isFinal,
    primary: isFinal ? "Final" : `Hole ${currentHole}`,
    meta: meta.join("  ·  ") || undefined,
  };
}
