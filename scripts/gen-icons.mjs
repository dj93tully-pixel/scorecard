// scripts/gen-icons.mjs
// Rasterizes the BettorGolf chip + ball mark into PWA / home-screen PNG icons.
// Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Home-screen icons are FULL-BLEED with no transparency — iOS can't show
// transparent app icons (it fills them with black) and applies its own rounded
// mask. The dark tile fills the whole square edge-to-edge; iOS rounds the
// corners. The chip + ball is flattened into the bitmap here (the home screen
// won't render live SVG). (The in-app header mark in components/BettorGolfMark
// is the same chip but tile-less.)
const TILE = "#0A0E1C";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="${TILE}"/>
  <circle cx="50" cy="50" r="30" fill="#12B886"/>
  <circle cx="50" cy="50" r="30" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="9 13"/>
  <circle cx="50" cy="50" r="20" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.5"/>
  <circle cx="50" cy="50" r="13" fill="#FFFFFF"/>
  <circle cx="46" cy="47" r="1.6" fill="#BFD8CC"/>
  <circle cx="54" cy="48" r="1.6" fill="#BFD8CC"/>
  <circle cx="50" cy="53" r="1.6" fill="#BFD8CC"/>
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
