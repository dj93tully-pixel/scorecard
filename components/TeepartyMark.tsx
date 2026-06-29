// components/TeepartyMark.tsx
// The TEEPARTY brand mark: a rounded blue tile with a teacup cradling a golf ball.
// Inline SVG (mirrors public/teeparty-mark.svg) so it stays crisp at any size.

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
      <rect x="4" y="4" width="92" height="92" rx="22" fill="#354CA1" />
      <ellipse cx="50" cy="74" rx="23" ry="4.5" fill="#E1E7F5" />
      <path d="M35 50 L39 69 Q50 75 61 69 L65 50 Z" fill="#FFFFFF" />
      <ellipse cx="50" cy="50" rx="15" ry="4" fill="#E1E7F5" />
      <path d="M65 54 Q75 54 73 63 Q71 69 64 67" fill="none" stroke="#FFFFFF" strokeWidth="4" />
      <circle cx="50" cy="46" r="10" fill="#FFFFFF" />
      <circle cx="47" cy="44" r="1.5" fill="#C3D0EC" />
      <circle cx="53" cy="45" r="1.5" fill="#C3D0EC" />
      <circle cx="50" cy="49" r="1.5" fill="#C3D0EC" />
    </svg>
  );
}
