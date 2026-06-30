// components/JunkChips.tsx
// Per-hole side-bet ("junk") tap row, shared by every score tab. Shows one row
// per enabled MANUAL bet eligible on this hole (greenies only on par 3s) with a
// chip per player; tapping toggles that player's flag. Greenies are single-winner
// (radio); sandies/barkies/snakes allow several. Auto bets (birdies) aren't shown
// here — they score off the card. Presentation + capture only; money lives in
// lib/junk.ts and the Cards tab.

"use client";

import { Round, HoleEntry, PlayerId } from "@/lib/wolf";
import { manualJunkForHole, toggleJunkFlag } from "@/lib/junk";

const JUNK_COLOR = "#0FA968"; // money-green, distinct from press/hammer/forfeit

export function JunkChips({
  round,
  hole,
  entry,
  onChange,
}: {
  round: Round;
  hole: number;
  entry?: HoleEntry;
  onChange: (junk: Record<PlayerId, string[]>) => void;
}) {
  const par = round.course.holes.find((h) => h.number === hole)?.par ?? null;
  const bets = manualJunkForHole(round.settings, par);
  if (bets.length === 0) return null;

  const ids = round.players.map((p) => p.id);
  const junkMap = entry?.junk ?? {};
  const first = (id: string) =>
    (round.players.find((p) => p.id === id)?.name || "—").split(" ")[0];

  return (
    <div className="mt-3 space-y-1.5 border-t border-card-border pt-3">
      {bets.map((bet) => {
        const single = bet.settle === "carry"; // one greenie winner per hole
        return (
          <div key={bet.id} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-text-muted">
              {bet.label}
            </span>
            <div className="flex flex-1 flex-wrap justify-end gap-1.5">
              {round.players.map((p) => {
                const active = (junkMap[p.id] ?? []).includes(bet.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => onChange(toggleJunkFlag(junkMap, ids, bet.id, p.id, single))}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      active ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
                    }`}
                    style={active ? { background: JUNK_COLOR, borderColor: JUNK_COLOR } : undefined}
                  >
                    {first(p.id)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
