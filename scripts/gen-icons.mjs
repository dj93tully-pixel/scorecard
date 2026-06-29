// scripts/gen-icons.mjs
// Rasterizes the TEEPARTY teacup mark into PWA / home-screen PNG icons.
// Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Home-screen icons are FULL-BLEED with no transparency — iOS can't show
// transparent app icons (it fills them with black) and applies its own rounded
// mask. The black fills the whole square edge-to-edge; iOS rounds the corners.
// (The in-app header mark in components/TeepartyMark.tsx is tile-less.)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="#354CA1"/>
  <path d="M34 49 L40 75 Q50 81 60 75 L66 49" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="50" cy="49" rx="16" ry="4" fill="none" stroke="#FFFFFF" stroke-width="3.4"/>
  <path d="M66 54 Q77 54 75 64 Q73 70 65 68" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round"/>
  <circle cx="50" cy="44" r="9" fill="none" stroke="#F5B301" stroke-width="3.4"/>
</svg>`;

mkdirSync("public", { recursive: true });
const buf = Buffer.from(svg);
const out = [
  ["public/icon-512.png", 512],
  ["public/icon-192.png", 192],
  ["public/apple-touch-icon.png", 180],
];
for (const [file, size] of out) {
  // flatten onto the tile color so there is zero transparency (no iOS ring).
  await sharp(buf)
    .resize(size, size)
    .flatten({ background: "#354CA1" })
    .png()
    .toFile(file);
  console.log("wrote", file, `${size}x${size}`);
}
