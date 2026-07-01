// components/PokerChip.tsx
// Line-style poker-chip icons: an outer ring, a rim of 8 evenly spaced edge
// spots, and an inner ring, with a blank center. Three rim styles:
//   • flag   — dash edge spots + a double inner ring
//   • spade  — rectangular edge spots + single inner ring
//   • dollar — dot edge spots + single inner ring
// All strokes are currentColor, so the chip inherits color from CSS/props and
// works in light and dark mode. Pass `label` to render a value in the middle.
// Presentation only — the rim artwork is used verbatim as supplied.

export type PokerChipVariant = "flag" | "spade" | "dollar";

// The inner <g> artwork for each rim, lifted verbatim from the supplied SVGs.
const RIM: Record<PokerChipVariant, React.ReactNode> = {
  flag: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="50" r="46" strokeWidth="3" />
      <g transform="rotate(0 50 50)"><line x1="50" y1="6.5" x2="50" y2="17" strokeWidth="2.6" /></g>
      <g transform="rotate(45 50 50)"><line x1="50" y1="6.5" x2="50" y2="17" strokeWidth="2.6" /></g>
      <g transform="rotate(90 50 50)"><line x1="50" y1="6.5" x2="50" y2="17" strokeWidth="2.6" /></g>
      <g transform="rotate(135 50 50)"><line x1="50" y1="6.5" x2="50" y2="17" strokeWidth="2.6" /></g>
      <g transform="rotate(180 50 50)"><line x1="50" y1="6.5" x2="50" y2="17" strokeWidth="2.6" /></g>
      <g transform="rotate(225 50 50)"><line x1="50" y1="6.5" x2="50" y2="17" strokeWidth="2.6" /></g>
      <g transform="rotate(270 50 50)"><line x1="50" y1="6.5" x2="50" y2="17" strokeWidth="2.6" /></g>
      <g transform="rotate(315 50 50)"><line x1="50" y1="6.5" x2="50" y2="17" strokeWidth="2.6" /></g>
      <circle cx="50" cy="50" r="29" strokeWidth="3" />
      <circle cx="50" cy="50" r="25.5" strokeWidth="1.6" />
    </g>
  ),
  spade: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="50" r="46" strokeWidth="3" />
      <g transform="rotate(0 50 50)"><rect x="47" y="7.5" width="6" height="12" rx="3" strokeWidth="2.4" /></g>
      <g transform="rotate(45 50 50)"><rect x="47" y="7.5" width="6" height="12" rx="3" strokeWidth="2.4" /></g>
      <g transform="rotate(90 50 50)"><rect x="47" y="7.5" width="6" height="12" rx="3" strokeWidth="2.4" /></g>
      <g transform="rotate(135 50 50)"><rect x="47" y="7.5" width="6" height="12" rx="3" strokeWidth="2.4" /></g>
      <g transform="rotate(180 50 50)"><rect x="47" y="7.5" width="6" height="12" rx="3" strokeWidth="2.4" /></g>
      <g transform="rotate(225 50 50)"><rect x="47" y="7.5" width="6" height="12" rx="3" strokeWidth="2.4" /></g>
      <g transform="rotate(270 50 50)"><rect x="47" y="7.5" width="6" height="12" rx="3" strokeWidth="2.4" /></g>
      <g transform="rotate(315 50 50)"><rect x="47" y="7.5" width="6" height="12" rx="3" strokeWidth="2.4" /></g>
      <circle cx="50" cy="50" r="29" strokeWidth="3" />
    </g>
  ),
  dollar: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="50" r="46" strokeWidth="3" />
      <g transform="rotate(0 50 50)"><circle cx="50" cy="12.5" r="2.6" strokeWidth="2.2" /></g>
      <g transform="rotate(45 50 50)"><circle cx="50" cy="12.5" r="2.6" strokeWidth="2.2" /></g>
      <g transform="rotate(90 50 50)"><circle cx="50" cy="12.5" r="2.6" strokeWidth="2.2" /></g>
      <g transform="rotate(135 50 50)"><circle cx="50" cy="12.5" r="2.6" strokeWidth="2.2" /></g>
      <g transform="rotate(180 50 50)"><circle cx="50" cy="12.5" r="2.6" strokeWidth="2.2" /></g>
      <g transform="rotate(225 50 50)"><circle cx="50" cy="12.5" r="2.6" strokeWidth="2.2" /></g>
      <g transform="rotate(270 50 50)"><circle cx="50" cy="12.5" r="2.6" strokeWidth="2.2" /></g>
      <g transform="rotate(315 50 50)"><circle cx="50" cy="12.5" r="2.6" strokeWidth="2.2" /></g>
      <circle cx="50" cy="50" r="29" strokeWidth="3" />
    </g>
  ),
};

export function PokerChip({
  variant,
  size = 48,
  label,
  className,
}: {
  variant: PokerChipVariant;
  size?: number;
  label?: string | number;
  className?: string;
}) {
  const text = label === undefined ? "" : String(label);
  // Fit inside the r=29 inner ring: ~26 for one char, easing down as it grows.
  const fontSize = text.length <= 1 ? 26 : text.length === 2 ? 22 : Math.max(12, 44 / text.length);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${variant}-rim poker chip${text ? ` ${text}` : ""}`}
    >
      {RIM[variant]}
      {text && (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {text}
        </text>
      )}
    </svg>
  );
}
