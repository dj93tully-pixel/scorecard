// components/ScorecardTab.tsx
// Full scorecard grid. Entered gross scores render with golf circle/square
// notation (rings = strokes from par); blue dots mark handicap pops (solid for
// scored holes, hollow for upcoming holes). Presentation only — no money math.

import { CSSProperties } from "react";
import { Round, RoundComputation } from "@/lib/wolf";
import { coursePar } from "@/lib/storage";

// rel = gross - par. Under par → circles, over par → squares, par → plain.
// Monochrome rings via layered box-shadow; gaps in page-bg (#F4F5F7).
function shapeStyle(rel: number): CSSProperties {
  if (rel === 0) return {};
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

function Dots({ count, hollow }: { count: number; hollow?: boolean }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex gap-[1px]">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`h-[4px] w-[4px] rounded-full ${
            hollow ? "border border-primary" : "bg-primary"
          }`}
        />
      ))}
    </span>
  );
}

function NineTable({
  round,
  computation,
  holes,
  title,
}: {
  round: Round;
  computation: RoundComputation;
  holes: number[];
  title: string;
}) {
  const { pops } = computation;
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));

  const sumFor = (playerId: string) =>
    holes.reduce((s, h) => {
      const g = entryByHole.get(h)?.grossScores[playerId];
      return s + (typeof g === "number" ? g : 0);
    }, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
      <table className="w-full border-collapse text-center text-sm">
        <thead>
          <tr className="bg-row-tint text-xs text-text-muted">
            <th className="sticky left-0 z-10 bg-row-tint px-2 py-2 text-left font-semibold">
              {title}
            </th>
            {holes.map((h) => (
              <th key={h} className="px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
            <th className="px-2 py-2 font-bold">{title === "Front" ? "OUT" : "IN"}</th>
          </tr>
          <tr className="text-[11px] text-text-faint">
            <td className="sticky left-0 z-10 bg-card-bg px-2 py-1 text-left">Par</td>
            {holes.map((h) => {
              const par = round.course.holes.find((c) => c.number === h)?.par ?? "";
              return (
                <td key={h} className="px-2 py-1">
                  {par}
                </td>
              );
            })}
            <td className="px-2 py-1 font-semibold">
              {holes.reduce(
                (s, h) => s + (round.course.holes.find((c) => c.number === h)?.par ?? 0),
                0
              )}
            </td>
          </tr>
          <tr className="text-[10px] text-text-faint">
            <td className="sticky left-0 z-10 bg-card-bg px-2 py-1 text-left">SI</td>
            {holes.map((h) => {
              const si = round.course.holes.find((c) => c.number === h)?.strokeIndex ?? "";
              return (
                <td key={h} className="px-2 py-1">
                  {si}
                </td>
              );
            })}
            <td className="px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {round.players.map((p) => (
            <tr key={p.id} className="border-t border-divider">
              <td className="sticky left-0 z-10 bg-card-bg px-2 py-3 text-left font-semibold">
                {(p.name || "?").slice(0, 8)}
              </td>
              {holes.map((h) => {
                const g = entryByHole.get(h)?.grossScores[p.id];
                const popCount = pops[p.id]?.[h] ?? 0;
                const par = round.course.holes.find((c) => c.number === h)?.par ?? 0;
                if (typeof g === "number") {
                  return (
                    <td key={h} className="px-2.5 py-3 tabular-nums">
                      <span className="flex flex-col items-center gap-1">
                        <span
                          style={shapeStyle(g - par)}
                          className="flex h-6 w-6 items-center justify-center font-semibold"
                        >
                          {g}
                        </span>
                        {popCount > 0 && <Dots count={popCount} />}
                      </span>
                    </td>
                  );
                }
                return (
                  <td key={h} className="px-2.5 py-3">
                    {popCount > 0 ? (
                      <span className="flex flex-col items-center gap-1 text-text-faint">
                        ·<Dots count={popCount} hollow />
                      </span>
                    ) : (
                      <span className="text-text-faint">–</span>
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-3 font-bold tabular-nums">{sumFor(p.id) || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScorecardTab({
  round,
  computation,
}: {
  round: Round;
  computation: RoundComputation;
}) {
  const front = Array.from({ length: 9 }, (_, i) => i + 1);
  const back = Array.from({ length: 9 }, (_, i) => i + 10);
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
  const total = (playerId: string) =>
    round.course.holes.reduce((s, h) => {
      const g = entryByHole.get(h.number)?.grossScores[playerId];
      return s + (typeof g === "number" ? g : 0);
    }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Scorecard</h2>
        <span className="text-sm text-text-muted">
          {round.course.name} · Par {coursePar(round.course)}
        </span>
      </div>

      {/* Totals strip (above the grid) */}
      <div className="flex flex-wrap gap-2">
        {round.players.map((p) => {
          const t = total(p.id);
          return (
            <div
              key={p.id}
              className="flex items-center gap-1.5 rounded-full border border-card-border bg-card-bg px-3 py-1.5"
            >
              <span className="text-xs font-semibold">{(p.name || "?").slice(0, 8)}</span>
              <span className="text-sm font-extrabold tabular-nums">{t || "–"}</span>
            </div>
          );
        })}
      </div>

      <NineTable round={round} computation={computation} holes={front} title="Front" />
      <NineTable round={round} computation={computation} holes={back} title="Back" />

      <div className="space-y-1 px-1 text-xs text-text-muted">
        <p>○ circle = under par (birdie/eagle…) · ▢ square = over par (bogey/double…)</p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-[4px] w-[4px] rounded-full bg-primary" />
          solid dot = pop on a scored hole ·
          <span className="inline-block h-[5px] w-[5px] rounded-full border border-primary" />
          hollow = upcoming pop
        </p>
      </div>
    </div>
  );
}
