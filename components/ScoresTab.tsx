// components/ScoresTab.tsx
// First tab: a vertical stack of hole-by-hole boxes. Each box shows the hole,
// its handicap (stroke index), who gets pops, lets you pick the wolf + their
// choice (partner / lone / blind), and enter gross scores.

"use client";

import {
  Round,
  RoundComputation,
  HoleEntry,
  defaultWolfForHole,
} from "@/lib/wolf";

function Chip({
  active,
  color = "primary",
  onClick,
  children,
}: {
  active: boolean;
  color?: "primary" | "alert";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls =
    color === "alert" ? "bg-alert text-on-dark" : "bg-primary text-on-dark";
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
        active ? activeCls : "bg-page-bg text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function HoleBox({
  round,
  computation,
  hole,
  upsertEntry,
}: {
  round: Round;
  computation: RoundComputation;
  hole: number;
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

  const base: HoleEntry = { hole, wolfId: wolfId!, mode, partnerId, grossScores };
  const commit = (patch: Partial<HoleEntry>) => upsertEntry(hole, patch, base);

  const nonWolf = players.filter((p) => p.id !== wolfId);
  const result = computation.results.find((r) => r.hole === hole);

  // Who gets pops on this hole.
  const popList = players
    .map((p) => ({ p, n: computation.pops[p.id]?.[hole] ?? 0 }))
    .filter((x) => x.n > 0);

  const short = (n: string) => (n || "?").slice(0, 6);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-3">
      {/* Header */}
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-lg font-extrabold">Hole {hole}</span>
        <span className="text-xs text-text-muted">
          Par {courseHole?.par ?? "–"} · Hcp {courseHole?.strokeIndex ?? "–"}
        </span>
      </div>

      {/* Pops */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span className="font-semibold uppercase tracking-wide">Pops</span>
        {popList.length === 0 ? (
          <span className="text-text-faint">none</span>
        ) : (
          popList.map(({ p, n }) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              {short(p.name)}
              <span className="inline-flex gap-0.5">
                {Array.from({ length: n }).map((_, i) => (
                  <span key={i} className="h-[5px] w-[5px] rounded-full bg-primary" />
                ))}
              </span>
            </span>
          ))
        )}
      </div>

      {/* Wolf */}
      <div className="mb-2">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Wolf
        </div>
        <div className="flex flex-wrap gap-1.5">
          {players.map((p) => (
            <Chip
              key={p.id}
              active={p.id === wolfId}
              color="alert"
              onClick={() =>
                commit({
                  wolfId: p.id,
                  partnerId: partnerId === p.id ? undefined : partnerId,
                })
              }
            >
              {short(p.name)}
            </Chip>
          ))}
        </div>
      </div>

      {/* Choice: partner / lone / blind */}
      <div className="mb-2">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Choice
        </div>
        <div className="flex flex-wrap gap-1.5">
          {nonWolf.map((p) => (
            <Chip
              key={p.id}
              active={mode === "2v2" && partnerId === p.id}
              onClick={() => commit({ mode: "2v2", partnerId: p.id })}
            >
              {short(p.name)}
            </Chip>
          ))}
          <Chip
            active={mode === "lone"}
            color="alert"
            onClick={() => commit({ mode: "lone", partnerId: undefined })}
          >
            Lone
          </Chip>
          {settings.blindEnabled && (
            <Chip
              active={mode === "blind"}
              color="alert"
              onClick={() => commit({ mode: "blind", partnerId: undefined })}
            >
              Blind
            </Chip>
          )}
        </div>
      </div>

      {/* Scores */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Scores
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {players.map((p) => {
            const isWolf = p.id === wolfId;
            const isPartner = p.id === partnerId && mode === "2v2";
            const score = grossScores[p.id];
            const myPops = computation.pops[p.id]?.[hole] ?? 0;
            const onColored = isWolf || isPartner;
            return (
              <label key={p.id} className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-6 w-full items-center justify-center gap-1 rounded-md px-1 text-[11px] font-bold ${
                    isWolf
                      ? "bg-alert text-on-dark"
                      : isPartner
                        ? "bg-primary text-on-dark"
                        : "bg-page-bg text-text-primary"
                  }`}
                >
                  <span className="truncate">{short(p.name)}</span>
                  {myPops > 0 && (
                    <span className="inline-flex shrink-0 gap-0.5">
                      {Array.from({ length: myPops }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-[4px] w-[4px] rounded-full ${
                            onColored ? "bg-on-dark" : "bg-primary"
                          }`}
                        />
                      ))}
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={score ?? ""}
                  placeholder={String(courseHole?.par ?? "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = { ...grossScores };
                    if (v === "") delete next[p.id];
                    else next[p.id] = Math.max(1, parseInt(v) || 1);
                    commit({ grossScores: next });
                  }}
                  className="h-12 w-full rounded-lg border border-card-border text-center text-xl font-bold tabular-nums"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-2 text-right text-sm">
          {result.winner === "push" ? (
            <span className="text-text-faint">
              {result.carriedToNext > 0
                ? `Push — $${result.carriedToNext} carries`
                : "Push"}
            </span>
          ) : (
            <span className="font-bold">
              {result.winner === "A" ? "Wolf team" : "Field"} wins{" "}
              <span className="text-positive">${result.pot}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ScoresTab({
  round,
  computation,
  upsertEntry,
}: {
  round: Round;
  computation: RoundComputation;
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const ready = round.players.length >= 3 && round.course.holes.length > 0;

  if (!ready) {
    return (
      <div className="rounded-xl border border-dashed border-card-border bg-card-bg p-6 text-center text-sm text-text-muted">
        Add players and a course on the <span className="font-semibold">Setup</span>{" "}
        tab to start scoring.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Scores</h2>
        <span className="text-sm text-text-muted">{round.course.name}</span>
      </div>
      {round.course.holes.map((h) => (
        <HoleBox
          key={h.number}
          round={round}
          computation={computation}
          hole={h.number}
          upsertEntry={upsertEntry}
        />
      ))}
    </div>
  );
}
