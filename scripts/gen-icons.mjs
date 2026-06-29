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
  <path d="M44 41 Q49 34 44 27" fill="none" stroke="#C9D2EE" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M56 41 Q61 34 56 27" fill="none" stroke="#C9D2EE" stroke-width="2.8" stroke-linecap="round"/>
  <ellipse cx="50" cy="78" rx="22" ry="4.2" fill="#E1E7F5"/>
  <path d="M35 54 L39 72 Q50 78 61 72 L65 54 Z" fill="#FFFFFF"/>
  <ellipse cx="50" cy="54" rx="15" ry="3.8" fill="#C3D0EC"/>
  <path d="M65 58 Q75 58 73 67 Q71 72 64 70.5" fill="none" stroke="#FFFFFF" stroke-width="3.8"/>
  <circle cx="50" cy="50" r="9" fill="#FFFFFF"/>
  <circle cx="47" cy="48" r="1.4" fill="#9DB0E0"/>
  <circle cx="53" cy="49" r="1.4" fill="#9DB0E0"/>
  <circle cx="50" cy="53" r="1.4" fill="#9DB0E0"/>
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
