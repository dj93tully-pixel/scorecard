// components/fieldhammer/FieldHammerScores.tsx
// Hammerskin hole play, wired to the shared game (Supabase via upsertEntry).
// Round-robin skins: a single hole-level hammer (×2) / double hammer (×4) at the
// top of each hole, plus a per-player forfeit flag to the left of each score.
// The engine settles the pairings.

"use client";

import { Hammer, Flag, Zap } from "lucide-react";
import { Round, HoleEntry, computePops } from "@/lib/wolf";
import { computeBaseGame } from "@/lib/gametypes";
import { combinedHoleResults, pressCoverByHole } from "@/lib/engines/press";
import { formatMoney } from "@/lib/storage";
import { holeHighlight } from "@/lib/holeHighlight";
import { PlayerJunkIcons } from "../JunkChips";

const HAMMER_COLOR = "#7C3AED"; // purple
const FORFEIT_COLOR = "#06B6A4"; // teal
const PRESS_COLOR = "#E8590C"; // burnt orange

function HoleCard({
  round,
  pops,
  hole,
  deltas,
  segCover,
  fullCover,
  upsertEntry,
}: {
  round: Round;
  pops: Record<string, Record<number, number>>;
  hole: number;
  deltas: Record<string, number>;
  segCover?: number; // 9-presses covering this hole (for the ⚡9 ×N label)
  fullCover?: number; // 18-presses covering this hole (for the ⚡18 ×N label)
  upsertEntry: (h: number, patch: Partial<HoleEntry>, base: HoleEntry) => void;
}) {
  const { players, course } = round;
  const courseHole = course.holes.find((h) => h.number === hole);
  const existing = round.entries.find((e) => e.hole === hole);
  const grossScores = existing?.grossScores ?? {};
  const fhActions = existing?.fhActions ?? {};
  const hammer = existing?.hammer ?? 0;
  const pressSeg = existing?.pressSeg ?? false;
  const pressFull = existing?.pressFull ?? false;
  const segN = segCover ?? 0;
  const fullN = fullCover ?? 0;
  const segLabel = "9"; // rest of this nine — bare number on the card (Card tab keeps F9/B9)
  const base: HoleEntry = {
    hole,
    wolfId: "",
    mode: "2v2",
    grossScores,
    fhActions,
    hammer,
    pressSeg,
    pressFull,
    junk: existing?.junk,
  };
  const first = (id: string) =>
    (players.find((p) => p.id === id)?.name || "—").split(" ")[0];

  const setHammer = (level: number) =>
    upsertEntry(hole, { hammer: hammer === level ? 0 : level }, base);
  const toggleForfeit = (pid: string) => {
    const next = { ...fhActions };
    if (next[pid] === "forfeit") delete next[pid];
    else next[pid] = "forfeit";
    upsertEntry(hole, { fhActions: next }, base);
  };

  const winners = players.filter((p) => (deltas[p.id] ?? 0) !== 0);

  return (
    <div
      id={`hole-${hole}`}
      style={{
        scrollMarginTop: "calc(var(--header-h, 88px) + 6rem)",
        ...holeHighlight(segN + fullN, hammer),
      }}
      className="rounded-xl border border-card-border bg-card-bg p-3"
    >
      {/* Header: hole + hole-level hammer / double hammer. */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="leading-tight">
          <div className="text-lg font-extrabold">Hole {hole}</div>
          <div className="text-xs text-text-muted">
            Par {courseHole?.par ?? "–"} · Hcp {courseHole?.strokeIndex ?? "–"}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            onClick={() => upsertEntry(hole, { pressSeg: !pressSeg }, base)}
            aria-label="Press — new bet on the rest of this nine"
            style={pressSeg ? { background: PRESS_COLOR, borderColor: PRESS_COLOR } : undefined}
            className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[13px] font-bold ${
              pressSeg ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Zap className="h-[15px] w-[15px]" />{segLabel}{pressSeg && segN > 1 ? `×${segN}` : ""}
          </button>
          {hole <= 9 && (
            <button
              onClick={() => upsertEntry(hole, { pressFull: !pressFull }, base)}
              aria-label="Press — new bet on the rest of the round"
              style={pressFull ? { background: PRESS_COLOR, borderColor: PRESS_COLOR } : undefined}
              className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[13px] font-bold ${
                pressFull ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
              }`}
            >
              <Zap className="h-[15px] w-[15px]" />18{pressFull && fullN > 1 ? `×${fullN}` : ""}
            </button>
          )}
          <button
            onClick={() => setHammer(1)}
            aria-label="Hammer — double the hole"
            style={hammer === 1 ? { background: HAMMER_COLOR, borderColor: HAMMER_COLOR } : undefined}
            className={`flex items-center rounded-lg border px-2 py-1.5 ${
              hammer === 1 ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Hammer className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={() => setHammer(2)}
            aria-label="Double hammer — quadruple the hole"
            style={hammer === 2 ? { background: HAMMER_COLOR, borderColor: HAMMER_COLOR } : undefined}
            className={`flex items-center gap-0.5 rounded-lg border px-2 py-1.5 ${
              hammer === 2 ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Hammer className="h-[15px] w-[15px]" />
            <Hammer className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {players.map((p) => {
          const gross = grossScores[p.id];
          const pop = pops[p.id]?.[hole] ?? 0;
          const forfeited = fhActions[p.id] === "forfeit";
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
              </div>

              {/* Forfeit flag, to the left of the score. */}
              <button
                onClick={() => toggleForfeit(p.id)}
                aria-label={`${p.name || "Player"} forfeit`}
                style={
                  forfeited ? { background: FORFEIT_COLOR, borderColor: FORFEIT_COLOR } : undefined
                }
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  forfeited ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                }`}
              >
                <Flag className="h-[14px] w-[14px]" />
              </button>

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

              {/* Side bets (junk) tapped per player, to the right of the score. */}
              <PlayerJunkIcons
                round={round}
                hole={hole}
                playerId={p.id}
                entry={existing}
                onChange={(junk) => upsertEntry(hole, { junk }, base)}
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
  // Per-hole money = base round-robin + any press money on that hole.
  const combined = combinedHoleResults(round, (r) => {
    const g = computeBaseGame(r);
    return { ledger: g.ledger, holeResults: g.holeResults };
  });
  const deltasByHole = new Map(combined.map((r) => [r.hole, r.deltas]));
  const pressCovers = pressCoverByHole(round);

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
        <h2 className="text-xl font-bold">Hammerskin</h2>
        <span className="text-sm text-text-muted">{round.course.name}</span>
      </div>

      {round.course.holes.map((h) => (
        <HoleCard
          key={h.number}
          round={round}
          pops={pops}
          hole={h.number}
          deltas={deltasByHole.get(h.number) ?? {}}
          segCover={pressCovers.get(h.number)?.seg ?? 0}
          fullCover={pressCovers.get(h.number)?.full ?? 0}
          upsertEntry={upsertEntry}
        />
      ))}
    </div>
  );
}
