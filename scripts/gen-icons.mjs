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
  <path d="M50 50 L50 22 A28 28 0 0 1 70 30 Z" fill="#20EBA0" opacity="0.30"/>
  <circle cx="50" cy="50" r="27" fill="none" stroke="#20EBA0" stroke-width="2.8"/>
  <circle cx="50" cy="50" r="20" fill="none" stroke="#20EBA0" stroke-width="2.8"/>
  <circle cx="50" cy="50" r="14" fill="none" stroke="#20EBA0" stroke-width="2.8"/>
  <line x1="50" y1="50" x2="70" y2="30" stroke="#20EBA0" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="70" cy="30" r="3.8" fill="#20EBA0"/>
  <circle cx="50" cy="50" r="11.5" fill="#FFFFFF" stroke="#07150E" stroke-width="2.6"/>
  <circle cx="45" cy="47" r="2" fill="#C2D8CD"/>
  <circle cx="55" cy="48" r="2" fill="#C2D8CD"/>
  <circle cx="50" cy="55" r="2" fill="#C2D8CD"/>
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
