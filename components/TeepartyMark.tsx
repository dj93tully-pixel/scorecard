// components/TeepartyMark.tsx
// The TEEPARTY header mark: a teacup cradling a golf ball, with steam — tile-less,
// so it sits transparent directly on the dark header. Inline SVG, crisp at any size.
// (The square app-icon version lives in public/teeparty-mark.svg.)

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
      <path d="M44 41 Q49 34 44 27" fill="none" stroke="#5A6DD0" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M56 41 Q61 34 56 27" fill="none" stroke="#5A6DD0" strokeWidth="2.8" strokeLinecap="round" />
      <ellipse cx="50" cy="78" rx="22" ry="4.2" fill="#E1E7F5" />
      <path d="M35 54 L39 72 Q50 78 61 72 L65 54 Z" fill="#FFFFFF" />
      <ellipse cx="50" cy="54" rx="15" ry="3.8" fill="#C3D0EC" />
      <path d="M65 58 Q75 58 73 67 Q71 72 64 70.5" fill="none" stroke="#FFFFFF" strokeWidth="3.8" />
      <circle cx="50" cy="50" r="9" fill="#FFFFFF" />
      <circle cx="47" cy="48" r="1.4" fill="#9DB0E0" />
      <circle cx="53" cy="49" r="1.4" fill="#9DB0E0" />
      <circle cx="50" cy="53" r="1.4" fill="#9DB0E0" />
    </svg>
  );
}
