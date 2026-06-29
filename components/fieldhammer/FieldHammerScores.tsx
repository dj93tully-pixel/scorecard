// components/fieldhammer/FieldHammerScores.tsx
// Field Hammer hole play, wired to the shared game (Supabase via upsertEntry).
// Same hole-jumper + card styling as the other game types; the bespoke bit is the
// per-pairing hammer / accept / fold / hammer-back flow. All state lives on the
// hole entry (fhPairings); the engine settles it.

"use client";

import { Hammer, Check, Flag, X } from "lucide-react";
import { Round, HoleEntry, computePops } from "@/lib/wolf";
import { computeGame } from "@/lib/gametypes";
import { formatMoney } from "@/lib/storage";
import {
  allPairs,
  pairKey,
  applyHammerField,
  applyRespond,
  applyHammerBack,
  applyCancel,
  LivePairings,
} from "@/lib/fieldHammer";

const HAMMER_COLOR = "#7C3AED";

function HoleCard({
  round,
  pops,
  hole,
  deltas,
  upsertEntry,
}: {
  round: Round;
  pops: Record<string, Record<number, number>>;
  hole: number;
  deltas: Record<string, number>;
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const { players, course } = round;
  const ids = players.map((p) => p.id);
  const courseHole = course.holes.find((h) => h.number === hole);
  const existing = round.entries.find((e) => e.hole === hole);
  const grossScores = existing?.grossScores ?? {};
  const pairings: LivePairings = existing?.fhPairings ?? {};
  const base: HoleEntry = { hole, wolfId: "", mode: "2v2", grossScores, fhPairings: pairings };
  const baseStake = round.settings.stake || 1;
  const cap = round.settings.linesCap ?? 2;
  const first = (id: string) =>
    (players.find((p) => p.id === id)?.name || "—").split(" ")[0];

  const commit = (next: LivePairings) => upsertEntry(hole, { fhPairings: next }, base);

  // Pairings worth showing: anything not in the default (untouched) state.
  const active = allPairs(ids).filter((key) => {
    const st = pairings[key];
    return st && (st.pending || st.doublings > 0 || st.fold);
  });

  const winners = ids.filter((id) => (deltas[id] ?? 0) !== 0);

  return (
    <div
      id={`hole-${hole}`}
      style={{ scrollMarginTop: "calc(var(--header-h, 88px) + 6rem)" }}
      className="rounded-xl border border-card-border bg-card-bg p-3"
    >
      <div className="mb-2 leading-tight">
        <div className="text-lg font-extrabold">Hole {hole}</div>
        <div className="text-xs text-text-muted">
          Par {courseHole?.par ?? "–"} · Hcp {courseHole?.strokeIndex ?? "–"}
        </div>
      </div>

      {/* Scores */}
      <div className="space-y-1">
        {players.map((p) => {
          const gross = grossScores[p.id];
          const pop = pops[p.id]?.[hole] ?? 0;
          const net = typeof gross === "number" ? gross - pop : null;
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 py-1">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate font-medium text-text-primary">{p.name || "Unnamed"}</span>
                {pop > 0 && (
                  <span className="inline-flex shrink-0 gap-0.5">
                    {Array.from({ length: pop }).map((_, i) => (
                      <span key={i} className="h-[5px] w-[5px] rounded-full bg-primary" />
                    ))}
                  </span>
                )}
                {net !== null && (
                  <span className="shrink-0 text-xs text-text-faint tabular-nums">net {net}</span>
                )}
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={gross ?? ""}
                placeholder="–"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = { ...grossScores };
                  if (v === "") delete next[p.id];
                  else next[p.id] = Math.max(1, parseInt(v) || 1);
                  upsertEntry(hole, { grossScores: next }, base);
                }}
                className="h-9 w-12 shrink-0 rounded-lg border border-card-border bg-card-bg text-center text-lg font-bold tabular-nums outline-none focus:border-primary"
              />
            </div>
          );
        })}
      </div>

      {/* Hammer the field */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Hammer
        </span>
        {players.map((p) => {
          const eligible = ids.some((opp) => {
            if (opp === p.id) return false;
            const st = pairings[pairKey(p.id, opp)] ?? { doublings: 0 };
            return !st.fold && !st.pending && st.doublings < cap && st.lastHammerer !== p.id;
          });
          return (
            <button
              key={p.id}
              onClick={() => commit(applyHammerField(pairings, ids, p.id, cap))}
              disabled={!eligible}
              className="flex items-center gap-1 rounded-lg border border-card-border px-2 py-1.5 text-sm font-semibold text-text-primary disabled:opacity-30"
            >
              <Hammer className="h-3.5 w-3.5" style={{ color: HAMMER_COLOR }} />
              {first(p.id)}
            </button>
          );
        })}
      </div>

      {/* Active pairings */}
      {active.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {active.map((key) => {
            const [a, b] = key.split("|");
            const st = pairings[key]!;
            const stake = baseStake * 2 ** st.doublings;
            const label = `${first(a)} v ${first(b)}`;

            if (st.fold) {
              const won = st.fold.folder === a ? b : a;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm opacity-70"
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-text-muted">
                    {first(st.fold.folder)} folded · {first(won)} +${st.fold.settleStake}
                  </span>
                </div>
              );
            }

            if (st.pending) {
              const responder = st.pending === a ? b : a;
              return (
                <div key={key} className="rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED]/5 px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-xs font-semibold" style={{ color: HAMMER_COLOR }}>
                      {first(st.pending)} hammered → {first(responder)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => commit(applyRespond(pairings, key, "accept", baseStake))}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-positive py-1.5 text-sm font-semibold text-on-dark"
                    >
                      <Check className="h-4 w-4" /> Accept · ${stake * 2}
                    </button>
                    <button
                      onClick={() => commit(applyRespond(pairings, key, "fold", baseStake))}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-card-border py-1.5 text-sm font-semibold text-negative"
                    >
                      <Flag className="h-4 w-4" /> Fold · −${stake}
                    </button>
                    <button
                      onClick={() => commit(applyCancel(pairings, key))}
                      aria-label="Cancel hammer"
                      className="rounded-lg border border-card-border p-1.5 text-text-faint"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            }

            // Accepted / doubled — show stake + hammer-back for the non-last-hammerer.
            const backPlayer = st.lastHammerer ? (st.lastHammerer === a ? b : a) : null;
            const canBack = st.doublings >= 1 && st.doublings < cap && !!backPlayer;
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-lg border border-card-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-text-muted">
                    ${stake}
                    <span className="ml-1 font-bold" style={{ color: HAMMER_COLOR }}>
                      ×{2 ** st.doublings}
                    </span>
                  </span>
                  {canBack && (
                    <button
                      onClick={() => commit(applyHammerBack(pairings, key, backPlayer!, cap))}
                      className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold"
                      style={{ borderColor: HAMMER_COLOR, color: HAMMER_COLOR }}
                    >
                      <Hammer className="h-3.5 w-3.5" /> {first(backPlayer!)} back
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hole result */}
      {winners.length > 0 && (
        <div className="mt-2 text-right text-sm font-semibold">
          {winners.map((id, i) => (
            <span key={id} className={(deltas[id] ?? 0) > 0 ? "text-positive" : "text-negative"}>
              {i > 0 && <span className="text-text-faint"> · </span>}
              {first(id)} {formatMoney(deltas[id] ?? 0)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function FieldHammerScores({
  round,
  upsertEntry,
}: {
  round: Round;
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const ready = round.players.length >= 3 && round.course.holes.length > 0;

  const goToHole = (n: number) => {
    if (n === 1) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(`hole-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!ready) {
    return (
      <div className="rounded-xl border border-dashed border-card-border bg-card-bg p-6 text-center text-sm text-text-muted">
        Add at least 3 players and a course on the{" "}
        <span className="font-semibold">Setup</span> tab to start scoring.
      </div>
    );
  }

  const pops = computePops(round.players, round.course, round.settings.handicapMode);
  const deltasByHole = new Map(
    computeGame(round).holeResults.map((r) => [r.hole, r.deltas])
  );

  return (
    <div className="space-y-3">
      <div
        className="sticky z-10 flex gap-1 overflow-x-auto rounded-lg border border-primary/30 px-1.5 py-1.5"
        style={{ top: "calc(var(--header-h, 88px) + 3.4rem)", background: "#E7F0FF" }}
      >
        {round.course.holes.map((h) => (
          <button
            key={h.number}
            onClick={() => goToHole(h.number)}
            aria-label={`Go to hole ${h.number}`}
            className="h-7 w-7 shrink-0 rounded-md border border-primary/30 bg-card-bg text-xs font-semibold tabular-nums text-primary active:bg-primary active:text-on-dark"
          >
            {h.number}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Field Hammer</h2>
        <span className="text-sm text-text-muted">{round.course.name}</span>
      </div>

      {round.course.holes.map((h) => (
        <HoleCard
          key={h.number}
          round={round}
          pops={pops}
          hole={h.number}
          deltas={deltasByHole.get(h.number) ?? {}}
          upsertEntry={upsertEntry}
        />
      ))}
    </div>
  );
}
