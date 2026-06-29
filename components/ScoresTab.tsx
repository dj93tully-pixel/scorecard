// components/ScoresTab.tsx
// First-class scoring view: a vertical stack of hole boxes. Each box lets you
// pick the wolf + their choice (partner / lone / blind) and enter each player's
// gross score on compact player rows with plain number inputs. The golf
// circle/square notation lives on the scorecard (Card tab), not here.

"use client";

import { Hammer, Flag, Zap, PawPrint, Users, ChevronDown } from "lucide-react";
import {
  Round,
  RoundComputation,
  HoleEntry,
  defaultWolfForHole,
} from "@/lib/wolf";
import { formatMoney } from "@/lib/storage";

// Vibrant peacock-family accents for the hole-card toggles.
const HAMMER = "#7C3AED"; // vibrant purple
const FORFEIT = "#06B6A4"; // vibrant cyan-bluish-green
const PRESS = "#E8590C"; // burnt orange

function HoleBox({
  round,
  computation,
  hole,
  upsertEntry,
}: {
  round: Round;
  computation: RoundComputation;
  hole: number;
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const { players, teeOrder, course } = round;
  const courseHole = course.holes.find((h) => h.number === hole);
  const par = courseHole?.par ?? null;
  const existing = round.entries.find((e) => e.hole === hole);

  const defaultWolf = defaultWolfForHole(teeOrder, hole);
  const wolfId = existing?.wolfId ?? defaultWolf ?? players[0]?.id;
  const mode = existing?.mode ?? "2v2";
  const partnerId = existing?.partnerId;
  const grossScores = existing?.grossScores ?? {};
  const hammer = existing?.hammer ?? 0;
  const forfeit = existing?.forfeit;
  const pressSeg = existing?.pressSeg ?? false;
  const pressFull = existing?.pressFull ?? false;

  const base: HoleEntry = {
    hole,
    wolfId: wolfId!,
    mode,
    partnerId,
    grossScores,
    hammer,
    forfeit,
    pressSeg,
    pressFull,
  };
  const commit = (patch: Partial<HoleEntry>) => upsertEntry(hole, patch, base);

  const nonWolf = players.filter((p) => p.id !== wolfId);
  const result = computation.results.find((r) => r.hole === hole);
  const short = (n: string) => (n || "?").slice(0, 14);

  // Partner dropdown value: a player id, "lone", "blind", or "" (no partner).
  const partnerValue =
    mode === "lone" ? "lone" : mode === "blind" ? "blind" : partnerId ?? "";
  const partnerSelected =
    mode === "lone" || mode === "blind" || (mode === "2v2" && !!partnerId);
  function choosePartner(v: string) {
    if (v === "lone") commit({ mode: "lone", partnerId: undefined });
    else if (v === "blind") commit({ mode: "blind", partnerId: undefined });
    else if (v === "") commit({ mode: "2v2", partnerId: undefined });
    else commit({ mode: "2v2", partnerId: v });
  }

  return (
    <div
      id={`hole-${hole}`}
      style={{ scrollMarginTop: "calc(var(--header-h, 88px) + 6rem)" }}
      className="rounded-xl border border-card-border bg-card-bg p-3"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="leading-tight">
          <div className="text-lg font-extrabold">Hole {hole}</div>
          <div className="text-xs text-text-muted">
            Par {par ?? "–"} · Hcp {courseHole?.strokeIndex ?? "–"}
          </div>
        </div>

        {/* Press + hammer + forfeit toggles */}
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            onClick={() => commit({ pressSeg: !pressSeg })}
            aria-label="Press — new bet on the rest of this nine"
            style={pressSeg ? { background: PRESS, borderColor: PRESS } : undefined}
            className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[13px] font-bold ${
              pressSeg ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Zap className="h-[15px] w-[15px]" />9
          </button>
          {hole <= 9 && (
            <button
              onClick={() => commit({ pressFull: !pressFull })}
              aria-label="Press — new bet on the rest of the round"
              style={pressFull ? { background: PRESS, borderColor: PRESS } : undefined}
              className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[13px] font-bold ${
                pressFull ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
              }`}
            >
              <Zap className="h-[15px] w-[15px]" />18
            </button>
          )}
          <button
            onClick={() => commit({ hammer: hammer === 1 ? 0 : 1 })}
            aria-label="Hammer — double the hole"
            style={hammer === 1 ? { background: HAMMER, borderColor: HAMMER } : undefined}
            className={`flex items-center rounded-lg border px-2 py-1.5 ${
              hammer === 1 ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Hammer className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={() => commit({ hammer: hammer === 2 ? 0 : 2 })}
            aria-label="Double hammer — quadruple the hole"
            style={hammer === 2 ? { background: HAMMER, borderColor: HAMMER } : undefined}
            className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 ${
              hammer === 2 ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Hammer className="h-[15px] w-[15px]" />
            <Hammer className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={() => commit({ forfeit: forfeit === "A" ? undefined : "A" })}
            aria-label="Wolf forfeits"
            style={forfeit === "A" ? { background: FORFEIT, borderColor: FORFEIT } : undefined}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[13px] font-medium ${
              forfeit === "A" ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Flag className="h-[15px] w-[15px]" />W
          </button>
          <button
            onClick={() => commit({ forfeit: forfeit === "B" ? undefined : "B" })}
            aria-label="Field forfeits"
            style={forfeit === "B" ? { background: FORFEIT, borderColor: FORFEIT } : undefined}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[13px] font-medium ${
              forfeit === "B" ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Flag className="h-[15px] w-[15px]" />F
          </button>
        </div>
      </div>

      {/* Wolf + partner selectors */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Wolf (red-tinted dropdown) */}
        <div
          className="relative inline-flex items-center rounded-lg border"
          style={{ background: "#FBE9EE", borderColor: "#F3C2D0" }}
        >
          <PawPrint className="pointer-events-none absolute left-2 h-[15px] w-[15px] text-alert" />
          <select
            aria-label="Wolf"
            value={wolfId}
            onChange={(e) =>
              commit({
                wolfId: e.target.value,
                partnerId: partnerId === e.target.value ? undefined : partnerId,
              })
            }
            className="appearance-none bg-transparent py-1.5 pl-7 pr-6 text-[13px] font-medium text-alert outline-none"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {short(p.name)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 h-[15px] w-[15px] text-alert" />
        </div>

        {/* Partner / Lone / Blind */}
        <div
          className={`relative inline-flex items-center rounded-lg border ${
            partnerSelected ? "border-primary bg-primary" : "border-card-border bg-card-bg"
          }`}
        >
          <Users
            className={`pointer-events-none absolute left-2 h-[15px] w-[15px] ${
              partnerSelected ? "text-on-dark" : "text-text-muted"
            }`}
          />
          <select
            aria-label="Partner"
            value={partnerValue}
            onChange={(e) => choosePartner(e.target.value)}
            className={`appearance-none bg-transparent py-1.5 pl-7 pr-6 text-[13px] font-medium outline-none ${
              partnerSelected ? "text-on-dark" : "text-text-muted"
            }`}
          >
            <option value="">Partner</option>
            {nonWolf.map((p) => (
              <option key={p.id} value={p.id}>
                {short(p.name)}
              </option>
            ))}
            <option value="lone">Lone</option>
            <option value="blind">Blind</option>
          </select>
          <ChevronDown
            className={`pointer-events-none absolute right-1.5 h-[15px] w-[15px] ${
              partnerSelected ? "text-on-dark" : "text-text-muted"
            }`}
          />
        </div>
      </div>

      {/* Player rows (compact, single line) */}
      <div className="space-y-1">
        {players.map((p) => {
          const isWolf = p.id === wolfId;
          const isPartner = p.id === partnerId && mode === "2v2";
          const onTeamA = isWolf || isPartner;
          const myPops = computation.pops[p.id]?.[hole] ?? 0;
          const score = grossScores[p.id];
          const delta = result?.deltas[p.id] ?? 0;
          // This player's side conceded → scores aren't needed.
          const conceded =
            (forfeit === "A" && onTeamA) || (forfeit === "B" && !onTeamA);

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-2 rounded-lg border-l-4 py-1 pl-2 pr-1 ${
                isWolf ? "border-alert" : isPartner ? "border-primary" : "border-transparent"
              } ${onTeamA ? "bg-row-tint" : "bg-transparent"}`}
            >
              {/* Left: identity */}
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate font-medium text-text-primary">
                  {p.name || "Unnamed"}
                </span>
                {/* pops dots (handicap stroke on this hole) */}
                {myPops > 0 && (
                  <span className="inline-flex shrink-0 gap-0.5">
                    {Array.from({ length: myPops }).map((_, i) => (
                      <span key={i} className="h-[5px] w-[5px] rounded-full bg-primary" />
                    ))}
                  </span>
                )}
                {conceded && (
                  <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-text-faint">
                    conceded
                  </span>
                )}
              </div>

              {/* Money won/lost this hole */}
              {delta !== 0 && (
                <span
                  className={`shrink-0 font-serif text-sm font-bold tabular-nums ${
                    delta > 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {formatMoney(delta)}
                </span>
              )}

              {/* Right: plain score input (disabled when this side conceded) */}
              <input
                type="number"
                inputMode="numeric"
                value={score ?? ""}
                placeholder="–"
                disabled={conceded}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = { ...grossScores };
                  if (v === "") delete next[p.id];
                  else next[p.id] = Math.max(1, parseInt(v) || 1);
                  commit({ grossScores: next });
                }}
                className={`h-9 w-12 shrink-0 rounded-lg border text-center text-lg font-bold tabular-nums outline-none ${
                  conceded
                    ? "border-card-border bg-surface-2 text-text-faint opacity-60"
                    : "border-card-border bg-card-bg focus:border-primary"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Result */}
      {result && (
        <div className="mt-2 text-right text-sm">
          {result.winner === "push" ? (
            <span className="text-text-faint">
              {result.carriedToNext > 0
                ? `Push — $${result.carriedToNext} carries`
                : "Push"}
            </span>
          ) : (
            <span className="font-bold">
              {hammer > 0 && (
                <span className="text-text-muted">{2 ** hammer}× · </span>
              )}
              {result.winner === "A" ? "Wolf" : "Field"} wins{" "}
              <span className="text-positive">${result.pot}</span>
              {forfeit && <span className="font-medium text-text-muted"> · forfeit</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ScoresTab({
  round,
  computation,
  upsertEntry,
}: {
  round: Round;
  computation: RoundComputation;
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const ready = round.players.length >= 3 && round.course.holes.length > 0;

  // Jump to a hole's card. The card carries scroll-margin-top so it lands just
  // below the sticky tab bar rather than under it. Hole 1 is the first card, so
  // jump all the way to the top instead — revealing the Scores/course header.
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
        Add players and a course on the <span className="font-semibold">Setup</span>{" "}
        tab to start scoring.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Quick hole jumper: one thin row, scrolls sideways, pinned below the
          tab bar so it stays reachable while scrolling the holes. */}
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
        <h2 className="text-xl font-bold">Scores</h2>
        <span className="text-sm text-text-muted">{round.course.name}</span>
      </div>

      {round.course.holes.map((h) => (
        <HoleBox
          key={h.number}
          round={round}
          computation={computation}
          hole={h.number}
          upsertEntry={upsertEntry}
        />
      ))}
    </div>
  );
}
