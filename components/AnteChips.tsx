// components/AnteChips.tsx
// The per-hole ante shown beside each player's name on the Score tabs: line-style
// poker chips for what's at stake this hole — grey normal bet (dollar-rim), orange
// press (flag-rim), purple hammer (spade-rim) — each labelled with its dollar
// amount. Every player antes the same, so the same chips render on every row.
// Presentation only. Colors are kept per bet type; only the rim art differs.

import { PokerChip, PokerChipVariant } from "./PokerChip";

const NORMAL = "#6B7280"; // grey
const PRESS = "#E8590C"; // orange
const HAMMER = "#7C3AED"; // purple

export interface Ante {
  orig: number; // base bet stake
  press: number; // press stake (sum across presses covering the hole)
  hammer: number; // extra stake the hammer adds (0 when un-hammered)
}

// Compact amount: 5, 2.5 — no trailing zeros, no $ sign (the chip is tiny).
const amt = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));

function Chip({ color, variant, value }: { color: string; variant: PokerChipVariant; value: number }) {
  return (
    <span className="inline-flex shrink-0" style={{ color }}>
      <PokerChip variant={variant} size={22} label={amt(value)} />
    </span>
  );
}

export function AnteChips({ ante }: { ante: Ante }) {
  if (ante.orig <= 0 && ante.press <= 0 && ante.hammer <= 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {ante.orig > 0 && <Chip color={NORMAL} variant="dollar" value={ante.orig} />}
      {ante.press > 0 && <Chip color={PRESS} variant="flag" value={ante.press} />}
      {ante.hammer > 0 && <Chip color={HAMMER} variant="spade" value={ante.hammer} />}
    </span>
  );
}
