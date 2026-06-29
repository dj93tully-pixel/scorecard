// scripts/gen-icons.mjs
// Rasterizes the Lunchball bitten-ball mark into PWA / home-screen PNG icons.
// Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Mirrors public/lunchball-mark.svg — a rounded blue tile (safe padding built in,
// so it works as both the maskable app icon and the favicon).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect x="4" y="4" width="92" height="92" rx="22" fill="#354CA1"/>
  <circle cx="48" cy="53" r="31" fill="#FFFFFF"/>
  <circle cx="74" cy="31" r="15" fill="#354CA1"/>
  <circle cx="40" cy="47" r="2.7" fill="#D5DAE2"/>
  <circle cx="53" cy="49" r="2.7" fill="#D5DAE2"/>
  <circle cx="46" cy="59" r="2.7" fill="#D5DAE2"/>
  <circle cx="58" cy="61" r="2.7" fill="#D5DAE2"/>
  <circle cx="38" cy="63" r="2.7" fill="#D5DAE2"/>
  <circle cx="60" cy="48" r="2.7" fill="#D5DAE2"/>
</svg>`;

mkdirSync("public", { recursive: true });
const buf = Buffer.from(svg);
const out = [
  ["public/icon-512.png", 512],
  ["public/icon-192.png", 192],
  ["public/apple-touch-icon.png", 180],
];
for (const [file, size] of out) {
  await sharp(buf).resize(size, size).png().toFile(file);
  console.log("wrote", file, `${size}x${size}`);
}
