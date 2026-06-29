// components/WolfLogo.tsx
// Inline SVG wolf head mark. Placeholder but clean — swap the path to rebrand.

export function WolfLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Wolf"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head + ears + muzzle, stylized geometric wolf */}
      <path
        d="M12 8 L20 22 L14 34 C12 44 20 56 32 56 C44 56 52 44 50 34 L44 22 L52 8 L40 16 L24 16 L12 8 Z"
        fill="currentColor"
      />
      {/* eyes */}
      <circle cx="25" cy="30" r="2.6" fill="#0A0E1C" />
      <circle cx="39" cy="30" r="2.6" fill="#0A0E1C" />
      {/* snout shadow */}
      <path d="M28 40 L32 46 L36 40 Z" fill="#0A0E1C" opacity="0.85" />
    </svg>
  );
}
