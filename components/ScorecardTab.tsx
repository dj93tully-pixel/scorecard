// components/ScorecardTab.tsx
// Full scorecard grid. Shows gross score with pops dots (one per stroke given).

import { Round, RoundComputation } from "@/lib/wolf";
import { coursePar } from "@/lib/storage";

function PopsDots({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-0.5 inline-flex translate-y-[-3px] gap-[1px] align-top">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="inline-block h-[3px] w-[3px] rounded-full bg-primary"
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
                (s, h) =>
                  s + (round.course.holes.find((c) => c.number === h)?.par ?? 0),
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
              <td className="sticky left-0 z-10 bg-card-bg px-2 py-2 text-left font-semibold">
                {(p.name || "?").slice(0, 8)}
              </td>
              {holes.map((h) => {
                const g = entryByHole.get(h)?.grossScores[p.id];
                const popCount = pops[p.id]?.[h] ?? 0;
                return (
                  <td key={h} className="px-2 py-2 tabular-nums">
                    {typeof g === "number" ? (
                      <span className="relative">
                        {g}
                        <PopsDots count={popCount} />
                      </span>
                    ) : (
                      <span className="text-text-faint">–</span>
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-2 font-bold tabular-nums">{sumFor(p.id) || ""}</td>
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

      <NineTable round={round} computation={computation} holes={front} title="Front" />
      <NineTable round={round} computation={computation} holes={back} title="Back" />

      <div className="rounded-xl border border-card-border bg-card-bg">
        <div className="border-b border-divider px-4 py-2 text-sm font-bold uppercase tracking-wide text-text-muted">
          Totals
        </div>
        {round.players.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between border-b border-divider px-4 py-2 last:border-0"
          >
            <span className="font-semibold">{p.name || "Unnamed"}</span>
            <span className="font-bold tabular-nums">{total(p.id) || "–"}</span>
          </div>
        ))}
      </div>

      <p className="flex items-center gap-2 px-1 text-xs text-text-muted">
        <span className="inline-block h-[4px] w-[4px] rounded-full bg-primary" />
        Dots mark handicap strokes (pops) — two dots means a double pop.
      </p>
    </div>
  );
}
