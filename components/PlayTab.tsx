// components/PlayTab.tsx
// Hole-by-hole Wolf flow: rotate (or override) the wolf, choose partner / lone /
// blind, enter gross scores, and see the live result + running ledger.

"use client";

import {
  Round,
  RoundComputation,
  HoleEntry,
  defaultWolfForHole,
} from "@/lib/wolf";
import { formatMoney } from "@/lib/storage";

export function PlayTab({
  round,
  computation,
  hole,
  setHole,
  upsertEntry,
}: {
  round: Round;
  computation: RoundComputation;
  hole: number;
  setHole: (h: number) => void;
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const { players, teeOrder, settings, course } = round;
  const courseHole = course.holes.find((h) => h.number === hole);
  const existing = round.entries.find((e) => e.hole === hole);

  const defaultWolf = defaultWolfForHole(teeOrder, hole);
  const wolfId = existing?.wolfId ?? defaultWolf ?? players[0]?.id;
  const mode = existing?.mode ?? "2v2";
  const partnerId = existing?.partnerId;
  const grossScores = existing?.grossScores ?? {};

  const base: HoleEntry = {
    hole,
    wolfId: wolfId!,
    mode,
    partnerId,
    grossScores,
  };
  const commit = (patch: Partial<HoleEntry>) => upsertEntry(hole, patch, base);

  const wolf = players.find((p) => p.id === wolfId);
  const nonWolf = players.filter((p) => p.id !== wolfId);
  const result = computation.results.find((r) => r.hole === hole);
  const allScored = players.every((p) => typeof grossScores[p.id] === "number");

  function setScore(pid: string, value: number) {
    commit({ grossScores: { ...grossScores, [pid]: value } });
  }
  function bump(pid: string, delta: number) {
    const current = grossScores[pid] ?? courseHole?.par ?? 4;
    const next = Math.max(1, current + delta);
    setScore(pid, next);
  }

  const teamARed = mode === "lone" || mode === "blind";

  return (
    <div className="space-y-4">
      {/* Hole navigator */}
      <div className="flex items-center justify-between rounded-xl border border-card-border bg-card-bg px-3 py-3">
        <button
          onClick={() => setHole(Math.max(1, hole - 1))}
          disabled={hole <= 1}
          className="h-11 w-11 rounded-lg bg-page-bg text-xl font-bold disabled:opacity-30"
          aria-label="Previous hole"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-text-muted">Hole</div>
          <div className="text-3xl font-extrabold leading-none">{hole}</div>
          <div className="mt-1 text-xs text-text-muted">
            Par {courseHole?.par ?? "–"} · SI {courseHole?.strokeIndex ?? "–"}
          </div>
        </div>
        <button
          onClick={() => setHole(Math.min(course.holes.length, hole + 1))}
          disabled={hole >= course.holes.length}
          className="h-11 w-11 rounded-lg bg-page-bg text-xl font-bold disabled:opacity-30"
          aria-label="Next hole"
        >
          ›
        </button>
      </div>

      {/* Wolf selection */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">The Wolf</h3>
          <span className="rounded-full bg-alert px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-dark">
            🐺 {wolf?.name || "—"}
          </span>
        </div>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="text-text-muted">Override wolf</span>
          <select
            value={wolfId}
            onChange={(e) => {
              const newWolf = e.target.value;
              commit({
                wolfId: newWolf,
                partnerId: partnerId === newWolf ? undefined : partnerId,
              });
            }}
            className="rounded-lg border border-card-border px-3 py-2 font-semibold"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Unnamed"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Mode selection */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="mb-3 font-bold">Wolf&apos;s choice</h3>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(["2v2", "lone", "blind"] as const).map((m) => {
            if (m === "blind" && !settings.blindEnabled) return null;
            const active = mode === m;
            const label = m === "2v2" ? "Partner" : m === "lone" ? "Lone" : "Blind";
            const red = (m === "lone" || m === "blind") && active;
            return (
              <button
                key={m}
                onClick={() => commit({ mode: m, partnerId: m === "2v2" ? partnerId : undefined })}
                className={`rounded-lg py-3 text-sm font-bold transition ${
                  active
                    ? red
                      ? "bg-alert text-on-dark"
                      : "bg-primary text-on-dark"
                    : "bg-page-bg text-text-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {mode === "2v2" && (
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-text-muted">Partner</span>
            <select
              value={partnerId ?? ""}
              onChange={(e) =>
                commit({ partnerId: e.target.value || undefined, mode: "2v2" })
              }
              className="rounded-lg border border-card-border px-3 py-2 font-semibold"
            >
              <option value="">Pick partner…</option>
              {nonWolf.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || "Unnamed"}
                </option>
              ))}
            </select>
          </label>
        )}
        {teamARed && (
          <p className="text-sm font-semibold text-alert">
            {mode === "blind" ? "Blind" : "Lone"} wolf — 1 v {nonWolf.length}, ×
            {mode === "blind" ? settings.blindMult : settings.loneMult} stake
          </p>
        )}
      </div>

      {/* Score entry */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="mb-3 font-bold">Gross scores</h3>
        <div className="space-y-2">
          {players.map((p) => {
            const pops = computation.pops[p.id]?.[hole] ?? 0;
            const isWolf = p.id === wolfId;
            const isPartner = p.id === partnerId && mode === "2v2";
            const onTeamA = isWolf || isPartner;
            const score = grossScores[p.id];
            const net = typeof score === "number" ? score - pops : null;
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg bg-page-bg px-2 py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isWolf
                        ? "bg-alert text-on-dark"
                        : onTeamA
                          ? "bg-primary text-on-dark"
                          : "bg-avatar-bg text-on-dark"
                    }`}
                  >
                    {isWolf ? "🐺" : (p.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {p.name || "Unnamed"}
                      {Array.from({ length: pops }).map((_, i) => (
                        <span
                          key={i}
                          className="ml-1 inline-block h-[5px] w-[5px] rounded-full bg-primary align-middle"
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {net !== null ? `net ${net}` : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => bump(p.id, -1)}
                    className="h-10 w-10 rounded-lg bg-card-bg text-xl font-bold"
                    aria-label="Decrease score"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={score ?? ""}
                    placeholder={String(courseHole?.par ?? "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        const next = { ...grossScores };
                        delete next[p.id];
                        commit({ grossScores: next });
                      } else {
                        setScore(p.id, Math.max(1, parseInt(v) || 1));
                      }
                    }}
                    className="h-10 w-12 rounded-lg border border-card-border text-center text-lg font-bold tabular-nums"
                  />
                  <button
                    onClick={() => bump(p.id, 1)}
                    className="h-10 w-10 rounded-lg bg-card-bg text-xl font-bold"
                    aria-label="Increase score"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live hole result */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">This hole</h3>
          {!allScored && (
            <span className="text-xs text-text-faint">awaiting scores</span>
          )}
        </div>
        {result ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Wolf team best net</span>
              <span className="font-bold tabular-nums">
                {result.teamABest ?? "–"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Field best net</span>
              <span className="font-bold tabular-nums">
                {result.teamBBest ?? "–"}
              </span>
            </div>
            <div className="flex justify-between border-t border-divider pt-2">
              <span className="text-text-muted">Result</span>
              <span className="font-bold">
                {result.winner === "push"
                  ? result.carriedToNext > 0
                    ? `Push — $${result.carriedToNext} carries`
                    : "Push"
                  : `${result.winner === "A" ? "Wolf team" : "Field"} wins $${result.stakeApplied}`}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Enter scores to see the result.</p>
        )}
      </div>

      {/* Live ledger strip */}
      <div className="rounded-xl border border-card-border bg-card-bg p-3">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-text-muted">
          Standings
        </div>
        <div className="flex flex-wrap gap-2">
          {[...players]
            .sort((a, b) => (computation.ledger[b.id] ?? 0) - (computation.ledger[a.id] ?? 0))
            .map((p) => {
              const v = computation.ledger[p.id] ?? 0;
              const color =
                v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-text-muted";
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-full bg-page-bg px-3 py-1.5"
                >
                  <span className="text-xs font-semibold">{(p.name || "?").slice(0, 6)}</span>
                  <span className={`text-sm font-bold tabular-nums ${color}`}>
                    {formatMoney(v)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
