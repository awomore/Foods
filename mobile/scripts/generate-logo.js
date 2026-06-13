const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'assets', 'images');

const DARK  = '#111827';
const GOLD  = '#C8973A';
const WHITE = '#FAF6F0';
const EMBER = '#E8924A';

function dottedRing(cx, cy, r, dotR, count, color, gapAngleDeg, gapSizeDeg) {
  const gapRad  = (gapAngleDeg - 90) * Math.PI / 180;
  const halfGap = (gapSizeDeg / 2) * Math.PI / 180;
  let dots = '';
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    let diff = angle - gapRad;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) < halfGap) continue;
    const x = (cx + r * Math.cos(angle)).toFixed(1);
    const y = (cy + r * Math.sin(angle)).toFixed(1);
    dots += `<circle cx="${x}" cy="${y}" r="${dotR}" fill="${color}"/>`;
  }
  return dots;
}

function accentDot(cx, cy, r, dotR, angleDeg, color) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  const x = (cx + r * Math.cos(rad)).toFixed(1);
  const y = (cy + r * Math.sin(rad)).toFixed(1);
  return `<circle cx="${x}" cy="${y}" r="${dotR}" fill="${color}"/>`;
}

// ─── App icon 1024×1024 — lettermark F in dotted ring ─────────────────────
const CX = 512, CY = 510;
const RING_R = 318;
const DOT_R  = 9.5;
const DOT_N  = 58;
const GAP_ANG = 100;
const GAP_SZ  = 20;

const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#231408"/>
      <stop offset="100%" stop-color="${DARK}"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  ${dottedRing(CX, CY, RING_R, DOT_R, DOT_N, GOLD, GAP_ANG, GAP_SZ)}
  ${accentDot(CX, CY, RING_R, 26, GAP_ANG, GOLD)}
  <text x="${CX - 28}" y="${CY + 95}"
    font-family="'Times New Roman', Georgia, serif"
    font-size="330" font-weight="400" fill="${WHITE}"
    text-anchor="middle">F</text>
</svg>`.trim();

const adaptiveSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${dottedRing(CX, CY, RING_R, DOT_R, DOT_N, GOLD, GAP_ANG, GAP_SZ)}
  ${accentDot(CX, CY, RING_R, 26, GAP_ANG, GOLD)}
  <text x="${CX - 28}" y="${CY + 95}"
    font-family="'Times New Roman', Georgia, serif"
    font-size="330" font-weight="400" fill="${WHITE}"
    text-anchor="middle">F</text>
</svg>`.trim();

// ─── Splash 1024×1024 — centred "FOODS byme" wordmark ─────────────────────
// Shows: large FOODS in serif + small "byme" in light sans + tagline
const splashSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg2" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#231408"/>
      <stop offset="100%" stop-color="${DARK}"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg2)"/>

  <!-- Subtle dotted ring behind wordmark -->
  ${dottedRing(512, 490, 310, 6, 58, 'rgba(200,151,58,0.35)', 100, 20)}
  ${accentDot(512, 490, 310, 18, 100, 'rgba(200,151,58,0.5)')}

  <!-- FOODS — large serif -->
  <text x="512" y="520"
    font-family="'Times New Roman', Georgia, serif"
    font-size="200" font-weight="400" fill="${WHITE}"
    text-anchor="middle" letter-spacing="-4">FOODS</text>

  <!-- byme — smaller, ember colour, light weight -->
  <text x="512" y="592"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="64" font-weight="300" fill="${EMBER}"
    text-anchor="middle" letter-spacing="12">byme</text>

  <!-- tagline -->
  <text x="512" y="656"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="28" fill="rgba(232,146,74,0.55)"
    text-anchor="middle" letter-spacing="3">real food · real kitchens · real people</text>
</svg>`.trim();

const faviconSvg = `
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="${DARK}"/>
  ${dottedRing(24, 23, 16, 1.5, 40, GOLD, 100, 18)}
  ${accentDot(24, 23, 16, 3, 100, GOLD)}
  <text x="23" y="31" font-family="'Times New Roman', Georgia, serif" font-size="18"
    fill="${WHITE}" text-anchor="middle">F</text>
</svg>`.trim();

async function generate(svg, outFile, width, height) {
  const buf = Buffer.from(svg);
  await sharp(buf, { density: 300 }).resize(width, height).png().toFile(outFile);
  console.log(`  ${path.basename(outFile)} (${width}x${height})`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await generate(iconSvg,     path.join(OUT, 'icon.png'),           1024, 1024);
  await generate(adaptiveSvg, path.join(OUT, 'adaptive-icon.png'),  1024, 1024);
  await generate(splashSvg,   path.join(OUT, 'splash-icon.png'),    1024, 1024);
  await generate(faviconSvg,  path.join(OUT, 'favicon.png'),          48,   48);
  console.log('Done. Rebuild the app to see the new assets.');
})();
