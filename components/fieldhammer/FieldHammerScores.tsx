// components/fieldhammer/FieldHammerScores.tsx
// Field Hammer hole play, wired to the shared game (Supabase via upsertEntry).
// Round-robin skins: each player sets a per-hole stance with buttons to the right
// of their score — Hammer (×2 your loss), Double (×4), or Forfeit (concede). No
// thrower/responder step. The engine settles the pairings.

"use client";

import { Hammer, Flag } from "lucide-react";
import { Round, HoleEntry, computePops } from "@/lib/wolf";
import { computeGame } from "@/lib/gametypes";
import { formatMoney } from "@/lib/storage";
import { FHAction } from "@/lib/fieldHammer";

const HAMMER_COLOR = "#7C3AED"; // purple
const FORFEIT_COLOR = "#06B6A4"; // teal

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
  const courseHole = course.holes.find((h) => h.number === hole);
  const existing = round.entries.find((e) => e.hole === hole);
  const grossScores = existing?.grossScores ?? {};
  const fhActions = existing?.fhActions ?? {};
  const base: HoleEntry = { hole, wolfId: "", mode: "2v2", grossScores, fhActions };
  const first = (id: string) =>
    (players.find((p) => p.id === id)?.name || "—").split(" ")[0];

  const setAction = (pid: string, action: FHAction) => {
    const next = { ...fhActions };
    if (next[pid] === action) delete next[pid];
    else next[pid] = action;
    upsertEntry(hole, { fhActions: next }, base);
  };

  const winners = players.filter((p) => (deltas[p.id] ?? 0) !== 0);

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

      <div className="space-y-1.5">
        {players.map((p) => {
          const gross = grossScores[p.id];
          const pop = pops[p.id]?.[hole] ?? 0;
          const net = typeof gross === "number" ? gross - pop : null;
          const action = fhActions[p.id];
          return (
            <div key={p.id} className="flex items-center gap-2">
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

              {/* Per-player stance buttons, to the LEFT of the score. */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setAction(p.id, "hammer")}
                  aria-label={`${p.name || "Player"} hammer (loss ×2)`}
                  style={
                    action === "hammer"
                      ? { background: HAMMER_COLOR, borderColor: HAMMER_COLOR }
                      : undefined
                  }
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    action === "hammer" ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                  }`}
                >
                  <Hammer className="h-[13px] w-[13px]" />
                </button>
                <button
                  onClick={() => setAction(p.id, "double")}
                  aria-label={`${p.name || "Player"} double hammer (loss ×4)`}
                  style={
                    action === "double"
                      ? { background: HAMMER_COLOR, borderColor: HAMMER_COLOR }
                      : undefined
                  }
                  className={`flex h-8 items-center justify-center gap-0.5 rounded-lg border px-1 ${
                    action === "double" ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                  }`}
                >
                  <Hammer className="h-[13px] w-[13px]" />
                  <Hammer className="h-[13px] w-[13px]" />
                </button>
                <button
                  onClick={() => setAction(p.id, "forfeit")}
                  aria-label={`${p.name || "Player"} forfeit`}
                  style={
                    action === "forfeit"
                      ? { background: FORFEIT_COLOR, borderColor: FORFEIT_COLOR }
                      : undefined
                  }
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    action === "forfeit" ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                  }`}
                >
                  <Flag className="h-[13px] w-[13px]" />
                </button>
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

      {/* Hole result — each player's net money on the hole. */}
      {winners.length > 0 && (
        <div className="mt-2 text-right text-sm font-semibold">
          {winners.map((p, i) => (
            <span key={p.id} className={(deltas[p.id] ?? 0) > 0 ? "text-positive" : "text-negative"}>
              {i > 0 && <span className="text-text-faint"> · </span>}
              {first(p.id)} {formatMoney(deltas[p.id] ?? 0)}
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
        <h2 className="text-xl font-bold">Sledgehammer</h2>
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
