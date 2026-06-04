const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const CENTER = SIZE / 2;
const RING_RADIUS = 390;       // full icon & splash
const RING_RADIUS_ADAPTIVE = 290; // adaptive icon: must stay inside the safe zone (~338px)
const DOT_RADIUS = 10;
const NUM_DOTS = 56;

function generateDots(ringRadius = RING_RADIUS, dotRadius = DOT_RADIUS) {
  const count = ringRadius < 350 ? 44 : NUM_DOTS;
  const dots = [];
  // Leave a gap at ~3 o'clock (angle 0) for the accent dot
  const gapStart = -0.06 * Math.PI;
  const gapEnd   =  0.06 * Math.PI;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    if (angle >= gapStart && angle <= gapEnd) continue; // skip — accent dot goes here
    const x = (CENTER + ringRadius * Math.cos(angle)).toFixed(2);
    const y = (CENTER + ringRadius * Math.sin(angle)).toFixed(2);
    dots.push(`<circle cx="${x}" cy="${y}" r="${dotRadius}" fill="#C97A35"/>`);
  }
  // Accent dot at 3 o'clock (right side)
  const ax = (CENTER + ringRadius).toFixed(2);
  const ay = CENTER.toFixed(2);
  dots.push(`<circle cx="${ax}" cy="${ay}" r="${(dotRadius * 1.9).toFixed(2)}" fill="#C97A35"/>`);
  return dots.join('\n  ');
}

const fontPath = path.join(__dirname, '../node_modules/@expo-google-fonts/dm-serif-display/400Regular/DMSerifDisplay_400Regular.ttf');
const fontB64 = fs.readFileSync(fontPath).toString('base64');

function makeSvg(ringRadius, fontSize = 420) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'DMSerif';
        src: url('data:font/truetype;base64,${fontB64}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    </style>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="#1A1009"/>
  ${generateDots(ringRadius)}
  <text
    x="${CENTER}"
    y="${CENTER}"
    font-family="DMSerif, Georgia, serif"
    font-size="${fontSize}"
    font-weight="normal"
    fill="#FAF6F0"
    text-anchor="middle"
    dominant-baseline="central"
    paint-order="stroke fill"
    stroke="#FAF6F0"
    stroke-width="6"
    stroke-linejoin="round"
  >F</text>
</svg>`;
}

const svg = makeSvg(RING_RADIUS);

async function generate() {
  const outDir = path.join(__dirname, '../assets/images');

  // icon.png - 1024x1024
  await sharp(Buffer.from(svg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(outDir, 'icon.png'));
  console.log('✓ icon.png');

  // adaptive-icon.png - smaller ring so dots survive Android's circular mask (safe zone ≈338px)
  const adaptiveSvg = makeSvg(RING_RADIUS_ADAPTIVE, 310);
  await sharp(Buffer.from(adaptiveSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(outDir, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png');

  // splash-icon.png - 1242x2688 splash background
  const splashSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1242" height="2688" viewBox="0 0 1242 2688" xmlns="http://www.w3.org/2000/svg">
  <rect width="1242" height="2688" fill="#1A1009"/>
  <svg x="121" y="844" width="1000" height="1000" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <style>
        @font-face {
          font-family: 'DMSerif';
          src: url('data:font/truetype;base64,${fontB64}') format('truetype');
        }
      </style>
    </defs>
    ${generateDots()}
    <text x="${CENTER}" y="${CENTER}" font-family="DMSerif, Georgia, serif" font-size="420" fill="#FAF6F0" text-anchor="middle" dominant-baseline="central" paint-order="stroke fill" stroke="#FAF6F0" stroke-width="6" stroke-linejoin="round">F</text>
  </svg>
</svg>`;

  await sharp(Buffer.from(splashSvg))
    .resize(1242, 2688)
    .png()
    .toFile(path.join(outDir, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  // favicon.png - 48x48
  await sharp(Buffer.from(svg))
    .resize(48, 48)
    .png()
    .toFile(path.join(outDir, 'favicon.png'));
  console.log('✓ favicon.png');

  console.log('\nAll icons generated.');
}

generate().catch(console.error);
