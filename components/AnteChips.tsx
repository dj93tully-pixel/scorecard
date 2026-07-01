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
const MULT = "#E5484D"; // red — lone/blind multiplier (a wolf going solo)

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
      <PokerChip variant={variant} size={18} label={amt(value)} />
    </span>
  );
}

// `mult` is the Wolf lone/blind multiplier (2×, 3×…). When > 1 it shows a compact
// ×N to the right of the chips instead of inflating the chip values, so the base
// bet stays readable and the solo raise is called out explicitly.
export function AnteChips({ ante, mult = 1 }: { ante: Ante; mult?: number }) {
  if (ante.orig <= 0 && ante.press <= 0 && ante.hammer <= 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {ante.orig > 0 && <Chip color={NORMAL} variant="dollar" value={ante.orig} />}
      {ante.press > 0 && <Chip color={PRESS} variant="flag" value={ante.press} />}
      {ante.hammer > 0 && <Chip color={HAMMER} variant="spade" value={ante.hammer} />}
      {mult > 1 && (
        <span className="ml-0.5 text-[11px] font-extrabold tabular-nums" style={{ color: MULT }}>
          ×{mult}
        </span>
      )}
    </span>
  );
}
