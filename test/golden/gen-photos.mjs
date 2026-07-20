// Deterministic synthetic sample photos for the golden matrix (docs/06 §3, docs/08 §9).
// Committed generator, run manually once; output PNGs are frozen under fixtures/photos/.
// Synthetic (gradient + shapes) instead of real pet photos — photos are sensitive (AGENTS.md §0.6)
// and these have enough spatial structure that any transform error shifts pixels.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = new URL('./fixtures/photos/', import.meta.url).pathname;

function photo(name, width, height, hueA, hueB) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, hueA);
  gradient.addColorStop(1, hueB);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  // asymmetric structure: a circle off-center + a corner wedge + a grid of ticks
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(width * 0.3, height * 0.35, Math.min(width, height) * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222222';
  ctx.beginPath();
  ctx.moveTo(width, height);
  ctx.lineTo(width * 0.7, height);
  ctx.lineTo(width, height * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffcc00';
  for (let i = 1; i < 8; i++) {
    ctx.fillRect((width * i) / 8 - 2, height * 0.5 - 2, 4, 4);
  }
  writeFileSync(join(OUT, `${name}.png`), canvas.toBuffer('image/png'));
  console.log(`${name}.png ${width}×${height}`);
}

photo('portrait', 1536, 2048, '#3a6ea5', '#c05f9e');
photo('landscape', 2048, 1536, '#2e8b57', '#c0a95f');
photo('square', 1000, 1000, '#8e44ad', '#e67e22');
photo('lowres', 400, 300, '#b03a2e', '#2e86c1');
