// components/fieldhammer/FHPlay.tsx
// Field Hammer hole play: gross scores per player, "hammer the field" per player,
// and per-pairing accept / fold / hammer-back controls. All hammer state lives in
// the hook; the engine settles it.

"use client";

import { useState } from "react";
import { Hammer, Check, Flag, X } from "lucide-react";
import { emptyHole, fhPopsForHole } from "@/lib/fieldHammerStore";
import { allPairs, pairKey } from "@/lib/fieldHammer";
import type { FieldHammer } from "@/lib/useFieldHammer";

export function FHPlay({ fh }: { fh: FieldHammer }) {
  const { game } = fh;
  const [holeN, setHoleN] = useState(1);
  if (!game) return null;

  const ids = game.players.map((p) => p.id);
  const cap = game.settings.linesCap;
  const base = game.settings.baseStake;
  const hole = game.holes[holeN] ?? emptyHole(holeN);
  const pops = fhPopsForHole(game, holeN);
  const courseHole = game.course.holes.find((h) => h.number === holeN);
  const first = (id: string) =>
    (game.players.find((p) => p.id === id)?.name || "—").split(" ")[0];

  const goToHole = (n: number) => {
    setHoleN(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-3">
      {/* Hole selector */}
      <div
        className="sticky z-10 flex gap-1 overflow-x-auto rounded-lg border border-primary/30 px-1.5 py-1.5"
        style={{ top: "calc(var(--header-h, 88px) + 3.4rem)", background: "#E7F0FF" }}
      >
        {game.course.holes.map((h) => (
          <button
            key={h.number}
            onClick={() => goToHole(h.number)}
            className={`h-7 w-7 shrink-0 rounded-md border text-xs font-semibold tabular-nums ${
              h.number === holeN
                ? "border-primary bg-primary text-on-dark"
                : "border-primary/30 bg-card-bg text-primary"
            }`}
          >
            {h.number}
          </button>
        ))}
      </div>

      <div className="leading-tight">
        <div className="text-lg font-extrabold">Hole {holeN}</div>
        <div className="text-xs text-text-muted">
          Par {courseHole?.par ?? "–"} · Hcp {courseHole?.strokeIndex ?? "–"}
        </div>
      </div>

      {/* Scores */}
      <div className="space-y-1 rounded-xl border border-card-border bg-card-bg p-3">
        {game.players.map((p) => {
          const gross = hole.grossScores[p.id];
          const pop = pops[p.id] ?? 0;
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
                  fh.setScore(holeN, p.id, v === "" ? null : Math.max(1, parseInt(v) || 1));
                }}
                className="h-9 w-12 shrink-0 rounded-lg border border-card-border bg-card-bg text-center text-lg font-bold tabular-nums outline-none focus:border-primary"
              />
            </div>
          );
        })}
      </div>

      {/* Hammer the field */}
      <div className="rounded-xl border border-card-border bg-card-bg p-3">
        <div className="mb-2 text-sm font-bold">Hammer the field</div>
        <div className="flex flex-wrap gap-2">
          {game.players.map((p) => {
            const eligible = ids.some((opp) => {
              if (opp === p.id) return false;
              const st = hole.pairings[pairKey(p.id, opp)] ?? { doublings: 0 };
              return !st.fold && !st.pending && st.doublings < cap && st.lastHammerer !== p.id;
            });
            return (
              <button
                key={p.id}
                onClick={() => fh.hammerField(holeN, p.id)}
                disabled={!eligible}
                className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-sm font-semibold text-text-primary disabled:opacity-30"
              >
                <Hammer className="h-4 w-4 text-[#7C3AED]" />
                {first(p.id)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pairings */}
      <div className="rounded-xl border border-card-border bg-card-bg p-3">
        <div className="mb-2 text-sm font-bold">Pairings</div>
        <div className="space-y-2">
          {allPairs(ids).map((key) => {
            const [a, b] = key.split("|");
            const st = hole.pairings[key] ?? { doublings: 0 };
            const stake = base * 2 ** st.doublings;
            const label = `${first(a)} v ${first(b)}`;

            // Folded — settled.
            if (st.fold) {
              const winner = st.fold.folder === a ? b : a;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm opacity-70"
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-text-muted">
                    {first(st.fold.folder)} folded · {first(winner)} +${st.fold.settleStake}
                  </span>
                </div>
              );
            }

            // Pending — opponent must accept or fold.
            if (st.pending) {
              const responder = st.pending === a ? b : a;
              return (
                <div key={key} className="rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED]/5 px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-xs font-semibold text-[#7C3AED]">
                      {first(st.pending)} hammered → {first(responder)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fh.respond(holeN, key, "accept")}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-positive py-1.5 text-sm font-semibold text-on-dark"
                    >
                      <Check className="h-4 w-4" /> Accept · ${stake * 2}
                    </button>
                    <button
                      onClick={() => fh.respond(holeN, key, "fold")}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-card-border py-1.5 text-sm font-semibold text-negative"
                    >
                      <Flag className="h-4 w-4" /> Fold · −${stake}
                    </button>
                    <button
                      onClick={() => fh.cancelHammer(holeN, key)}
                      aria-label="Cancel hammer"
                      className="rounded-lg border border-card-border p-1.5 text-text-faint"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            }

            // Active — show stake + hammer-back for the non-last-hammerer.
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
                    {st.doublings > 0 && (
                      <span className="ml-1 font-bold text-[#7C3AED]">×{2 ** st.doublings}</span>
                    )}
                  </span>
                  {canBack && (
                    <button
                      onClick={() => fh.hammerBack(holeN, key, backPlayer!)}
                      className="flex items-center gap-1 rounded-lg border border-[#7C3AED] px-2 py-1 text-xs font-semibold text-[#7C3AED]"
                    >
                      <Hammer className="h-3.5 w-3.5" /> {first(backPlayer!)} back
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
