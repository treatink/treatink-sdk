// Deterministic e2e input assets (committed output; run manually). Currently: a JPEG whose EXIF
// orientation is 6 (rotate 90° CW to display) — encoded 800×600 landscape with a red band on its
// ENCODED top edge; browsers must display it as 600×800 portrait (P2-T05 EXIF check).
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = new URL('../test/e2e/harness/assets/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const canvas = createCanvas(800, 600);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#2e86c1';
ctx.fillRect(0, 0, 800, 600);
ctx.fillStyle = '#ff0000';
ctx.fillRect(0, 0, 800, 60); // encoded-top red band → displayed as the LEFT edge after rotation

const jpeg = canvas.toBuffer('image/jpeg');

// Minimal EXIF APP1 with Orientation (0x0112) = 6, inserted right after SOI (FFD8).
const tiff = Buffer.concat([
  Buffer.from('49492A0008000000', 'hex'), // II*\0, IFD0 at offset 8
  Buffer.from('0100', 'hex'), // 1 entry
  Buffer.from('1201030001000000', 'hex'), // tag 0x0112, SHORT, count 1
  Buffer.from('0600', 'hex'), // value 6
  Buffer.from('0000', 'hex'), // value padding
  Buffer.from('00000000', 'hex'), // next IFD: none
]);
const exifBody = Buffer.concat([Buffer.from('457869660000', 'hex'), tiff]); // 'Exif\0\0' + TIFF
const app1 = Buffer.concat([
  Buffer.from('FFE1', 'hex'),
  Buffer.from([(exifBody.length + 2) >> 8, (exifBody.length + 2) & 0xff]),
  exifBody,
]);

const withExif = Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
writeFileSync(join(OUT, 'exif-rotated.jpg'), withExif);
console.log(`exif-rotated.jpg: encoded 800×600, orientation 6 → displays 600×800`);
