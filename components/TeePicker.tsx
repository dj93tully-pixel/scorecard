// components/TeePicker.tsx
// Per-player tee choice, shown as a square in the tee's colour with M/W inside.
// Tapping it opens a small list of the course's tees to pick from.

"use client";

import { useState } from "react";
import { CourseTee } from "@/lib/wolf";

const NEUTRAL = "#9098A4";

/** "M" / "W" for a tee: its stored gender, else a "(M)"/"(W)" name suffix. */
export function teeGenderLetter(tee: CourseTee): string {
  if (tee.gender) return tee.gender;
  const m = tee.name.match(/\((M|W)\)\s*$/i);
  return m ? m[1].toUpperCase() : "";
}

/** Readable letter colour on top of the tee colour (white tees get dark text). */
function inkFor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#1A1A1A" : "#FFFFFF";
}

export function TeeSwatch({ tee, size = 36 }: { tee?: CourseTee; size?: number }) {
  const bg = tee?.color ?? NEUTRAL;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-card-border text-sm font-bold"
      style={{ background: bg, color: inkFor(bg), width: size, height: size }}
    >
      {tee ? teeGenderLetter(tee) : "–"}
    </span>
  );
}

export function TeePicker({
  tees,
  value,
  onChange,
}: {
  tees: CourseTee[];
  value?: CourseTee;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Tee: ${value?.name ?? "course default"}`}
        aria-expanded={open}
        className="flex"
      >
        <TeeSwatch tee={value} size={40} />
      </button>
      {open && (
        <>
          {/* Tap-away backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 z-20 mt-1 w-48 divide-y divide-divider overflow-hidden rounded-lg border border-card-border bg-card-bg shadow-lg">
            {tees.map((t) => (
              <li key={t.name}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(t.name);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-2 py-2 text-left ${
                    t.name === value?.name ? "bg-pill-bg" : ""
                  }`}
                >
                  <TeeSwatch tee={t} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t.name}</span>
                    <span className="block text-xs tabular-nums text-text-muted">
                      {t.rating} / {t.slope}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
