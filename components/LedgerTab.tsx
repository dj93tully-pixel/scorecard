// components/LedgerTab.tsx
// Prominent live standings: who's up, who's down, by how much.

import { Round, RoundComputation } from "@/lib/wolf";
import { formatMoney } from "@/lib/storage";

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
  const holesPlayed = results.filter((r) => r.winner !== "push" || r.carriedToNext > 0).length;

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
              className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3"
            >
              <span className="w-6 text-center text-sm font-bold text-text-faint">
                {i + 1}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-avatar-bg text-sm font-bold text-on-dark">
                {(p.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{p.name || "Unnamed"}</div>
                <div className="text-xs text-text-muted">HCP {p.handicap}</div>
              </div>
              <div className={`text-xl font-extrabold tabular-nums ${color}`}>
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
