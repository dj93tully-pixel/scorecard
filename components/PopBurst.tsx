// components/PopBurst.tsx
// Small blue "pop" starburst marking a handicap stroke.
//  - variant "outline": blue outline, transparent inside (additive — sits around
//    existing content like a hole number).
//  - variant "filled": solid blue burst (e.g. as a standalone pop marker).

import { CSSProperties, ReactNode } from "react";

const PRIMARY = "#2D78FF";

// Precompute a 10-point starburst polygon (outer/inner radii on a 100 viewBox).
const PTS = (() => {
  const pts: string[] = [];
  const spikes = 10;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 46 : 29;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
})();

export function PopBurst({
  size = 15,
  variant = "outline",
  children,
}: {
  size?: number;
  variant?: "outline" | "filled";
  children?: ReactNode;
}) {
  const wrap: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    width: size,
    height: size,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <span style={wrap}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden
      >
        <polygon
          points={PTS}
          fill={variant === "filled" ? PRIMARY : "none"}
          stroke={variant === "filled" ? "none" : PRIMARY}
          strokeWidth={variant === "filled" ? 0 : 6}
          strokeLinejoin="round"
        />
      </svg>
      {children != null && (
        <span style={{ position: "relative", lineHeight: 1 }}>{children}</span>
      )}
    </span>
  );
}
