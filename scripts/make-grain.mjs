// Generates public/grain.png — the 160x160 paper-grain tile.
// The design handoff specifies an inline SVG feTurbulence at 28% opacity, and
// asks that production ship a single small raster tile instead of
// re-rasterising the filter per element. This writes that tile.
//
//   npm run grain
//
// Greyscale + alpha PNG (colour type 4): every pixel is black, the alpha is
// the noise. Tiling it over a cream surface reads as paper grain.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 160;
const MAX_ALPHA = 26; // ~10% — matches feTurbulence at 0.28 opacity by eye

function crc32(buf) {
  let c;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 4; // colour type: greyscale + alpha
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Each scanline: 1 filter byte (0 = none) + SIZE * 2 bytes (grey, alpha).
const raw = Buffer.alloc(SIZE * (1 + SIZE * 2));
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0;
  for (let x = 0; x < SIZE; x++) {
    raw[p++] = 0; // black
    raw[p++] = Math.floor(Math.random() * MAX_ALPHA);
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "grain.png");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
