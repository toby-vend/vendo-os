#!/usr/bin/env node
/**
 * generate-pwa-icons.js
 * Generates 4 PWA icon PNGs using sharp + SVG rendering.
 * Run: node scripts/generate-pwa-icons.js
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'assets');

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/**
 * Build an SVG containing the Vendo "V" mark.
 * @param {number} size        - Canvas size in px
 * @param {number} padding     - Padding around the V glyph (safe zone inset)
 */
function buildSvg(size, padding) {
  const radius = Math.round(size * 0.12); // ~12% border-radius
  const innerSize = size - padding * 2;
  // Font size: V fills ~65% of the inner area height
  const fontSize = Math.round(innerSize * 0.65);
  const cx = size / 2;
  const cy = size / 2 + fontSize * 0.22; // optical vertical centre for capital letter

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="rounded">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/>
    </clipPath>
  </defs>
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#0B0B0B"/>
  <!-- V glyph -->
  <text
    x="${cx}"
    y="${cy}"
    text-anchor="middle"
    dominant-baseline="auto"
    font-family="Manrope, 'Inter', 'Helvetica Neue', Arial, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="#22C55E"
    clip-path="url(#rounded)"
  >V</text>
</svg>`;
}

const icons = [
  { file: 'icon-192.png',          size: 192, padding: 0 },
  { file: 'icon-512.png',          size: 512, padding: 0 },
  { file: 'icon-maskable-192.png', size: 192, padding: 19 }, // ~10% of 192 (safe zone)
  { file: 'icon-maskable-512.png', size: 512, padding: 51 }, // ~10% of 512 (safe zone)
];

for (const icon of icons) {
  const svgStr = buildSvg(icon.size, icon.padding);
  const outPath = path.join(OUT_DIR, icon.file);
  await sharp(Buffer.from(svgStr))
    .png()
    .toFile(outPath);
  console.log(`Generated: ${outPath} (${icon.size}x${icon.size})`);
}
console.log('All PWA icons generated.');
