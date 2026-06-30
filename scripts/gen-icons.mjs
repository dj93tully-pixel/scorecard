// scripts/gen-icons.mjs
// Rasterizes the HackerTracker ball + reticle mark into PWA / home-screen PNG
// icons. Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Home-screen icons are FULL-BLEED with no transparency — iOS can't show
// transparent app icons (it fills them with black) and applies its own rounded
// mask. The dark tile fills the whole square edge-to-edge; iOS rounds the
// corners. The ball + reticle is flattened into the bitmap here (the home
// screen won't render live SVG). (The in-app header mark in
// components/HackerTrackerMark is the same mark but tile-less.)
const TILE = "#0A0E1C";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="${TILE}"/>
  <circle cx="50" cy="52" r="17" fill="#FFFFFF"/>
  <circle cx="44" cy="48" r="1.8" fill="#C9CFDA"/>
  <circle cx="56" cy="48" r="1.8" fill="#C9CFDA"/>
  <circle cx="50" cy="58" r="1.8" fill="#C9CFDA"/>
  <g stroke="#3B78FF" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 40 L32 34 L38 34"/>
    <path d="M62 34 L68 34 L68 40"/>
    <path d="M32 64 L32 70 L38 70"/>
    <path d="M62 70 L68 70 L68 64"/>
  </g>
  <g stroke="#3B78FF" stroke-width="2.5" stroke-linecap="round">
    <line x1="50" y1="30" x2="50" y2="35"/>
    <line x1="50" y1="69" x2="50" y2="74"/>
    <line x1="28" y1="52" x2="33" y2="52"/>
    <line x1="67" y1="52" x2="72" y2="52"/>
  </g>
</svg>`;

mkdirSync("public", { recursive: true });
const buf = Buffer.from(svg);
const out = [
  ["public/icon-512.png", 512],
  ["public/icon-192.png", 192],
  ["public/apple-touch-icon.png", 180],
];
for (const [file, size] of out) {
  // flatten onto the dark tile color so there is zero transparency (no iOS ring).
  await sharp(buf)
    .resize(size, size)
    .flatten({ background: TILE })
    .png()
    .toFile(file);
  console.log("wrote", file, `${size}x${size}`);
}
