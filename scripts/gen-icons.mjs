// scripts/gen-icons.mjs
// Rasterizes the TEEPARTY teacup mark into PWA / home-screen PNG icons.
// Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Home-screen icons must be FULL-BLEED with no transparency — iOS can't show
// transparent app icons (it fills them with black) and applies its own rounded
// mask. So the blue fills the whole square edge-to-edge; iOS rounds the corners.
// (The in-app header mark in public/teeparty-mark.svg keeps its rounded tile.)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="#354CA1"/>
  <ellipse cx="50" cy="74" rx="23" ry="4.5" fill="#E1E7F5"/>
  <path d="M35 50 L39 69 Q50 75 61 69 L65 50 Z" fill="#FFFFFF"/>
  <ellipse cx="50" cy="50" rx="15" ry="4" fill="#E1E7F5"/>
  <path d="M65 54 Q75 54 73 63 Q71 69 64 67" fill="none" stroke="#FFFFFF" stroke-width="4"/>
  <circle cx="50" cy="46" r="10" fill="#FFFFFF"/>
  <circle cx="47" cy="44" r="1.5" fill="#C3D0EC"/>
  <circle cx="53" cy="45" r="1.5" fill="#C3D0EC"/>
  <circle cx="50" cy="49" r="1.5" fill="#C3D0EC"/>
</svg>`;

mkdirSync("public", { recursive: true });
const buf = Buffer.from(svg);
const out = [
  ["public/icon-512.png", 512],
  ["public/icon-192.png", 192],
  ["public/apple-touch-icon.png", 180],
];
for (const [file, size] of out) {
  // flatten onto the blue so there is zero transparency (no iOS black ring).
  await sharp(buf)
    .resize(size, size)
    .flatten({ background: "#354CA1" })
    .png()
    .toFile(file);
  console.log("wrote", file, `${size}x${size}`);
}
