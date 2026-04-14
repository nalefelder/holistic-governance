const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Render at 2x to stay sharp when messaging apps display on high-DPI screens.
// Aspect stays 1200x630 (Facebook / LinkedIn recommended ratio).
const SCALE = 2;
const W = 1000 * SCALE;
const H = 700 * SCALE;
const NAVY = '#0f172a';
const NAVY_MID = '#1e293b';
const WHITE = '#f1f5f9';
const SKY = '#38bdf8';

async function build() {
  const logoPath = path.join(__dirname, 'logo-hg-trimmed.png');

  // Trim transparent padding so the logo optically centers.
  const trimmed = await sharp(logoPath).trim().toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();

  const TEXT_SIZE = 50;
  const GAP = 70;
  const logoTargetH = 360 * SCALE;
  const logoTargetW = Math.round(trimmedMeta.width * (logoTargetH / trimmedMeta.height));
  const logoBuf = await sharp(trimmed)
    .resize({ height: logoTargetH, kernel: sharp.kernel.lanczos3 })
    .toBuffer();

  const s = v => v * SCALE;

  const stackH = logoTargetH + s(GAP) + s(TEXT_SIZE);
  const logoY = Math.round((H - stackH) / 2);
  const logoX = Math.round((W - logoTargetW) / 2);
  const textBaselineY = logoY + logoTargetH + s(GAP) + s(TEXT_SIZE * 0.8);

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="${NAVY_MID}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <text x="${W / 2}" y="${textBaselineY}" text-anchor="middle" font-family="Georgia, 'Cormorant Garamond', serif" font-size="${s(TEXT_SIZE)}" font-weight="400" xml:space="preserve">
    <tspan fill="${WHITE}">Holistic</tspan><tspan fill="${SKY}">&#160;Governance</tspan>
  </text>
</svg>`;

  await sharp(Buffer.from(svg))
    .composite([{ input: logoBuf, left: logoX, top: logoY }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(__dirname, 'og-image-v2.png'));

  console.log(`Wrote og-image-v2.png (${W}x${H})`);
}

build().catch(e => { console.error(e); process.exit(1); });
