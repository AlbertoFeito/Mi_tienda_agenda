import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';

// NayadeStore launcher icon.
// "Náyade" is a water nymph in Greek mythology, so the mark is a clean water
// droplet (white, with a soft highlight) on the app's teal brand color.

const RES = path.resolve('android/app/src/main/res');
const TEAL_A = '#0F766E';
const TEAL_B = '#134E4A';

const droplet = (fill) => `
  <path d="M54 20 C 54 20, 32 46, 32 63 a 22 22 0 1 0 44 0 C 76 46, 54 20, 54 20 Z" fill="${fill}"/>
  <ellipse cx="46" cy="60" rx="5.5" ry="9.5" fill="#ffffff" opacity="0.5"/>
`;

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL_A}"/>
      <stop offset="1" stop-color="${TEAL_B}"/>
    </linearGradient>
    <linearGradient id="drop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e8fffb"/>
    </linearGradient>
  </defs>
`;

// Adaptive foreground: transparent background, droplet centered in safe zone.
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">
  ${defs}
  ${droplet('url(#drop)')}
</svg>`;

// Legacy square icon: teal background + droplet.
const squareSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">
  ${defs}
  <rect width="108" height="108" rx="0" fill="url(#bg)"/>
  ${droplet('url(#drop)')}
</svg>`;

// Legacy round icon: teal circle + droplet, transparent corners.
const roundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">
  ${defs}
  <circle cx="54" cy="54" r="54" fill="url(#bg)"/>
  ${droplet('url(#drop)')}
</svg>`;

const legacySizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const foregroundSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function render(svg, size, outPath) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outPath);
}

for (const [density, size] of Object.entries(legacySizes)) {
  const dir = path.join(RES, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  await render(squareSvg, size, path.join(dir, 'ic_launcher.png'));
  await render(roundSvg, size, path.join(dir, 'ic_launcher_round.png'));
}

for (const [density, size] of Object.entries(foregroundSizes)) {
  const dir = path.join(RES, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  await render(foregroundSvg, size, path.join(dir, 'ic_launcher_foreground.png'));
}

// Also refresh the web/PWA icons for consistency.
const PUB = path.resolve('public');
await render(squareSvg, 192, path.join(PUB, 'icon-192.png'));
await render(squareSvg, 512, path.join(PUB, 'icon-512.png'));

console.log('Icons generated.');
