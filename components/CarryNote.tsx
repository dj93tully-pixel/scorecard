// components/CarryNote.tsx
// The bet breakdowns shown at the bottom of a Score-tab hole card: a row of
// semi-transparent pills — grey normal (handshake), orange press (lightning),
// purple hammer (hammer, doubled when a double hammer applies). CarryNote shows
// what a PUSHED hole rolls forward; WonNote shows what a DECIDED hole pays out.
// Both share the same icons/colors. Presentation only.

import { Handshake, Zap, Hammer } from "lucide-react";
import { HoleCarry } from "@/lib/carry";

const NORMAL = "#6B7280"; // grey
const PRESS = "#E8590C"; // orange
const HAMMER = "#7C3AED"; // purple

const money = (n: number) => `$${Math.round(n * 100) / 100}`;

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums"
      style={{ background: `${color}26`, color }}
    >
      {children}
    </span>
  );
}

// The three bet pills (normal / press / hammer) — shared by both notes. Only the
// non-zero components render.
function Badges({ split, hammer }: { split: HoleCarry; hammer: number }) {
  return (
    <>
      {split.orig > 0 && (
        <Pill color={NORMAL}>
          <Handshake className="h-4 w-4" strokeWidth={2.25} />
          {money(split.orig)}
        </Pill>
      )}
      {split.press > 0 && (
        <Pill color={PRESS}>
          <Zap className="h-4 w-4" strokeWidth={2.25} />
          {money(split.press)}
        </Pill>
      )}
      {split.hammer > 0 && (
        <Pill color={HAMMER}>
          <Hammer className="h-4 w-4" strokeWidth={2.25} />
          {hammer >= 2 && <Hammer className="-ml-2 h-4 w-4" strokeWidth={2.25} />}
          {money(split.hammer)}
        </Pill>
      )}
    </>
  );
}

/**
 * @param carry  the split carry for this hole
 * @param hammer this hole's hammer level (2 ⇒ a double hammer is carrying)
 */
export function CarryNote({ carry, hammer }: { carry: HoleCarry; hammer: number }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
      <Badges split={carry} hammer={hammer} />
      <span className="text-sm font-semibold tabular-nums text-text-primary">
        Push: {money(carry.total)} carries
      </span>
    </div>
  );
}

/**
 * The won-amount breakdown for a DECIDED hole — same pills as CarryNote, for
 * what the winning side collects.
 * @param won    the split won amount for this hole
 * @param hammer this hole's hammer level (2 ⇒ a double hammer)
 * @param label  optional winner label (e.g. "Wolf" / "Field") shown first
 */
export function WonNote({ won, hammer, label }: { won: HoleCarry; hammer: number; label?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
      {label && <span className="text-sm font-bold tabular-nums text-text-primary">{label} wins</span>}
      <Badges split={won} hammer={hammer} />
    </div>
  );
}
