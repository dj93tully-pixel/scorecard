// components/HackerTrackerMark.tsx
// The HackerTracker header mark: a white golf ball inside a blue tracking
// reticle — tile-less, so the ball + crosshair read on the dark header on their
// own (the square dark-tile app-icon version lives in public/hackertracker-mark.svg).

export function HackerTrackerMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="HackerTracker"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="52" r="17" fill="#FFFFFF" />
      <circle cx="44" cy="48" r="1.8" fill="#C9CFDA" />
      <circle cx="56" cy="48" r="1.8" fill="#C9CFDA" />
      <circle cx="50" cy="58" r="1.8" fill="#C9CFDA" />
      <g stroke="#3B78FF" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 40 L32 34 L38 34" />
        <path d="M62 34 L68 34 L68 40" />
        <path d="M32 64 L32 70 L38 70" />
        <path d="M62 70 L68 70 L68 64" />
      </g>
      <g stroke="#3B78FF" strokeWidth="2.5" strokeLinecap="round">
        <line x1="50" y1="30" x2="50" y2="35" />
        <line x1="50" y1="69" x2="50" y2="74" />
        <line x1="28" y1="52" x2="33" y2="52" />
        <line x1="67" y1="52" x2="72" y2="52" />
      </g>
    </svg>
  );
}
