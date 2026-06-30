// components/SideBetsView.tsx
// The Side bets tab — junk settles entirely on its own, separate from the main
// game. Shows each player's junk total, a per-bet breakdown, and a junk-only
// "who pays whom". Reads the same ResultsData; never touches the main settle-up.

"use client";

import { ResultsData } from "@/lib/results";
import { SettleUp } from "./SettleUp";

const GREEN = "#16A06A";
const RED = "#E5484D";
const MUTED = "#9098A4";
const BORDER = "#EAECEF";
const INK = "#16181D";

function money1(v: number): string {
  const r = Math.round(v * 10) / 10;
  const sign = r > 0 ? "+" : r < 0 ? "-" : "";
  const abs = Math.abs(r);
  return `${sign}$${Number.isInteger(abs) ? abs : abs.toFixed(1)}`;
}
const moneyColor = (v: number) => (v > 0 ? GREEN : v < 0 ? RED : MUTED);

export function SideBetsView({ results }: { results: ResultsData }) {
  const nameById = new Map(results.players.map((p) => [p.id, p.name]));
  const standings = [...results.players].sort((a, b) => b.junk - a.junk);

  if (results.junkBets.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-dashed border-card-border bg-card-bg p-8 text-center text-sm text-text-muted">
        No side bets yet. Turn them on in <span className="font-semibold">Setup → Side bets</span>,
        then tap them per hole on the Score tab.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Per-player junk totals */}
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Side bets</h2>
        <div className="space-y-2">
          {standings.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
              style={{ borderColor: BORDER }}
            >
              <span className="truncate font-semibold" style={{ color: INK }}>
                {p.name}
              </span>
              <span
                className="shrink-0 font-serif text-base font-extrabold tabular-nums"
                style={{ color: moneyColor(p.junk) }}
              >
                {money1(p.junk)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Per-bet breakdown */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">By bet</h2>
        <div className="space-y-2">
          {results.junkBets.map((bet) => {
            const lines = results.players
              .map((p) => ({ name: nameById.get(p.id) ?? "", v: bet.total[p.id] ?? 0 }))
              .filter((x) => Math.round(x.v * 100) !== 0)
              .sort((a, b) => b.v - a.v);
            return (
              <div
                key={bet.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
                style={{ borderColor: BORDER }}
              >
                <span className="shrink-0 font-semibold" style={{ color: INK }}>
                  {bet.label}
                </span>
                {lines.length === 0 ? (
                  <span className="text-sm" style={{ color: MUTED }}>
                    not yet won
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm tabular-nums">
                    {lines.map((x) => (
                      <span
                        key={x.name}
                        className="font-semibold"
                        style={{ color: moneyColor(x.v) }}
                      >
                        {x.name} {money1(x.v)}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Junk-only settle-up */}
      <SettleUp people={results.players.map((p) => ({ name: p.name, amount: p.junk }))} />
    </div>
  );
}
