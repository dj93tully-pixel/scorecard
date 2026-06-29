// components/ScoreEntryTab.tsx
// Generic per-hole score entry shared by the non-Wolf game types (Skins, Best
// Ball, Vegas, Six-Six-Six). Each hole is a card with one net-aware score input
// per player; a pinned hole-jumper sits on top. The only input these games need
// is each player's gross score — teams/standings are derived by the engines.

"use client";

import { Hammer, Flag, Check, Zap } from "lucide-react";
import { Round, HoleEntry, computePops } from "@/lib/wolf";
import { computeGame, computeBaseGame, gameTypeMeta, gameTypeOf, teamTag, TEAM_COLORS } from "@/lib/gametypes";
import { combinedHoleResults, pressedHoles } from "@/lib/engines/press";
import { holeHighlight } from "@/lib/holeHighlight";
import { MoneyTrend } from "./MoneyTrend";
import { GameHoleResult } from "@/lib/engines/types";
import { formatMoney } from "@/lib/storage";

const HAMMER_COLOR = "#7C3AED"; // vibrant purple, matches the Wolf Scores tab
const PICK_COLOR = "#2BC081"; // green check for an 11s hole the player is counting
const PRESS_COLOR = "#E8590C"; // burnt orange for a live Nassau press

function HoleCard({
  round,
  pops,
  hole,
  note,
  pickCounts,
  pressed,
  upsertEntry,
}: {
  round: Round;
  pops: Record<string, Record<number, number>>;
  hole: number;
  note?: GameHoleResult;
  pickCounts?: Record<string, number>; // 11s: each player's running picks (of 11)
  pressed?: boolean; // this hole is covered by a press (highlight it)
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const { players, course } = round;
  const courseHole = course.holes.find((h) => h.number === hole);
  const par = courseHole?.par ?? null;
  const existing = round.entries.find((e) => e.hole === hole);
  const grossScores = existing?.grossScores ?? {};
  const hammer = existing?.hammer ?? 0;
  const forfeit = existing?.forfeit;
  const elevenPicks = existing?.elevenPicks ?? {};
  const pressSeg = existing?.pressSeg ?? false;
  const pressFull = existing?.pressFull ?? false;

  const base: HoleEntry = {
    hole,
    wolfId: "",
    mode: "2v2",
    grossScores,
    hammer,
    forfeit,
    elevenPicks,
    pressSeg,
    pressFull,
  };
  const commit = (patch: Partial<HoleEntry>) => upsertEntry(hole, patch, base);

  // Forfeit (one side concedes) only makes sense for the two-team match games.
  // Hammer applies everywhere except stroke play and 11s (which has neither).
  const gt = gameTypeOf(round);
  const forfeitable = gt === "bestball" || gt === "sixes";
  const hammerable = gt !== "stroke" && gt !== "elevens" && gt !== "nassau";
  const eleven = gt === "elevens";
  // Segment/total games settle on totals, not per hole — no per-hole money note.
  const noHoleMoney = gt === "elevens" || gt === "nassau";
  // Press is in every game except 11s (Nassau needs two fixed sides → teams only).
  const canPress =
    gt !== "elevens" &&
    !(gt === "nassau" && (round.settings.nassauFormat ?? "teams") === "robin");
  const segLabel = gt === "sixes" ? "6" : "9"; // press the rest of this six / nine

  // 11s: toggle whether this player is counting this hole toward their score.
  function togglePick(pid: string) {
    const next = { ...elevenPicks };
    if (next[pid]) delete next[pid];
    else next[pid] = true;
    commit({ elevenPicks: next });
  }

  return (
    <div
      id={`hole-${hole}`}
      style={{
        scrollMarginTop: "calc(var(--header-h, 88px) + 6rem)",
        ...holeHighlight(!!pressed, hammer > 0),
      }}
      className="rounded-xl border border-card-border bg-card-bg p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="leading-tight">
          <div className="text-lg font-extrabold">Hole {hole}</div>
          <div className="text-xs text-text-muted">
            Par {par ?? "–"} · Hcp {courseHole?.strokeIndex ?? "–"}
          </div>
        </div>

        {/* Press (rest of this nine/six, rest of 18), hammer, forfeit toggles. */}
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {canPress && (
            <>
              <button
                onClick={() => commit({ pressSeg: !pressSeg })}
                aria-label={`Press — new bet on the rest of this ${segLabel === "6" ? "six" : "nine"}`}
                style={pressSeg ? { background: PRESS_COLOR, borderColor: PRESS_COLOR } : undefined}
                className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[13px] font-bold ${
                  pressSeg ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                }`}
              >
                <Zap className="h-[15px] w-[15px]" />
                {segLabel}
              </button>
              {/* Six-Six-Six only presses the six; on the back nine "rest of 18"
                  equals "rest of this nine", so the 18 button is hidden there. */}
              {gt !== "sixes" && hole <= 9 && (
                <button
                  onClick={() => commit({ pressFull: !pressFull })}
                  aria-label="Press — new bet on the rest of the round"
                  style={pressFull ? { background: PRESS_COLOR, borderColor: PRESS_COLOR } : undefined}
                  className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[13px] font-bold ${
                    pressFull ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                  }`}
                >
                  <Zap className="h-[15px] w-[15px]" />
                  18
                </button>
              )}
            </>
          )}
          {hammerable && (
            <>
              <button
                onClick={() => commit({ hammer: hammer === 1 ? 0 : 1 })}
                aria-label="Hammer — double the hole"
                style={hammer === 1 ? { background: HAMMER_COLOR, borderColor: HAMMER_COLOR } : undefined}
                className={`flex items-center rounded-lg border px-2 py-1.5 ${
                  hammer === 1 ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                }`}
              >
                <Hammer className="h-[15px] w-[15px]" />
              </button>
              <button
                onClick={() => commit({ hammer: hammer === 2 ? 0 : 2 })}
                aria-label="Double hammer — quadruple the hole"
                style={hammer === 2 ? { background: HAMMER_COLOR, borderColor: HAMMER_COLOR } : undefined}
                className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 ${
                  hammer === 2 ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                }`}
              >
                <Hammer className="h-[15px] w-[15px]" />
                <Hammer className="h-[15px] w-[15px]" />
              </button>
            </>
          )}
          {forfeitable &&
            (["A", "B"] as const).map((side) => (
              <button
                key={side}
                onClick={() => commit({ forfeit: forfeit === side ? undefined : side })}
                aria-label={`Team ${side} forfeits`}
                style={
                  forfeit === side
                    ? { background: TEAM_COLORS[side], borderColor: TEAM_COLORS[side] }
                    : undefined
                }
                className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[13px] font-bold ${
                  forfeit === side
                    ? "text-on-dark"
                    : "border-card-border bg-card-bg text-text-muted"
                }`}
              >
                <Flag className="h-[15px] w-[15px]" />
                {side}
              </button>
            ))}
        </div>
      </div>

      <div className="space-y-1">
        {players.map((p) => {
          const tag = teamTag(round, p.id, hole);
          const myPops = pops[p.id]?.[hole] ?? 0;
          const score = grossScores[p.id];
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg py-1 pl-2 pr-1"
            >
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {tag && (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-on-dark"
                    style={{ background: tag.color }}
                  >
                    {tag.label}
                  </span>
                )}
                <span className="truncate font-medium text-text-primary">
                  {p.name || "Unnamed"}
                </span>
                {myPops > 0 && (
                  <span className="inline-flex shrink-0 gap-0.5">
                    {Array.from({ length: myPops }).map((_, i) => (
                      <span key={i} className="h-[5px] w-[5px] rounded-full bg-primary" />
                    ))}
                  </span>
                )}
                {eleven &&
                  (() => {
                    const c = pickCounts?.[p.id] ?? 0;
                    return (
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                          c === 11
                            ? "bg-positive/15 text-positive"
                            : c > 11
                              ? "bg-negative/15 text-negative"
                              : "bg-surface-2 text-text-muted"
                        }`}
                      >
                        {c}/11
                      </span>
                    );
                  })()}
              </div>

              {eleven && (
                <button
                  onClick={() => togglePick(p.id)}
                  aria-label={`${p.name || "Player"} counts this hole`}
                  style={
                    elevenPicks[p.id]
                      ? { background: PICK_COLOR, borderColor: PICK_COLOR }
                      : undefined
                  }
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    elevenPicks[p.id]
                      ? "text-on-dark"
                      : "border-card-border bg-card-bg text-text-faint"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </button>
              )}

              <input
                type="number"
                inputMode="numeric"
                value={score ?? ""}
                placeholder="–"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = { ...grossScores };
                  if (v === "") delete next[p.id];
                  else next[p.id] = Math.max(1, parseInt(v) || 1);
                  upsertEntry(hole, { grossScores: next }, base);
                }}
                className="h-9 w-12 shrink-0 rounded-lg border border-card-border bg-card-bg text-center text-lg font-bold tabular-nums outline-none focus:border-primary"
              />
            </div>
          );
        })}
      </div>

      {/* Result note — the money each winner takes on the hole, or push/carry.
          Total/segment games (11s, Nassau) settle on totals, not per hole, so
          per-hole money isn't shown — the standings carry the meaningful readout. */}
      {(() => {
        if (noHoleMoney || !note || note.detail === "—") return null;
        const winners = players.filter((p) => (note.deltas[p.id] ?? 0) > 0);
        if (winners.length > 0) {
          return (
            <div className="mt-2 text-right text-sm font-bold text-positive">
              {winners
                .map((p) => `${(p.name || "?").split(" ")[0]} ${formatMoney(note.deltas[p.id] ?? 0)}`)
                .join(", ")}
            </div>
          );
        }
        return <div className="mt-2 text-right text-sm text-text-muted">{note.detail}</div>;
      })()}
    </div>
  );
}

export function ScoreEntryTab({
  round,
  upsertEntry,
}: {
  round: Round;
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const meta = gameTypeMeta(round);
  const ready =
    round.players.length >= meta.players.min && round.course.holes.length > 0;

  const goToHole = (n: number) => {
    if (n === 1) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document
      .getElementById(`hole-${n}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!ready) {
    return (
      <div className="rounded-xl border border-dashed border-card-border bg-card-bg p-6 text-center text-sm text-text-muted">
        Add at least {meta.players.min} players and a course on the{" "}
        <span className="font-semibold">Setup</span> tab to start scoring.
      </div>
    );
  }

  const pops = computePops(round.players, round.course, round.settings.handicapMode);
  // Per-hole money = base bet + any press money landing on that hole.
  const combined = combinedHoleResults(round, (r) => {
    const g = computeBaseGame(r);
    return { ledger: g.ledger, holeResults: g.holeResults };
  });
  const resultByHole = new Map(combined.map((r) => [r.hole, r]));
  // Holes any press covers — highlighted, not just the hole it was tapped on.
  const pressCover = pressedHoles(round);
  const gt = gameTypeOf(round);
  const isElevens = gt === "elevens";

  // Total/segment games: the money as it would settle after each played hole,
  // for the "if it ended now" standings + trendline below the holes.
  const showTrend = gt === "stroke" || gt === "elevens" || gt === "nassau";
  const prefixLedgers: Record<string, number>[] = [];
  if (showTrend) {
    const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
    const scored = (n: number) => {
      const e = entryByHole.get(n);
      return !!e && round.players.some((p) => typeof e.grossScores[p.id] === "number");
    };
    let lastIdx = -1;
    round.course.holes.forEach((h, i) => {
      if (scored(h.number)) lastIdx = i;
    });
    for (let i = 0; i <= lastIdx; i++) {
      const upTo = new Set(round.course.holes.slice(0, i + 1).map((h) => h.number));
      const prefix = { ...round, entries: round.entries.filter((e) => upTo.has(e.hole)) };
      prefixLedgers.push(computeGame(prefix).ledger);
    }
  }

  // 11s: each player's running number of declared (checked) holes, of 11.
  const pickCounts: Record<string, number> = {};
  if (isElevens) {
    for (const p of round.players) pickCounts[p.id] = 0;
    for (const e of round.entries) {
      for (const p of round.players) if (e.elevenPicks?.[p.id]) pickCounts[p.id] += 1;
    }
  }

  return (
    <div className="space-y-3">
      {/* Quick hole jumper: one thin pinned row, scrolls sideways. */}
      <div
        className="sticky z-10 flex gap-1 overflow-x-auto rounded-lg border border-primary/30 px-1.5 py-1.5"
        style={{ top: "calc(var(--header-h, 88px) + 3.4rem)", background: "#E7F0FF" }}
      >
        {round.course.holes.map((h) => (
          <button
            key={h.number}
            onClick={() => goToHole(h.number)}
            aria-label={`Go to hole ${h.number}`}
            className="h-7 w-7 shrink-0 rounded-md border border-primary/30 bg-card-bg text-xs font-semibold tabular-nums text-primary active:bg-primary active:text-on-dark"
          >
            {h.number}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">{meta.label}</h2>
        <span className="text-sm text-text-muted">{round.course.name}</span>
      </div>

      {round.course.holes.map((h) => (
        <HoleCard
          key={h.number}
          round={round}
          pops={pops}
          hole={h.number}
          note={resultByHole.get(h.number)}
          pickCounts={pickCounts}
          pressed={pressCover.has(h.number)}
          upsertEntry={upsertEntry}
        />
      ))}

      {showTrend && <MoneyTrend round={round} prefixLedgers={prefixLedgers} />}
    </div>
  );
}
