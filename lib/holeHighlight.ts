// lib/holeHighlight.ts
// Border highlight for a hole card in the score tabs: orange when a press is on,
// purple when a hammer is on, and an alternating purple/orange dashed border when
// both are on. Returns inline-style props to merge onto the card's style.

import type { CSSProperties } from "react";

const PURPLE = "#7C3AED"; // hammer
const ORANGE = "#E8590C"; // press

export function holeHighlight(hasPress: boolean, hasHammer: boolean): CSSProperties {
  if (hasPress && hasHammer) {
    return {
      borderWidth: "3px",
      borderStyle: "solid",
      borderColor: "transparent",
      borderImage: `repeating-linear-gradient(45deg, ${PURPLE} 0 6px, transparent 6px 9px, ${ORANGE} 9px 15px, transparent 15px 18px) 3`,
    };
  }
  if (hasPress) return { borderColor: ORANGE, borderWidth: "2px" };
  if (hasHammer) return { borderColor: PURPLE, borderWidth: "2px" };
  return {};
}
