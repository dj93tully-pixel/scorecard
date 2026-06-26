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
                    ) : popCount > 0 ? (
                      // Future hole where this player gets a pop: hollow dots.
                      <span className="inline-flex items-center justify-center gap-[2px]">
                        <span className="text-text-faint">·</span>
                        <span className="inline-flex gap-[1px]">
                          {Array.from({ length: popCount }).map((_, i) => (
                            <span
                              key={i}
                              className="inline-block h-[4px] w-[4px] rounded-full border border-primary"
                            />
                          ))}
                        </span>
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

      {/* Totals strip (shown above the grid) */}
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
        <p className="flex items-center gap-2">
          <span className="inline-block h-[4px] w-[4px] rounded-full bg-primary" />
          Solid dots = pops on holes already scored (two = double pop).
        </p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-[5px] w-[5px] rounded-full border border-primary" />
          Hollow dots = upcoming holes where the player gets a pop.
        </p>
      </div>
    </div>
  );
}
