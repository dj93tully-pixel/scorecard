// components/ScoresTab.tsx
// First-class scoring view: a vertical stack of hole boxes. Each box lets you
// pick the wolf + their choice (partner / lone / blind) and enter each player's
// gross score on styled player rows. Entered scores render with golf circle/
// square notation (rings = strokes from par). Presentation only — no money math.

"use client";

import { CSSProperties } from "react";
import {
  Round,
  RoundComputation,
  HoleEntry,
  defaultWolfForHole,
} from "@/lib/wolf";

// ── Score shape: concentric rings via layered box-shadow ───────────────────
// rel = gross - par. Under par → circles, over par → squares, par → plain.
// Monochrome outlines; gaps in page-bg so rings read as separate outlines.
function shapeStyle(rel: number | null): CSSProperties {
  if (rel === null || rel === 0) return {};
  const n = Math.min(Math.abs(rel), 4);
  const D = "#16181D";
  const G = "#F4F5F7";
  const layers: Array<[number, string]> =
    n === 1
      ? [[1.2, D]]
      : n === 2
        ? [
            [1.2, D],
            [2.6, G],
            [3.8, D],
          ]
        : n === 3
          ? [
              [1.2, D],
              [2.6, G],
              [3.8, D],
              [5.2, G],
              [6.4, D],
            ]
          : [
              [1.2, D],
              [2.6, G],
              [3.8, D],
              [5.2, G],
              [6.4, D],
              [7.8, G],
              [9, D],
            ];
  return {
    boxShadow: layers.map(([w, c]) => `0 0 0 ${w}px ${c}`).join(", "),
    borderRadius: rel < 0 ? "50%" : "3px",
  };
}

function Chip({
  active,
  color = "primary",
  onClick,
  children,
}: {
  active: boolean;
  color?: "primary" | "alert";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls =
    color === "alert" ? "bg-alert text-on-dark" : "bg-primary text-on-dark";
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
        active ? activeCls : "bg-page-bg text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

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
  const { players, teeOrder, settings, course } = round;
  const courseHole = course.holes.find((h) => h.number === hole);
  const par = courseHole?.par ?? null;
  const existing = round.entries.find((e) => e.hole === hole);

  const defaultWolf = defaultWolfForHole(teeOrder, hole);
  const wolfId = existing?.wolfId ?? defaultWolf ?? players[0]?.id;
  const mode = existing?.mode ?? "2v2";
  const partnerId = existing?.partnerId;
  const grossScores = existing?.grossScores ?? {};

  const base: HoleEntry = { hole, wolfId: wolfId!, mode, partnerId, grossScores };
  const commit = (patch: Partial<HoleEntry>) => upsertEntry(hole, patch, base);

  const nonWolf = players.filter((p) => p.id !== wolfId);
  const result = computation.results.find((r) => r.hole === hole);
  const short = (n: string) => (n || "?").slice(0, 14);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-3">
      {/* Header */}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-lg font-extrabold">Hole {hole}</span>
        <span className="text-xs text-text-muted">
          Par {par ?? "–"} · Hcp {courseHole?.strokeIndex ?? "–"}
        </span>
      </div>

      {/* Wolf selector */}
      <div className="mb-2">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Wolf
        </div>
        <div className="flex flex-wrap gap-1.5">
          {players.map((p) => (
            <Chip
              key={p.id}
              active={p.id === wolfId}
              color="alert"
              onClick={() =>
                commit({
                  wolfId: p.id,
                  partnerId: partnerId === p.id ? undefined : partnerId,
                })
              }
            >
              {short(p.name)}
            </Chip>
          ))}
        </div>
      </div>

      {/* Choice selector */}
      <div className="mb-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Choice
        </div>
        <div className="flex flex-wrap gap-1.5">
          {nonWolf.map((p) => (
            <Chip
              key={p.id}
              active={mode === "2v2" && partnerId === p.id}
              onClick={() => commit({ mode: "2v2", partnerId: p.id })}
            >
              {short(p.name)}
            </Chip>
          ))}
          <Chip
            active={mode === "lone"}
            color="alert"
            onClick={() => commit({ mode: "lone", partnerId: undefined })}
          >
            Lone
          </Chip>
          {settings.blindEnabled && (
            <Chip
              active={mode === "blind"}
              color="alert"
              onClick={() => commit({ mode: "blind", partnerId: undefined })}
            >
              Blind
            </Chip>
          )}
        </div>
      </div>

      {/* Player rows */}
      <div className="space-y-1.5">
        {players.map((p) => {
          const isWolf = p.id === wolfId;
          const isPartner = p.id === partnerId && mode === "2v2";
          const onTeamA = isWolf || isPartner;
          const myPops = computation.pops[p.id]?.[hole] ?? 0;
          const teePos = teeOrder.indexOf(p.id) + 1;
          const score = grossScores[p.id];
          const hasScore = typeof score === "number";
          const rel = hasScore && par !== null ? score - par : null;

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-2 overflow-visible rounded-lg border-l-4 py-2.5 pl-2 pr-1 ${
                isWolf ? "border-alert" : "border-transparent"
              } ${onTeamA ? "bg-row-tint" : "bg-transparent"}`}
            >
              {/* Left: identity */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-text-primary">
                    {p.name || "Unnamed"}
                  </span>
                  {/* pops dots (handicap stroke on this hole) */}
                  {myPops > 0 && (
                    <span className="inline-flex shrink-0 gap-0.5">
                      {Array.from({ length: myPops }).map((_, i) => (
                        <span
                          key={i}
                          className="h-[5px] w-[5px] rounded-full bg-primary"
                        />
                      ))}
                    </span>
                  )}
                  {isWolf && (
                    <span className="shrink-0 rounded-full bg-alert px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-dark">
                      WOLF
                    </span>
                  )}
                  {isPartner && (
                    <span className="shrink-0 rounded-full border border-primary/40 bg-white px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent-on-light">
                      PARTNER
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[#8A9099]">
                  Tee {teePos}
                  {hasScore && par !== null ? ` · net ${score - myPops}` : ""}
                </span>
              </div>

              {/* Right: score input with circle/square notation */}
              <div className="flex shrink-0 items-center justify-center px-3 py-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={score ?? ""}
                  placeholder={par !== null ? String(par) : ""}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = { ...grossScores };
                    if (v === "") delete next[p.id];
                    else next[p.id] = Math.max(1, parseInt(v) || 1);
                    commit({ grossScores: next });
                  }}
                  style={shapeStyle(rel)}
                  className={`h-11 w-11 bg-card-bg text-center text-xl font-bold tabular-nums outline-none focus:outline-2 focus:outline-primary ${
                    rel === null || rel === 0
                      ? "rounded-lg border border-card-border"
                      : "border-0"
                  }`}
                />
              </div>
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
              {result.winner === "A" ? "Wolf team" : "Field"} wins{" "}
              <span className="text-positive">${result.pot}</span>
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
