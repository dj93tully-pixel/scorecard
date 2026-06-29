// components/TigerLogo.tsx
// Inline SVG tiger head mark — orange with dark stripes. The app brand logo.

export function TigerLogo({ className = "" }: { className?: string }) {
  const ORANGE = "#F97316";
  const DARK = "#1B1B1B";
  const EAR = "#7C2D12";
  const MUZZLE = "#FFE6C7";
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Tiger"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ears */}
      <path d="M13 9 L25 19 L15 27 Z" fill={ORANGE} />
      <path d="M51 9 L39 19 L49 27 Z" fill={ORANGE} />
      <path d="M16 13 L23 19 L17 23 Z" fill={EAR} />
      <path d="M48 13 L41 19 L47 23 Z" fill={EAR} />
      {/* head */}
      <path
        d="M32 13 C18 13 11 24 11 35 C11 48 20 57 32 57 C44 57 53 48 53 35 C53 24 46 13 32 13 Z"
        fill={ORANGE}
      />
      {/* muzzle */}
      <ellipse cx="32" cy="45" rx="12" ry="9.5" fill={MUZZLE} />
      {/* stripes */}
      <g stroke={DARK} strokeWidth="3" strokeLinecap="round">
        <path d="M32 15 L32 27" />
        <path d="M22 17 L19 28" />
        <path d="M42 17 L45 28" />
        <path d="M12 33 L22 35" />
        <path d="M52 33 L42 35" />
      </g>
      {/* eyes */}
      <circle cx="25" cy="33" r="3" fill={DARK} />
      <circle cx="39" cy="33" r="3" fill={DARK} />
      {/* nose + muzzle line */}
      <path d="M28.5 42 L35.5 42 L32 46.5 Z" fill={DARK} />
      <path d="M32 46.5 L32 51" stroke={DARK} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
