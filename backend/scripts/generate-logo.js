'use strict';
/**
 * Generates FOODSbyme app icon assets as PNG files.
 * Outputs to mobile/assets/images/:
 *   icon.png          1024×1024  (iOS + Android launcher)
 *   adaptive-icon.png 1024×1024  (Android adaptive foreground)
 *   favicon.png         48×48    (web)
 *   splash-icon.png   512×512    (splash screen centre image)
 *
 * Design: dark ink (#1A1009) rounded-square background,
 *         bold "F" letterform in warm spice (#C97A35),
 *         cream dot accent (#FAF6F0) above the cross-bar.
 *
 * No npm deps — pure Node built-ins (zlib, fs, path).
 */

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC-32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG encoder ───────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crcBuf]);
}

function encodePNG(width, height, getPixel) {
  // getPixel(x, y) → [r, g, b, a]  (0-255 each)
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const i = y * (stride + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Brand colours ─────────────────────────────────────────────────────────────
const INK   = [0x1A, 0x10, 0x09, 255]; // #1A1009  dark brown-black
const SPICE = [0xC9, 0x7A, 0x35, 255]; // #C97A35  warm spice orange
const CREAM = [0xFA, 0xF6, 0xF0, 255]; // #FAF6F0  off-white cream
const TRANS = [0,    0,    0,    0  ]; // transparent

// ── Smooth superellipse mask (rounded-square) ─────────────────────────────────
function inRoundedSquare(x, y, cx, cy, half, n = 6) {
  const nx = Math.abs((x - cx) / half);
  const ny = Math.abs((y - cy) / half);
  return nx ** n + ny ** n <= 1;
}

// ── Antialiased circle check ──────────────────────────────────────────────────
function diskAlpha(x, y, cx, cy, r) {
  const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  if (d < r - 0.7) return 255;
  if (d > r + 0.7) return 0;
  return Math.round((r + 0.7 - d) / 1.4 * 255);
}

// ── Pixel function for any size ───────────────────────────────────────────────
function logoPixel(x, y, S) {
  const cx = S / 2;
  const cy = S / 2;
  const half = S * 0.46; // rounded-square half-size

  // Transparent outside rounded square
  if (!inRoundedSquare(x, y, cx, cy, half)) return TRANS;

  // Normalised coordinates inside the square (-1 … +1)
  const nx = (x - cx) / (S * 0.40);
  const ny = (y - cy) / (S * 0.40);

  // ── "F" letterform ──────────────────────────────────────────────────────────
  // Vertical bar:  x ∈ [-0.58, -0.18]  y ∈ [-0.80, 0.80]
  const vertBar = nx >= -0.58 && nx <= -0.18 && ny >= -0.80 && ny <= 0.80;
  // Top bar:       x ∈ [-0.58,  0.58]  y ∈ [-0.80, -0.44]
  const topBar  = nx >= -0.58 && nx <= 0.58  && ny >= -0.80 && ny <= -0.44;
  // Mid bar:       x ∈ [-0.58,  0.30]  y ∈ [-0.10,  0.26]
  const midBar  = nx >= -0.58 && nx <= 0.30  && ny >= -0.10 && ny <= 0.26;

  if (vertBar || topBar || midBar) return SPICE;

  // ── Cream dot accent (top-right quadrant, above mid-bar) ──────────────────
  const dotCX = cx + S * 0.18;
  const dotCY = cy - S * 0.08;
  const dotR  = S * 0.055;
  const da = diskAlpha(x, y, dotCX, dotCY, dotR);
  if (da > 0) {
    return [CREAM[0], CREAM[1], CREAM[2], da];
  }

  return INK;
}

// ── Generate a PNG buffer ─────────────────────────────────────────────────────
function makeIcon(size) {
  return encodePNG(size, size, (x, y) => logoPixel(x, y, size));
}

// ── Splash: centred icon on solid dark background ────────────────────────────
function makeSplash(W, H, iconSize) {
  const cx = W / 2;
  const cy = H / 2;
  const half = iconSize / 2;
  return encodePNG(W, H, (x, y) => {
    const lx = (x - cx) + half;
    const ly = (y - cy) + half;
    if (lx >= 0 && lx < iconSize && ly >= 0 && ly < iconSize) {
      const [r, g, b, a] = logoPixel(lx, ly, iconSize);
      if (a > 0) return [r, g, b, a];
    }
    return INK; // dark background
  });
}

// ── Write outputs ─────────────────────────────────────────────────────────────
const OUT = path.join(__dirname, '..', '..', 'mobile', 'assets', 'images');
fs.mkdirSync(OUT, { recursive: true });

const tasks = [
  { name: 'icon.png',          buf: () => makeIcon(1024) },
  { name: 'adaptive-icon.png', buf: () => makeIcon(1024) },
  { name: 'favicon.png',       buf: () => makeIcon(48)   },
  { name: 'splash-icon.png',   buf: () => makeSplash(512, 512, 280) },
];

for (const { name, buf } of tasks) {
  process.stdout.write(`Generating ${name} … `);
  const start = Date.now();
  fs.writeFileSync(path.join(OUT, name), buf());
  console.log(`done (${Date.now() - start}ms)`);
}

console.log(`\nLogo assets written to ${OUT}`);
