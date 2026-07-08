// components/HackerTrackerMark.tsx
// The HACKERTRACKER header mark: a bold cartoon-sticker green three-ring radar
// with a sweep, tracking a white golf ball (dark outline) — tile-less, so the
// rings + ball read on the dark header on their own (the square dark-tile
// app-icon version lives in public/hackertracker-mark.svg).

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
      <path d="M50 50 L50 22 A28 28 0 0 1 70 30 Z" fill="#20EBA0" opacity="0.30" />
      <circle cx="50" cy="50" r="27" fill="none" stroke="#20EBA0" strokeWidth="2.8" />
      <circle cx="50" cy="50" r="20" fill="none" stroke="#20EBA0" strokeWidth="2.8" />
      <circle cx="50" cy="50" r="14" fill="none" stroke="#20EBA0" strokeWidth="2.8" />
      <line x1="50" y1="50" x2="70" y2="30" stroke="#20EBA0" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="70" cy="30" r="3.8" fill="#20EBA0" />
      <circle cx="50" cy="50" r="11.5" fill="#FFFFFF" stroke="#07150E" strokeWidth="2.6" />
      <circle cx="45" cy="47" r="2" fill="#C2D8CD" />
      <circle cx="55" cy="48" r="2" fill="#C2D8CD" />
      <circle cx="50" cy="55" r="2" fill="#C2D8CD" />
    </svg>
  );
}
