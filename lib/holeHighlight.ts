// lib/holeHighlight.ts
// Border highlight for a hole card in the score tabs. Each bet touching the hole
// adds a coloured dash to the border — one ORANGE dash per press covering it
// (a 9-hole + an 18-hole press → two orange dashes), one PURPLE dash per hammer
// level (a double hammer → two purple dashes). A single bet draws a plain solid
// border; two or more cycle as an alternating dashed border all around the card.
// Returns inline-style props to merge onto the card's style.

import type { CSSProperties } from "react";

const PURPLE = "#7C3AED"; // hammer
const ORANGE = "#E8590C"; // press

export function holeHighlight(presses: number, hammerLevel: number): CSSProperties {
  const colors: string[] = [];
  for (let i = 0; i < presses; i++) colors.push(ORANGE);
  for (let i = 0; i < hammerLevel; i++) colors.push(PURPLE);

  if (colors.length === 0) return {};
  if (colors.length === 1) {
    return { borderColor: colors[0], borderWidth: "2px", borderStyle: "solid" };
  }

  // Two or more bets: a dashed border that cycles through every bet's colour
  // (orange per press, purple per hammer) with a gap between dashes.
  const dash = 6;
  const gap = 3;
  const unit = dash + gap;
  const stops = colors
    .map((c, i) => {
      const start = i * unit;
      return `${c} ${start}px ${start + dash}px, transparent ${start + dash}px ${start + unit}px`;
    })
    .join(", ");

  return {
    borderWidth: "3px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderImage: `repeating-linear-gradient(45deg, ${stops}) 3`,
  };
}
