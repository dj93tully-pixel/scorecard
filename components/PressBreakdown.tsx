// components/PressBreakdown.tsx
// Shared money displays for any game with presses: the original / press / total
// split. Used in the standings dropdown, below the scorecard, and atop the
// score-entry tabs so the original bet and every press are always visible — and
// who's up or down on each.

import { Round } from "@/lib/wolf";
import { formatMoney } from "@/lib/storage";
import { pressSplit } from "@/lib/engines/press";

export { hasAnyPress } from "@/lib/engines/press";

type Stats = Record<string, Record<string, number | string>> | undefined;

const moneyColor = (v: number) =>
  v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-text-muted";

// Three chips — Original / Press / Total — for one player.
export function PressTriple({ stats, pid }: { stats: Stats; pid: string }) {
  const m = pressSplit(stats, pid);
  const cells: { label: string; value: number; strong?: boolean }[] = [
    { label: "Original", value: m.original },
    { label: "Press", value: m.press },
    { label: "Total", value: m.total, strong: true },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map(({ label, value, strong }) => (
        <div
          key={label}
          className="rounded-lg border border-card-border bg-card-bg px-2 py-1.5 text-center"
        >
          <div className="text-[9px] font-bold uppercase tracking-wide text-text-faint">
            {label}
          </div>
          <div
            className={`font-serif text-sm tabular-nums ${
              strong ? "font-extrabold" : "font-bold"
            } ${moneyColor(value)}`}
          >
            {formatMoney(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Per-player table — Player · Original · Press · Total — showing who's up and
// who's down on each. Players sorted by total (most up first).
export function PressTable({ round, stats }: { round: Round; stats: Stats }) {
  const rows = [...round.players].sort(
    (a, b) => pressSplit(stats, b.id).total - pressSplit(stats, a.id).total
  );
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-text-muted">
        <span className="min-w-0 flex-1">Player</span>
        <span className="w-16 text-right">Original</span>
        <span className="w-16 text-right">Press</span>
        <span className="w-16 text-right">Total</span>
      </div>
      {rows.map((p) => {
        const m = pressSplit(stats, p.id);
        return (
          <div
            key={p.id}
            className="flex items-center gap-2 border-t border-divider px-3 py-2 text-sm tabular-nums"
          >
            <span className="min-w-0 flex-1 truncate font-semibold">
              {p.name || "Unnamed"}
            </span>
            <span className={`w-16 text-right font-bold ${moneyColor(m.original)}`}>
              {formatMoney(m.original)}
            </span>
            <span className={`w-16 text-right font-bold ${moneyColor(m.press)}`}>
              {formatMoney(m.press)}
            </span>
            <span className={`w-16 text-right font-extrabold ${moneyColor(m.total)}`}>
              {formatMoney(m.total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
