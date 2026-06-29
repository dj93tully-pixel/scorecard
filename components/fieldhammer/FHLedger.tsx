// components/fieldhammer/FHLedger.tsx
// Field Hammer ledger: running per-player totals, the minimal-transaction
// "settle up" view, and a per-hole money breakdown. All money comes from the
// pure engine (fh.settlement); none is computed here.

"use client";

import { ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/storage";
import type { FieldHammer } from "@/lib/useFieldHammer";

const moneyClass = (m: number) =>
  m > 0 ? "text-positive" : m < 0 ? "text-negative" : "text-text-faint";

export function FHLedger({ fh }: { fh: FieldHammer }) {
  const { game, settlement } = fh;
  if (!game || !settlement) return null;
  const { round, txns } = settlement;
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name || "—";
  const first = (id: string) => nameOf(id).split(" ")[0];

  const ranked = [...game.players].sort(
    (a, b) => (round.ledger[b.id] ?? 0) - (round.ledger[a.id] ?? 0)
  );
  const playedHoles = round.holeResults.filter((hr) =>
    Object.values(hr.result.deltas).some((v) => v !== 0)
  );

  return (
    <div className="space-y-6">
      {/* Standings */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">Standings</h3>
        <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
          {ranked.map((p, i) => {
            const m = round.ledger[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2.5 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 text-center font-serif text-base font-bold text-text-faint">
                    {i + 1}
                  </span>
                  <span className="truncate font-semibold">{p.name || "Unnamed"}</span>
                </span>
                <span className={`font-serif text-lg font-extrabold tabular-nums ${moneyClass(m)}`}>
                  {formatMoney(m)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Settle up */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">Settle up</h3>
        <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
          {txns.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-text-muted">All square.</div>
          ) : (
            txns.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2.5 text-sm last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold text-negative">{first(t.from)}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-text-faint" />
                  <span className="truncate font-semibold text-positive">{first(t.to)}</span>
                </span>
                <span className="font-serif text-base font-bold tabular-nums">
                  ${Math.round(t.amount * 100) / 100}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* By hole */}
      {playedHoles.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">By hole</h3>
          <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr className="bg-surface-2 text-text-muted">
                  <th className="px-2 py-1.5 text-left font-semibold">Hole</th>
                  {game.players.map((p) => (
                    <th key={p.id} className="px-1.5 py-1.5 font-semibold">
                      {first(p.id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {playedHoles.map((hr) => (
                  <tr key={hr.number} className="border-t border-divider">
                    <td className="px-2 py-1 text-left font-semibold tabular-nums">{hr.number}</td>
                    {game.players.map((p) => {
                      const m = hr.result.deltas[p.id] ?? 0;
                      return (
                        <td key={p.id} className={`px-1.5 py-1 tabular-nums ${moneyClass(m)}`}>
                          {m === 0 ? "·" : formatMoney(m)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
