// components/LunchballMark.tsx
// The Lunchball brand mark: a rounded blue tile with a bitten golf ball.
// Inline SVG (mirrors public/lunchball-mark.svg) so it stays crisp at any size.

export function LunchballMark({
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
      aria-label="Lunchball"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="92" height="92" rx="22" fill="#354CA1" />
      <circle cx="48" cy="53" r="31" fill="#FFFFFF" />
      <circle cx="74" cy="31" r="15" fill="#354CA1" />
      <circle cx="40" cy="47" r="2.7" fill="#D5DAE2" />
      <circle cx="53" cy="49" r="2.7" fill="#D5DAE2" />
      <circle cx="46" cy="59" r="2.7" fill="#D5DAE2" />
      <circle cx="58" cy="61" r="2.7" fill="#D5DAE2" />
      <circle cx="38" cy="63" r="2.7" fill="#D5DAE2" />
      <circle cx="60" cy="48" r="2.7" fill="#D5DAE2" />
    </svg>
  );
}
