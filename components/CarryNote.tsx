// components/CarryNote.tsx
// The push line at the bottom of a Score-tab hole card: text only — how much is
// carrying forward. The per-bet breakdown now lives in the ante chips beside each
// player name (see AnteChips). Presentation only.

import { HoleCarry } from "@/lib/carry";

const money = (n: number) => `$${Math.round(n * 100) / 100}`;

export function CarryNote({ carry }: { carry: HoleCarry }) {
  return (
    <span className="text-sm font-semibold tabular-nums text-text-faint">
      Push — {money(carry.total)} carries
    </span>
  );
}
