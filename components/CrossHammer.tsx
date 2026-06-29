// components/CrossHammer.tsx
// Double-hammer glyph: two hammers crossed into an X. Inherits color (currentColor)
// and size from the passed className, so it drops in where a single Hammer sat.

import { Hammer } from "lucide-react";

export function CrossHammer({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <Hammer className="absolute inset-0 h-full w-full rotate-45" />
      <Hammer className="absolute inset-0 h-full w-full -rotate-45 -scale-x-100" />
    </span>
  );
}
