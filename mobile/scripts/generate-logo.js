const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'assets', 'images');

// Brand colours
const DARK   = '#1A1009';
const EMBER  = '#E8924A';
const SPICE  = '#B36A2E';
const CANVAS = '#FAF6F0';

// ─── F lettermark (stem + 2 bars) ─────────────────────────────────────────
//   Centred at 512,490 within 1024×1024
const F_LEFT = 400;
const F_TOP  = 330;
const STEM_W = 54;
const F_H    = 340;
const BAR1_W = 250;   // top bar
const BAR2_W = 185;   // mid bar
const BAR_H  = 52;
const MID_Y  = F_TOP + 148;   // y-pos of middle bar

function fMark(color = EMBER) {
  return `
    <rect x="${F_LEFT}" y="${F_TOP}" width="${STEM_W}" height="${F_H}" rx="10" fill="${color}"/>
    <rect x="${F_LEFT}" y="${F_TOP}" width="${BAR1_W}" height="${BAR_H}" rx="10" fill="${color}"/>
    <rect x="${F_LEFT}" y="${MID_Y}" width="${BAR2_W}" height="${BAR_H}" rx="10" fill="${color}"/>
  `;
}

// ─── App icon 1024×1024 ────────────────────────────────────────────────────
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="55%">
      <stop offset="0%"   stop-color="#2A1A0C"/>
      <stop offset="100%" stop-color="${DARK}"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bg)"/>

  <!-- Outer ring accent (very subtle) -->
  <circle cx="512" cy="490" r="340" fill="none" stroke="${EMBER}" stroke-width="3" opacity="0.18"/>

  <!-- Inner ring -->
  <circle cx="512" cy="490" r="270" fill="none" stroke="${EMBER}" stroke-width="1.5" opacity="0.12"/>

  <!-- F mark -->
  ${fMark(EMBER)}

  <!-- Brand dot -->
  <circle cx="512" cy="730" r="10" fill="${SPICE}" opacity="0.9"/>
</svg>
`.trim();

// ─── Adaptive icon 1024×1024 (transparent bg, Android applies shape) ────────
const adaptiveSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- No background — Android adaptive icon framework clips to shape -->
  ${fMark(EMBER)}
  <circle cx="512" cy="730" r="10" fill="${SPICE}"/>
</svg>
`.trim();

// ─── Splash icon 512×512 (shown centred on dark bg in app.json) ───────────
const splashSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg2" cx="50%" cy="45%" r="55%">
      <stop offset="0%"   stop-color="#2A1A0C"/>
      <stop offset="100%" stop-color="${DARK}"/>
    </radialGradient>
  </defs>

  <rect width="512" height="512" fill="url(#bg2)"/>

  <!-- "FOODS" wordmark -->
  <text
    x="256" y="230"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="112"
    font-weight="bold"
    fill="${EMBER}"
    text-anchor="middle"
    letter-spacing="8"
  >FOODS</text>

  <!-- Thin divider line -->
  <rect x="156" y="248" width="200" height="2" rx="1" fill="${SPICE}" opacity="0.7"/>

  <!-- "byme" sub-word -->
  <text
    x="256" y="310"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="52"
    fill="${SPICE}"
    text-anchor="middle"
    letter-spacing="6"
  >byme</text>
</svg>
`.trim();

// ─── Favicon 48×48 ────────────────────────────────────────────────────────
const faviconSvg = `
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="${DARK}"/>
  <!-- Mini F mark -->
  <rect x="13" y="10" width="6" height="28" rx="2" fill="${EMBER}"/>
  <rect x="13" y="10" width="22" height="6" rx="2" fill="${EMBER}"/>
  <rect x="13" y="21" width="16" height="5" rx="2" fill="${EMBER}"/>
</svg>
`.trim();

async function generate(svg, outFile, width, height) {
  const buf = Buffer.from(svg);
  await sharp(buf, { density: 300 })
    .resize(width, height)
    .png()
    .toFile(outFile);
  console.log(`✓  ${path.basename(outFile)} (${width}×${height})`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  await generate(iconSvg,    path.join(OUT, 'icon.png'),          1024, 1024);
  await generate(iconSvg,    path.join(OUT, 'adaptive-icon.png'), 1024, 1024);
  await generate(splashSvg,  path.join(OUT, 'splash-icon.png'),    512,  512);
  await generate(faviconSvg, path.join(OUT, 'favicon.png'),         48,   48);

  console.log('\nAll assets written to assets/images/');
})();
