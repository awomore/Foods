const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'assets', 'images');

const DARK   = '#1A1009';
const GOLD   = '#C8973A';
const SPICE  = '#A67828';
const WHITE  = '#FAF6F0';

// Dotted ring — small circles positioned around the circumference with a gap for the accent dot
function dottedRing(cx, cy, r, dotR, count, color, gapAngleDeg, gapSizeDeg) {
  const gapRad  = (gapAngleDeg - 90) * Math.PI / 180; // -90 so 0° = top
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

// Accent dot position on the ring (same angle as the gap)
function accentDot(cx, cy, r, dotR, angleDeg, color) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  const x = (cx + r * Math.cos(rad)).toFixed(1);
  const y = (cy + r * Math.sin(rad)).toFixed(1);
  return `<circle cx="${x}" cy="${y}" r="${dotR}" fill="${color}"/>`;
}

// ─── App icon 1024×1024 ────────────────────────────────────────────────────
const CX = 512, CY = 510;
const RING_R = 318;
const DOT_R  = 9.5;
const DOT_N  = 58;
const GAP_ANG = 100;  // degrees clockwise from top (≈ 4 o'clock)
const GAP_SZ  = 20;   // degrees wide

const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="60%">
      <stop offset="0%"   stop-color="#231408"/>
      <stop offset="100%" stop-color="${DARK}"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bg)"/>

  <!-- Dotted ring -->
  ${dottedRing(CX, CY, RING_R, DOT_R, DOT_N, GOLD, GAP_ANG, GAP_SZ)}

  <!-- Accent dot -->
  ${accentDot(CX, CY, RING_R, 26, GAP_ANG, GOLD)}

  <!-- Serif F — centred inside the ring -->
  <text
    x="${CX - 28}"
    y="${CY + 95}"
    font-family="'Times New Roman', Georgia, serif"
    font-size="330"
    font-weight="400"
    fill="${WHITE}"
    text-anchor="middle"
    dominant-baseline="auto"
  >F</text>
</svg>
`.trim();

// ─── Adaptive icon foreground (transparent bg, Android clips shape) ────────
const adaptiveSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${dottedRing(CX, CY, RING_R, DOT_R, DOT_N, GOLD, GAP_ANG, GAP_SZ)}
  ${accentDot(CX, CY, RING_R, 26, GAP_ANG, GOLD)}
  <text
    x="${CX - 28}"
    y="${CY + 95}"
    font-family="'Times New Roman', Georgia, serif"
    font-size="330"
    font-weight="400"
    fill="${WHITE}"
    text-anchor="middle"
  >F</text>
</svg>
`.trim();

// ─── Splash 512×512 — wordmark centred on dark bg ─────────────────────────
const splashSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg2" cx="50%" cy="45%" r="55%">
      <stop offset="0%"   stop-color="#231408"/>
      <stop offset="100%" stop-color="${DARK}"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg2)"/>

  <!-- Mini dotted ring -->
  ${dottedRing(256, 240, 142, 4.5, 52, GOLD, 100, 18)}
  ${accentDot(256, 240, 142, 12, 100, GOLD)}

  <!-- F -->
  <text
    x="242"
    y="288"
    font-family="'Times New Roman', Georgia, serif"
    font-size="148"
    font-weight="400"
    fill="${WHITE}"
    text-anchor="middle"
  >F</text>

  <!-- "oods" smaller beside -->
  <text
    x="334"
    y="275"
    font-family="'Times New Roman', Georgia, serif"
    font-size="68"
    font-weight="400"
    fill="${WHITE}"
    text-anchor="start"
  >oods</text>

  <!-- by me -->
  <text
    x="256"
    y="330"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="32"
    fill="${GOLD}"
    text-anchor="middle"
    letter-spacing="4"
  >by me</text>
</svg>
`.trim();

// ─── Favicon 48×48 ────────────────────────────────────────────────────────
const faviconSvg = `
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="${DARK}"/>
  ${dottedRing(24, 23, 16, 1.5, 40, GOLD, 100, 18)}
  ${accentDot(24, 23, 16, 3, 100, GOLD)}
  <text x="23" y="31" font-family="'Times New Roman', Georgia, serif" font-size="18"
    fill="${WHITE}" text-anchor="middle">F</text>
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
  await generate(adaptiveSvg,path.join(OUT, 'adaptive-icon.png'), 1024, 1024);
  await generate(splashSvg,  path.join(OUT, 'splash-icon.png'),    512,  512);
  await generate(faviconSvg, path.join(OUT, 'favicon.png'),         48,   48);
  console.log('\nAll assets written to assets/images/');
})();
