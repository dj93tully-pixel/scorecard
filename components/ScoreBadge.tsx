// components/ScoreBadge.tsx
// To-par pill (ported from golf-pool): under par = green, even = muted,
// over par = red. Serif numerals for a classic scoreboard feel.

import { formatToPar } from "@/lib/storage";

const SIZE = {
  sm: "text-xs px-2 py-0.5 min-w-[34px]",
  md: "text-sm px-2.5 py-1 min-w-[42px]",
  lg: "text-base px-3 py-1.5 min-w-[50px]",
} as const;

export function ScoreBadge({
  rel,
  size = "md",
  className = "",
}: {
  /** Score relative to par. null = not started. */
  rel: number | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const color =
    rel === null || rel === 0
      ? "bg-surface-2 text-score-even"
      : rel < 0
        ? "bg-score-under/15 text-score-under"
        : "bg-score-over/15 text-score-over";

  return (
    <span
      className={`inline-flex items-center justify-center rounded font-serif font-bold tabular-nums ${SIZE[size]} ${color} ${className}`}
    >
      {rel === null ? "–" : formatToPar(rel)}
    </span>
  );
}
