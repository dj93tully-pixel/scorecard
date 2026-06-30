// components/BettorGolfMark.tsx
// The BettorGolf header mark: a green poker chip with a white golf-ball center —
// tile-less, so it reads on the dark header on its own (the square dark-tile
// app-icon version lives in public/bettorgolf-mark.svg).

export function BettorGolfMark({
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
      aria-label="BettorGolf"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="30" fill="#12B886" />
      <circle
        cx="50"
        cy="50"
        r="30"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeDasharray="9 13"
      />
      <circle cx="50" cy="50" r="20" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.5" />
      <circle cx="50" cy="50" r="13" fill="#FFFFFF" />
      <circle cx="46" cy="47" r="1.6" fill="#BFD8CC" />
      <circle cx="54" cy="48" r="1.6" fill="#BFD8CC" />
      <circle cx="50" cy="53" r="1.6" fill="#BFD8CC" />
    </svg>
  );
}
