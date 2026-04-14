const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 1200;
const H = 630;
const NAVY = '#0f172a';
const NAVY_MID = '#1e293b';
const WHITE = '#f1f5f9';
const SKY = '#38bdf8';
const BORDER = 'rgba(56,189,248,0.25)';

async function build() {
  const logoPath = path.join(__dirname, 'logo-hg-trimmed.png');
  const logoMeta = await sharp(logoPath).metadata();
  const logoTargetH = 360;
  const logoTargetW = Math.round(logoMeta.width * (logoTargetH / logoMeta.height));
  const logoBuf = await sharp(logoPath).resize({ height: logoTargetH }).toBuffer();

  const logoX = 90;
  const logoY = Math.round((H - logoTargetH) / 2);
  const textX = logoX + logoTargetW + 60;

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="${NAVY_MID}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${SKY}"/>

  <text x="${textX}" y="260" font-family="Georgia, 'Cormorant Garamond', serif" font-size="86" font-weight="400" fill="${WHITE}">Holistic</text>
  <text x="${textX}" y="360" font-family="Georgia, 'Cormorant Garamond', serif" font-size="86" font-weight="400" fill="${SKY}">Governance</text>

  <line x1="${textX}" y1="400" x2="${textX + 80}" y2="400" stroke="${SKY}" stroke-width="2"/>

  <text x="${textX}" y="450" font-family="'Segoe UI', 'DM Sans', Arial, sans-serif" font-size="22" fill="${WHITE}" opacity="0.85">Clarity and confidence in governance</text>
  <text x="${textX}" y="482" font-family="'Segoe UI', 'DM Sans', Arial, sans-serif" font-size="22" fill="${WHITE}" opacity="0.85">through knowledge, data, and technology.</text>

  <text x="${textX}" y="560" font-family="'Segoe UI', 'DM Sans', Arial, sans-serif" font-size="18" fill="${SKY}" letter-spacing="3">HG-AU.COM</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .composite([{ input: logoBuf, left: logoX, top: logoY }])
    .png()
    .toFile(path.join(__dirname, 'og-image.png'));

  console.log(`Wrote og-image.png (${W}x${H})`);
}

build().catch(e => { console.error(e); process.exit(1); });
