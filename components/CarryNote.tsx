// components/CarryNote.tsx
// The carry breakdown shown at the bottom of a Score-tab hole card when a hole
// pushes: a single row of semi-transparent pills — grey normal (handshake),
// orange press (lightning), purple hammer (hammer, doubled when a double hammer
// carries) — followed by the running total. Presentation only.

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

/**
 * @param carry  the split carry for this hole
 * @param hammer this hole's hammer level (2 ⇒ a double hammer is carrying)
 */
export function CarryNote({ carry, hammer }: { carry: HoleCarry; hammer: number }) {
  const extra = carry.press > 0 || carry.hammer > 0;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
      {carry.orig > 0 && (
        <Pill color={NORMAL}>
          <Handshake className="h-4 w-4" strokeWidth={2.25} />
          {money(carry.orig)}
        </Pill>
      )}
      {carry.press > 0 && (
        <Pill color={PRESS}>
          <Zap className="h-4 w-4" strokeWidth={2.25} />
          {money(carry.press)}
        </Pill>
      )}
      {carry.hammer > 0 && (
        <Pill color={HAMMER}>
          <Hammer className="h-4 w-4" strokeWidth={2.25} />
          {hammer >= 2 && <Hammer className="-ml-2 h-4 w-4" strokeWidth={2.25} />}
          {money(carry.hammer)}
        </Pill>
      )}
      {extra && (
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          Total — {money(carry.total)} carries
        </span>
      )}
    </div>
  );
}
