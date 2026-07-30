// components/HackerTrackerMark.tsx
// The HACKERTRACKER header mark: a gold duplex-reticle scope tracking a white
// golf ball — tile-less, so the ball + reticle read on the dark header on their
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
      aria-label="HACKERTRACKER"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="16" fill="#FFFFFF" />
      <circle cx="43.5" cy="45.5" r="1.5" fill="#CFD3DA" />
      <circle cx="56.5" cy="45.5" r="1.5" fill="#CFD3DA" />
      <circle cx="50" cy="57" r="1.5" fill="#CFD3DA" />
      <g stroke="#F0A824" strokeLinecap="round">
        <circle cx="50" cy="50" r="25" fill="none" strokeWidth="2.8" />
        <line x1="50" y1="20" x2="50" y2="38" strokeWidth="3.6" />
        <line x1="50" y1="62" x2="50" y2="80" strokeWidth="3.6" />
        <line x1="20" y1="50" x2="38" y2="50" strokeWidth="3.6" />
        <line x1="62" y1="50" x2="80" y2="50" strokeWidth="3.6" />
        <line x1="42" y1="50" x2="58" y2="50" strokeWidth="1.5" />
        <line x1="50" y1="42" x2="50" y2="58" strokeWidth="1.5" />
      </g>
      <circle cx="50" cy="50" r="1.6" fill="#F0A824" />
    </svg>
  );
}
