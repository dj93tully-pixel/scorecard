// components/ScoresTab.tsx
// First-class scoring view: a vertical stack of hole boxes. Each box lets you
// pick the wolf + their choice (partner / lone / blind) and enter each player's
// gross score on compact player rows with plain number inputs. The golf
// circle/square notation lives on the scorecard (Card tab), not here.

"use client";

import { Hammer, Flag } from "lucide-react";
import {
  Round,
  RoundComputation,
  HoleEntry,
  defaultWolfForHole,
} from "@/lib/wolf";
import { formatMoney } from "@/lib/storage";

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

  const base: HoleEntry = {
    hole,
    wolfId: wolfId!,
    mode,
    partnerId,
    grossScores,
    hammer,
    forfeit,
  };
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
          <Chip
            active={mode === "blind"}
            color="alert"
            onClick={() => commit({ mode: "blind", partnerId: undefined })}
          >
            Blind
          </Chip>
        </div>
      </div>

      {/* Hammer + forfeit */}
      <div className="mb-3 flex flex-wrap items-end gap-x-5 gap-y-2">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Hammer
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={hammer === 1}
              color="alert"
              onClick={() => commit({ hammer: hammer === 1 ? 0 : 1 })}
            >
              <Hammer className="mr-1 inline h-3.5 w-3.5" />1×
            </Chip>
            <Chip
              active={hammer === 2}
              color="alert"
              onClick={() => commit({ hammer: hammer === 2 ? 0 : 2 })}
            >
              <Hammer className="mr-0.5 inline h-3.5 w-3.5" />
              <Hammer className="mr-1 inline h-3.5 w-3.5" />2×
            </Chip>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Forfeit
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={forfeit === "A"}
              onClick={() => commit({ forfeit: forfeit === "A" ? undefined : "A" })}
            >
              <Flag className="mr-1 inline h-3.5 w-3.5" />Wolf
            </Chip>
            <Chip
              active={forfeit === "B"}
              onClick={() => commit({ forfeit: forfeit === "B" ? undefined : "B" })}
            >
              <Flag className="mr-1 inline h-3.5 w-3.5" />Field
            </Chip>
          </div>
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

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-2 rounded-lg border-l-4 py-1 pl-2 pr-1 ${
                isWolf ? "border-alert" : "border-transparent"
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

              {/* Right: plain score input */}
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
                  commit({ grossScores: next });
                }}
                className="h-9 w-12 shrink-0 rounded-lg border border-card-border bg-card-bg text-center text-lg font-bold tabular-nums outline-none focus:border-primary"
              />
            </div>
          );
        })}
      </div>

      {/* Result */}
      {result && (
        <div className="mt-2 flex items-center justify-end gap-2 text-sm">
          {hammer > 0 && (
            <span className="text-xs font-bold uppercase tracking-wide text-alert">
              {hammer === 2 ? "double hammer" : "hammer"}
            </span>
          )}
          {forfeit && (
            <span className="text-xs font-bold uppercase tracking-wide text-alert">
              forfeit
            </span>
          )}
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
