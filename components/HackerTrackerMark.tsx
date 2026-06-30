// components/HackerTrackerMark.tsx
// The HACKERTRACKER header mark: a green three-ring radar with a sweep, tracking
// a white golf ball — tile-less, so the rings + ball read on the dark header on
// their own (the square dark-tile app-icon version lives in
// public/hackertracker-mark.svg).

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
      <path d="M50 50 L50 23 A27 27 0 0 1 69 31 Z" fill="#19E59A" opacity="0.30" />
      <path d="M50 50 L31 31 A27 27 0 0 1 50 23 Z" fill="#19E59A" opacity="0.13" />
      <path d="M50 50 L23 50 A27 27 0 0 1 31 31 Z" fill="#19E59A" opacity="0.05" />
      <circle cx="50" cy="50" r="27" fill="none" stroke="#19E59A" strokeWidth="1.6" opacity="0.30" />
      <circle cx="50" cy="50" r="20" fill="none" stroke="#19E59A" strokeWidth="1.6" opacity="0.45" />
      <circle cx="50" cy="50" r="13.5" fill="none" stroke="#19E59A" strokeWidth="1.6" opacity="0.60" />
      <line x1="50" y1="50" x2="69" y2="31" stroke="#19E59A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="69" cy="31" r="2.6" fill="#19E59A" />
      <circle cx="50" cy="50" r="11" fill="#FFFFFF" />
      <circle cx="46" cy="47" r="1.4" fill="#C9CFDA" />
      <circle cx="54" cy="48" r="1.4" fill="#C9CFDA" />
    </svg>
  );
}
