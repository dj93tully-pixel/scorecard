// components/LedgerTab.tsx
// Prominent live standings: who's up, who's down, by how much. Rank rails on the
// left mark standing; a to-par badge shows each player's round vs par.

import { Round, RoundComputation } from "@/lib/wolf";
import { formatMoney } from "@/lib/storage";
import { ScoreBadge } from "./ScoreBadge";

const RANK_RAIL = [
  "border-l-rank-1",
  "border-l-rank-2",
  "border-l-rank-3",
  "border-l-rank-4",
];

export function LedgerTab({
  round,
  computation,
}: {
  round: Round;
  computation: RoundComputation;
}) {
  const { ledger, results } = computation;
  const standings = [...round.players].sort(
    (a, b) => (ledger[b.id] ?? 0) - (ledger[a.id] ?? 0)
  );
  const sum = round.players.reduce((s, p) => s + (ledger[p.id] ?? 0), 0);

  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const toPar = (pid: string): number | null => {
    let rel = 0;
    let any = false;
    for (const e of round.entries) {
      const g = e.grossScores[pid];
      if (typeof g === "number") {
        rel += g - (parByHole.get(e.hole) ?? g);
        any = true;
      }
    }
    return any ? rel : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Ledger</h2>
        <span className="text-sm text-text-muted">
          {results.length} {results.length === 1 ? "hole" : "holes"} entered
        </span>
      </div>

      <div className="space-y-2">
        {standings.map((p, i) => {
          const v = ledger[p.id] ?? 0;
          const color =
            v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-text-muted";
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-xl border border-l-4 border-card-border bg-card-bg px-4 py-3 ${RANK_RAIL[Math.min(i, 3)]}`}
            >
              <span className="w-5 text-center font-serif text-base font-bold text-text-faint">
                {i + 1}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-avatar-bg text-sm font-bold text-on-dark">
                {(p.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name || "Unnamed"}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                  <span>HCP {p.handicap}</span>
                  <ScoreBadge rel={toPar(p.id)} size="sm" />
                </div>
              </div>
              <div className={`font-serif text-xl font-extrabold tabular-nums ${color}`}>
                {formatMoney(v)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-divider bg-card-bg px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Invariant check (table sum)</span>
          <span
            className={`font-bold tabular-nums ${
              sum === 0 ? "text-positive" : "text-negative"
            }`}
          >
            {sum === 0 ? "$0 ✓" : formatMoney(sum)}
          </span>
        </div>
      </div>

      {results.length > 0 && (
        <div>
          <h3 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-text-muted">
            Hole-by-hole
          </h3>
          <div className="space-y-1">
            {results.map((r) => {
              const wolf = round.players.find((p) => p.id === r.wolfId);
              const label =
                r.winner === "push"
                  ? r.carriedToNext > 0
                    ? `Push — carries $${r.carriedToNext}`
                    : "Push"
                  : `${r.winner === "A" ? "Wolf team" : "Field"} won $${r.pot}`;
              return (
                <div
                  key={r.hole}
                  className="flex items-center justify-between rounded-lg bg-card-bg px-3 py-2 text-sm"
                >
                  <span className="font-semibold">Hole {r.hole}</span>
                  <span className="text-text-muted">
                    {wolf?.name || "Wolf"} ·{" "}
                    {r.mode === "2v2" ? "2v2" : r.mode === "lone" ? "Lone" : "Blind"}
                  </span>
                  <span
                    className={
                      r.winner === "push" ? "text-text-faint" : "font-semibold"
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
