// scripts/gen-icons.mjs
// Rasterizes the header wolf mark (with eyes + snout) into PWA / home-screen
// PNG icons. Run with `node scripts/gen-icons.mjs` whenever the mark changes.

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Mirrors components/WolfLogo.tsx on a full dark square (platforms round corners).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">
  <rect width="64" height="64" fill="#0C0C0E"/>
  <path d="M12 8 L20 22 L14 34 C12 44 20 56 32 56 C44 56 52 44 50 34 L44 22 L52 8 L40 16 L24 16 L12 8 Z" fill="#6BA0FF"/>
  <circle cx="25" cy="30" r="2.6" fill="#0A0E1C"/>
  <circle cx="39" cy="30" r="2.6" fill="#0A0E1C"/>
  <path d="M28 40 L32 46 L36 40 Z" fill="#0A0E1C" opacity="0.85"/>
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
