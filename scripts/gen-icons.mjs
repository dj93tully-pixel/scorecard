// scripts/gen-icons.mjs
// Rasterizes the HACKERTRACKER radar + ball mark into PWA / home-screen PNG
// icons. Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Home-screen icons are FULL-BLEED with no transparency — iOS can't show
// transparent app icons (it fills them with black) and applies its own rounded
// mask. The dark tile fills the whole square edge-to-edge; iOS rounds the
// corners. The white golf ball + gold duplex-reticle scope is flattened into the
// bitmap here (the home screen won't render live SVG). (The in-app header mark in
// components/HackerTrackerMark is the same mark but tile-less.)
const TILE = "#17110A";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect x="4" y="4" width="92" height="92" rx="22" fill="${TILE}"/>
  <circle cx="50" cy="50" r="16" fill="#FFFFFF"/>
  <circle cx="43.5" cy="45.5" r="1.5" fill="#CFD3DA"/>
  <circle cx="56.5" cy="45.5" r="1.5" fill="#CFD3DA"/>
  <circle cx="50" cy="57" r="1.5" fill="#CFD3DA"/>
  <g stroke="#F0A824" stroke-linecap="round">
    <circle cx="50" cy="50" r="25" fill="none" stroke-width="2.8"/>
    <line x1="50" y1="20" x2="50" y2="38" stroke-width="3.6"/>
    <line x1="50" y1="62" x2="50" y2="80" stroke-width="3.6"/>
    <line x1="20" y1="50" x2="38" y2="50" stroke-width="3.6"/>
    <line x1="62" y1="50" x2="80" y2="50" stroke-width="3.6"/>
    <line x1="42" y1="50" x2="58" y2="50" stroke-width="1.5"/>
    <line x1="50" y1="42" x2="50" y2="58" stroke-width="1.5"/>
  </g>
  <circle cx="50" cy="50" r="1.6" fill="#F0A824"/>
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
