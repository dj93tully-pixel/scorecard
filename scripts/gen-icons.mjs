// scripts/gen-icons.mjs
// Rasterizes the HACKERTRACKER radar + ball mark into PWA / home-screen PNG
// icons. Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Home-screen icons are FULL-BLEED with no transparency — iOS can't show
// transparent app icons (it fills them with black) and applies its own rounded
// mask. The dark tile fills the whole square edge-to-edge; iOS rounds the
// corners. The radar + sweep + ball (including its opacities) is flattened into
// the bitmap here (the home screen won't render live SVG/opacity). (The in-app
// header mark in components/HackerTrackerMark is the same mark but tile-less.)
const TILE = "#08130D";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="${TILE}"/>
  <path d="M50 50 L50 23 A27 27 0 0 1 69 31 Z" fill="#19E59A" opacity="0.30"/>
  <path d="M50 50 L31 31 A27 27 0 0 1 50 23 Z" fill="#19E59A" opacity="0.13"/>
  <path d="M50 50 L23 50 A27 27 0 0 1 31 31 Z" fill="#19E59A" opacity="0.05"/>
  <circle cx="50" cy="50" r="27" fill="none" stroke="#19E59A" stroke-width="1.6" opacity="0.30"/>
  <circle cx="50" cy="50" r="20" fill="none" stroke="#19E59A" stroke-width="1.6" opacity="0.45"/>
  <circle cx="50" cy="50" r="13.5" fill="none" stroke="#19E59A" stroke-width="1.6" opacity="0.60"/>
  <line x1="50" y1="50" x2="69" y2="31" stroke="#19E59A" stroke-width="2" stroke-linecap="round"/>
  <circle cx="69" cy="31" r="2.6" fill="#19E59A"/>
  <circle cx="50" cy="50" r="11" fill="#FFFFFF"/>
  <circle cx="46" cy="47" r="1.4" fill="#BFD8CC"/>
  <circle cx="54" cy="48" r="1.4" fill="#BFD8CC"/>
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
