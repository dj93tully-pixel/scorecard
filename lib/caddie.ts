// lib/caddie.ts
// On-device "caddie": suggests the wolf's best play on a hole (pick a partner,
// go lone, or blind) from each player's recent form + their pops on the hole.
// Pure + framework-agnostic. NOT part of the money engine — advisory only.

import { Round, RoundComputation, defaultWolfForHole, PlayerId } from "./wolf";

export interface CaddieSuggestion {
  mode: "2v2" | "lone" | "blind";
  partnerId?: PlayerId;
  /** Display label: partner name, "Lone", or "Blind". */
  label: string;
}

// Logistic spread (in strokes) converting a net-score margin into a win chance.
const SIGMA = 1.6;
const logistic = (x: number) => 1 / (1 + Math.exp(-x / SIGMA));

/**
 * Suggest what the wolf should do on `hole`. Returns null if there isn't enough
 * to reason about (no wolf / hole). Considers each potential partner, lone, and
 * blind, scoring them by the wolf's expected money, and returns the best.
 */
export function suggestForHole(
  round: Round,
  computation: RoundComputation,
  hole: number
): CaddieSuggestion | null {
  const { players, course, teeOrder, settings } = round;
  if (players.length < 2) return null;
  const courseHole = course.holes.find((h) => h.number === hole);
  if (!courseHole) return null;
  const par = courseHole.par;

  const wolfId =
    round.entries.find((e) => e.hole === hole)?.wolfId ??
    defaultWolfForHole(teeOrder, hole);
  if (!wolfId) return null;
  const others = players.filter((p) => p.id !== wolfId);
  if (others.length === 0) return null;

  const parByHole = new Map(course.holes.map((h) => [h.number, h.par]));

  // Recent form = average (gross - par) over the last up to 3 scored holes.
  function form(pid: PlayerId): number {
    const recent = round.entries
      .filter((e) => e.hole !== hole && typeof e.grossScores[pid] === "number")
      .sort((a, b) => b.hole - a.hole)
      .slice(0, 3)
      .map((e) => e.grossScores[pid]! - (parByHole.get(e.hole) ?? e.grossScores[pid]!));
    if (recent.length === 0) return 0;
    return recent.reduce((s, x) => s + x, 0) / recent.length;
  }
  // Expected NET score on this hole: par + form, minus pops received here.
  function expNet(pid: PlayerId): number {
    const pops = computation.pops[pid]?.[hole] ?? 0;
    return par + form(pid) - pops;
  }

  const net = new Map(players.map((p) => [p.id, expNet(p.id)]));
  const stake = settings.stake || 1;
  const nOpp = others.length;
  const wolfNet = net.get(wolfId)!;

  // Expected money to the wolf given the team-best nets and the per-win payoff.
  const ev = (teamBest: number, fieldBest: number, winAmt: number) => {
    const margin = fieldBest - teamBest; // positive favors the wolf's side
    return (logistic(margin) - logistic(-margin)) * winAmt;
  };

  type Opt = { mode: CaddieSuggestion["mode"]; partnerId?: PlayerId; label: string; ev: number };
  const opts: Opt[] = [];

  // 2v2: each possible partner. Skip when picking a partner would leave no opponents
  // (a 2-player game) — Math.min(...[]) is Infinity, which floated a bogus "2v2"
  // suggestion to the top.
  for (const partner of others) {
    const opponents = others.filter((o) => o.id !== partner.id);
    if (opponents.length === 0) continue;
    const teamBest = Math.min(wolfNet, net.get(partner.id)!);
    const fieldBest = Math.min(...opponents.map((o) => net.get(o.id)!));
    opts.push({
      mode: "2v2",
      partnerId: partner.id,
      label: partner.name || "Partner",
      ev: ev(teamBest, fieldBest, stake),
    });
  }

  const fieldBestAll = Math.min(...others.map((o) => net.get(o.id)!));

  // Lone: wolf alone vs the field.
  opts.push({
    mode: "lone",
    label: "Lone",
    ev: ev(wolfNet, fieldBestAll, nOpp * (settings.loneMult || 1) * stake),
  });

  // Blind: only a sensible call when the wolf is clearly the best ball here
  // (declared before tee shots, higher multiplier, higher risk).
  if (fieldBestAll - wolfNet >= 1) {
    opts.push({
      mode: "blind",
      label: "Blind",
      ev: ev(wolfNet, fieldBestAll, nOpp * (settings.blindMult || 2) * stake),
    });
  }

  opts.sort((a, b) => b.ev - a.ev);
  const best = opts[0];
  return { mode: best.mode, partnerId: best.partnerId, label: best.label };
}
