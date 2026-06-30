// components/ScoreEntryTab.tsx
// Generic per-hole score entry shared by the non-Wolf game types (Skins, Best
// Ball, Vegas, Six-Six-Six). Each hole is a card with one net-aware score input
// per player; a pinned hole-jumper sits on top. The only input these games need
// is each player's gross score — teams/standings are derived by the engines.

"use client";

import { Hammer, Flag, Check, Zap } from "lucide-react";
import { Round, HoleEntry, computePops } from "@/lib/wolf";
import { computeBaseGame, gameTypeMeta, gameTypeOf, teamTag, TEAM_COLORS } from "@/lib/gametypes";
import { combinedHoleResults, pressCoverByHole } from "@/lib/engines/press";
import { carryByHole, HoleCarry } from "@/lib/carry";
import { CarryNote } from "./CarryNote";
import { holeHighlight } from "@/lib/holeHighlight";
import { GameHoleResult } from "@/lib/engines/types";
import { formatMoney } from "@/lib/storage";

const HAMMER_COLOR = "#7C3AED"; // vibrant purple, matches the Wolf Scores tab
const PICK_COLOR = "#2BC081"; // green check for an 11s hole the player is counting
const PRESS_COLOR = "#E8590C"; // burnt orange for a live press

function HoleCard({
  round,
  pops,
  hole,
  note,
  carry,
  pickCounts,
  segCover,
  fullCover,
  upsertEntry,
}: {
  round: Round;
  pops: Record<string, Record<number, number>>;
  hole: number;
  note?: GameHoleResult;
  carry?: HoleCarry; // push-carry split: normal / press / hammer
  pickCounts?: Record<string, number>; // 11s: each player's running picks (of 11)
  segCover?: number; // 9/6-presses covering this hole (for the ⚡9 ×N label)
  fullCover?: number; // 18-presses covering this hole (for the ⚡18 ×N label)
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
  const segN = segCover ?? 0;
  const fullN = fullCover ?? 0;

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
  // Press the rest of this six (Sixes) or this nine — shown as a bare number on
  // the scores card; the Card tab's press view keeps the F6/M6/B6 / F9/B9 labels.
  const segLabel = gt === "sixes" ? "6" : "9";

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
        ...holeHighlight(segN + fullN > 0, hammer > 0),
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

        {/* Press (rest of this nine/six, rest of 18), hammer, forfeit toggles.
            ⚡9 ×N shows when N presses (from overlapping holes) cover this one. */}
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {canPress && (
            <>
              <button
                onClick={() => commit({ pressSeg: !pressSeg })}
                aria-label={`Press — new bet on the rest of this ${gt === "sixes" ? "six" : "nine"}`}
                style={pressSeg ? { background: PRESS_COLOR, borderColor: PRESS_COLOR } : undefined}
                className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[13px] font-bold ${
                  pressSeg ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                }`}
              >
                <Zap className="h-[15px] w-[15px]" />
                {segLabel}
                {pressSeg && segN > 1 ? `×${segN}` : ""}
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
                  {pressFull && fullN > 1 ? `×${fullN}` : ""}
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

              {/* Money won/lost this hole, to the left of the score (as in Wolf) */}
              {!noHoleMoney && (note?.deltas[p.id] ?? 0) !== 0 && (
                <span
                  className={`shrink-0 font-serif text-sm font-bold tabular-nums ${
                    (note?.deltas[p.id] ?? 0) > 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {formatMoney(note?.deltas[p.id] ?? 0)}
                </span>
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

      {/* Push/carry note when nobody won the hole. When money carries, it's split
          into the normal bet (grey), the press (orange) and the hammer (purple),
          with a total beneath. Total/segment games (11s, Nassau) carry no note. */}
      {(() => {
        if (noHoleMoney) return null;
        const anyWinner = note && players.some((p) => (note.deltas[p.id] ?? 0) > 0);
        if (anyWinner) return null;
        if (carry) return <CarryNote carry={carry} hammer={hammer} />;
        if (!note || note.detail === "—") return null;
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
  // Per-hole carry split (normal / press / hammer) for the push-carry note.
  const carries = carryByHole(round);
  // Per-scope press coverage per hole — for the ⚡9/⚡18 ×N labels + highlight.
  const pressCovers = pressCoverByHole(round);
  const isElevens = gameTypeOf(round) === "elevens";

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
          carry={carries.get(h.number)}
          pickCounts={pickCounts}
          segCover={pressCovers.get(h.number)?.seg ?? 0}
          fullCover={pressCovers.get(h.number)?.full ?? 0}
          upsertEntry={upsertEntry}
        />
      ))}
    </div>
  );
}
