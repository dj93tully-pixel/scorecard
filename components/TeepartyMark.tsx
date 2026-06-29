// components/TeepartyMark.tsx
// The TEEPARTY header mark: a white line-art teacup cradling a gold golf ball —
// tile-less, so the lines sit transparent on the dark header.
// (The square blue-tile app-icon version lives in public/teeparty-mark.svg.)

export function TeepartyMark({
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
      aria-label="TEEPARTY"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M34 49 L40 75 Q50 81 60 75 L66 49"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="50" cy="49" rx="16" ry="4" fill="none" stroke="#FFFFFF" strokeWidth="3.4" />
      <path
        d="M66 54 Q77 54 75 64 Q73 70 65 68"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="50" cy="44" r="9" fill="none" stroke="#F5B301" strokeWidth="3.4" />
    </svg>
  );
}
