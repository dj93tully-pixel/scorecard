// scripts/gen-icons.mjs
// Rasterizes the header tiger mark into PWA / home-screen PNG icons.
// Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Mirrors components/TigerLogo.tsx on a full dark square (platforms round corners).
const ORANGE = "#F97316";
const DARK = "#1B1B1B";
const EAR = "#7C2D12";
const MUZZLE = "#FFE6C7";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">
  <rect width="64" height="64" fill="#0C0C0E"/>
  <path d="M13 9 L25 19 L15 27 Z" fill="${ORANGE}"/>
  <path d="M51 9 L39 19 L49 27 Z" fill="${ORANGE}"/>
  <path d="M16 13 L23 19 L17 23 Z" fill="${EAR}"/>
  <path d="M48 13 L41 19 L47 23 Z" fill="${EAR}"/>
  <path d="M32 13 C18 13 11 24 11 35 C11 48 20 57 32 57 C44 57 53 48 53 35 C53 24 46 13 32 13 Z" fill="${ORANGE}"/>
  <ellipse cx="32" cy="45" rx="12" ry="9.5" fill="${MUZZLE}"/>
  <g stroke="${DARK}" stroke-width="3" stroke-linecap="round">
    <path d="M32 15 L32 27"/><path d="M22 17 L19 28"/><path d="M42 17 L45 28"/>
    <path d="M12 33 L22 35"/><path d="M52 33 L42 35"/>
  </g>
  <circle cx="25" cy="33" r="3" fill="${DARK}"/>
  <circle cx="39" cy="33" r="3" fill="${DARK}"/>
  <path d="M28.5 42 L35.5 42 L32 46.5 Z" fill="${DARK}"/>
  <path d="M32 46.5 L32 51" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>
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
