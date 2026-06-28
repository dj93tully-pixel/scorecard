// components/StandingsView.tsx
// Generic "Card" view for the non-Wolf game types. Driven entirely by an engine's
// GameResult: a money standings table (with the type's extra stat columns), a
// gross-score scorecard, and a hole-by-hole breakdown.

"use client";

import { Round } from "@/lib/wolf";
import { computeGame, gameTypeMeta, teamTag, StatColumn } from "@/lib/gametypes";
import { formatMoney } from "@/lib/storage";

function statText(value: number | string | undefined, kind: StatColumn["kind"]): string {
  if (value === undefined) return "–";
  if (typeof value === "string") return value;
  if (kind === "money") return formatMoney(value);
  if (kind === "plusminus") return value === 0 ? "E" : value > 0 ? `+${value}` : `${value}`;
  return `${value}`;
}

export function StandingsView({ round }: { round: Round }) {
  const meta = gameTypeMeta(round);
  const result = computeGame(round);
  const { players, course } = round;

  const ranked = [...players].sort(
    (a, b) => (result.ledger[b.id] ?? 0) - (result.ledger[a.id] ?? 0)
  );

  const grossTotal = (id: string) =>
    course.holes.reduce((sum, h) => {
      const e = round.entries.find((x) => x.hole === h.number);
      const g = e?.grossScores[id];
      return sum + (typeof g === "number" ? g : 0);
    }, 0);

  const decided = result.holeResults.filter((r) => r.decided || /carr/i.test(r.detail));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">{meta.label}</h2>
        <span className="text-sm text-text-muted">{course.name}</span>
      </div>

      {/* Standings */}
      <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
        {ranked.map((p, i) => {
          const money = result.ledger[p.id] ?? 0;
          const tag = teamTag(round, p.id, course.holes[0]?.number ?? 1);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-4 text-sm font-bold text-text-faint">{i + 1}</span>
                {tag && !meta.rotatesTeams && (
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold text-on-dark"
                    style={{ background: tag.color }}
                  >
                    {tag.label}
                  </span>
                )}
                <span className="truncate font-semibold">{p.name || "Unnamed"}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {meta.statColumns.map((c) => (
                  <span key={c.key} className="text-xs text-text-muted tabular-nums">
                    {c.label} {statText(result.stats[p.id]?.[c.key], c.kind)}
                  </span>
                ))}
                <span
                  className={`font-serif text-sm font-bold tabular-nums ${
                    money > 0 ? "text-positive" : money < 0 ? "text-negative" : "text-text-faint"
                  }`}
                >
                  {formatMoney(money)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scorecard (gross) */}
      <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr className="bg-surface-2 text-text-muted">
              <th className="sticky left-0 z-10 bg-surface-2 px-2 py-1.5 text-left font-semibold">
                Hole
              </th>
              {course.holes.map((h) => (
                <th key={h.number} className="px-1.5 py-1.5 font-semibold tabular-nums">
                  {h.number}
                </th>
              ))}
              <th className="px-2 py-1.5 font-semibold">Tot</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => (
              <tr key={p.id} className="border-t border-divider">
                <td className="sticky left-0 z-10 bg-card-bg px-2 py-1 text-left font-semibold">
                  {(p.name || "—").split(" ")[0]}
                </td>
                {course.holes.map((h) => {
                  const e = round.entries.find((x) => x.hole === h.number);
                  const g = e?.grossScores[p.id];
                  return (
                    <td key={h.number} className="px-1.5 py-1 tabular-nums">
                      {typeof g === "number" ? g : "·"}
                    </td>
                  );
                })}
                <td className="px-2 py-1 font-semibold tabular-nums">{grossTotal(p.id) || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hole-by-hole */}
      {decided.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
          <div className="border-b border-divider px-3 py-2 text-sm font-bold">By hole</div>
          {decided.map((r) => (
            <div
              key={r.hole}
              className="flex items-center justify-between gap-3 border-b border-divider px-3 py-1.5 text-sm last:border-b-0"
            >
              <span className="w-7 shrink-0 font-bold text-text-faint tabular-nums">
                {r.hole}
              </span>
              <span className="min-w-0 flex-1 truncate text-text-primary">{r.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
