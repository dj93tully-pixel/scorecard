// scripts/gen-icons.mjs
// Rasterizes the Lunchball bitten-ball mark into PWA / home-screen PNG icons.
// Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Home-screen icons must be FULL-BLEED with no transparency — iOS can't show
// transparent app icons (it fills them with black) and applies its own rounded
// mask. So the blue fills the whole square edge-to-edge; iOS rounds the corners.
// (The in-app header mark in public/lunchball-mark.svg keeps its rounded tile.)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="#354CA1"/>
  <circle cx="50" cy="52" r="33" fill="#FFFFFF"/>
  <circle cx="78" cy="29" r="16" fill="#354CA1"/>
  <circle cx="41" cy="46" r="2.9" fill="#D5DAE2"/>
  <circle cx="55" cy="48" r="2.9" fill="#D5DAE2"/>
  <circle cx="47" cy="59" r="2.9" fill="#D5DAE2"/>
  <circle cx="60" cy="61" r="2.9" fill="#D5DAE2"/>
  <circle cx="39" cy="63" r="2.9" fill="#D5DAE2"/>
  <circle cx="62" cy="47" r="2.9" fill="#D5DAE2"/>
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
