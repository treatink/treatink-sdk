import { describe, expect, it } from 'vitest';
import {
  computeInitialFit,
  dragMove,
  dragStart,
  hitTest,
  pointerToCanvas,
  restoreImage,
  scaledBounds,
} from './geometry.js';
import { clampScale, pinchScale, toPersistedTransform } from './transform.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_CANVAS_COVERAGE, MIN_SCALE } from './types.js';

// P1-T09: exact baseWidth/baseHeight, maxScale, x/y for portrait/landscape/square, matching the
// docs/05 §3 formulas (hand-computed anchors — derived from the spec, not from the engine).

describe('constants (docs/05 §1)', () => {
  it('pins the store values', () => {
    expect(CANVAS_WIDTH).toBe(900);
    expect(CANVAS_HEIGHT).toBe(1200);
    expect(MAX_CANVAS_COVERAGE).toBe(1.3);
    expect(MIN_SCALE).toBe(0.5);
  });
});

describe('initial fit (docs/05 §3, useFileHandlers.js:60-93)', () => {
  it('portrait 1536×2048 → full width 900×1200, maxScale 1.3, x=0 y=132', () => {
    const fit = computeInitialFit(1536, 2048);
    expect(fit.width).toBe(900);
    expect(fit.height).toBe(1200);
    expect(fit.maxScale).toBe(1.3);
    expect(fit.x).toBe(0); // 900*0.5 − 900/2
    expect(fit.y).toBe(132); // 1200*0.61 − 1200/2
    expect(fit.scale).toBe(1.0);
    expect(fit.rotation).toBe(0);
  });

  it('landscape 2048×1536 → 80% height: 1280×960, maxScale 1.6, x=−190 y=252', () => {
    const fit = computeInitialFit(2048, 1536);
    expect(fit.height).toBe(960); // 1200*0.8
    expect(fit.width).toBeCloseTo(1280, 10); // 960 * 4/3
    expect(fit.maxScale).toBe(1.6); // round(max(1170/1280, 1560/960)*10)/10 = round(16.25)/10
    expect(fit.x).toBeCloseTo(-190, 10); // 450 − 640
    expect(fit.y).toBe(252); // 732 − 480
  });

  it('square 1000×1000 → 960×960 (aspect 1 goes landscape branch), maxScale 1.6, x=−30 y=252', () => {
    const fit = computeInitialFit(1000, 1000);
    expect(fit.width).toBe(960);
    expect(fit.height).toBe(960);
    expect(fit.maxScale).toBe(1.6); // max(1.21875, 1.625) → 1.625 → 1.6
    expect(fit.x).toBe(-30); // 450 − 480
    expect(fit.y).toBe(252);
  });

  it('tall portrait 1000×1500 → 900×1350, maxScale 1.3 (width bound binds), y=57', () => {
    const fit = computeInitialFit(1000, 1500);
    expect(fit.width).toBe(900);
    expect(fit.height).toBe(1350);
    expect(fit.maxScale).toBe(1.3); // max(1.3, 1560/1350≈1.1556) → 1.3
    expect(fit.x).toBe(0);
    expect(fit.y).toBe(57); // 732 − 675
  });

  it('wide panorama 3000×1000 → 2880×960, maxScale 1.6, x=−990', () => {
    const fit = computeInitialFit(3000, 1000);
    expect(fit.width).toBe(2880);
    expect(fit.height).toBe(960);
    expect(fit.maxScale).toBe(1.6); // max(0.40625, 1.625) → 1.6
    expect(fit.x).toBe(-990); // 450 − 1440
    expect(fit.y).toBe(252);
  });
});

describe('restore path (docs/05 §3, useFileHandlers.js:37-52 — `||` semantics, verbatim)', () => {
  it('takes saved values as-is', () => {
    const r = restoreImage(
      { x: 12.5, y: -30, width: 1280, height: 960, rotation: 0, scale: 1.2, maxScale: 1.6 },
      2048,
      1536,
    );
    expect(r).toEqual({
      x: 12.5,
      y: -30,
      width: 1280,
      height: 960,
      rotation: 0,
      scale: 1.2,
      maxScale: 1.6,
    });
  });

  it('applies the store fallbacks with || (falsy scale/maxScale fall back; x/y stay 0)', () => {
    const r = restoreImage({ x: 0, y: 0, scale: 0, maxScale: 0 }, 1000, 1000);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.width).toBe(450); // CANVAS_WIDTH * 0.5
    expect(r.height).toBe(600); // no width saved → CANVAS_HEIGHT * 0.5
    expect(r.scale).toBe(1.0);
    expect(r.maxScale).toBe(5);
  });

  it('derives height from saved width and the natural aspect when height is missing', () => {
    const r = restoreImage({ width: 800 }, 2000, 1000);
    expect(r.height).toBe(400); // 800 / (2000/1000)
  });
});

describe('pointer & drag (docs/05 §2, §4, pointerHandlers.js)', () => {
  const IMG = {
    id: 'i',
    x: 100,
    y: 50,
    width: 400,
    height: 300,
    rotation: 0,
    scale: 2,
    maxScale: 3,
  };

  it('converts screen coords to canvas space', () => {
    const rect = { left: 10, top: 20, width: 450, height: 600 };
    expect(pointerToCanvas(10, 20, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerToCanvas(235, 320, rect)).toEqual({ x: 450, y: 600 }); // ×2 scale both axes
  });

  it('scaledBounds applies scale about the box center', () => {
    expect(scaledBounds(IMG)).toEqual({ x: -100, y: -100, width: 800, height: 600 });
  });

  it('hitTest checks the scaled box, top-most first', () => {
    expect(hitTest([IMG], 0, 0)).toBe(0); // inside [-100,700]×[-100,500]
    expect(hitTest([IMG], 701, 0)).toBeNull();
    const top = { ...IMG, id: 't', x: 300 };
    expect(hitTest([IMG, top], 150, 150)).toBe(1); // both hit → last in array wins
  });

  it('drag math: anchor divides by scale, move multiplies back — no clamping', () => {
    const anchor = dragStart(IMG, 200, 150);
    expect(anchor).toEqual({ x: 50, y: 50 });
    expect(dragMove(IMG, anchor, 300, 250)).toEqual({ x: 200, y: 150 });
    // freeform: far off-canvas positions are allowed (docs/05 §4 — no clamp)
    expect(dragMove(IMG, anchor, -5000, 9000)).toEqual({ x: -5100, y: 8900 });
  });
});

describe('zoom clamp (docs/05 §5, pointerHandlers.js:56-60)', () => {
  it('clamps to [0.5, maxScale]', () => {
    expect(clampScale(0.1, 1.6)).toBe(0.5);
    expect(clampScale(0.5, 1.6)).toBe(0.5);
    expect(clampScale(1.2, 1.6)).toBe(1.2);
    expect(clampScale(99, 1.6)).toBe(1.6);
  });

  it('pinch derives scale from the captured baseline, same clamp', () => {
    expect(pinchScale(1.0, 100, 150, 3)).toBe(1.5);
    expect(pinchScale(1.0, 100, 10, 3)).toBe(0.5); // floor
    expect(pinchScale(2.0, 100, 400, 3)).toBe(3); // ceiling at maxScale
  });
});

describe('persisted transform (docs/05 §8, saveCanvas.js:45-53)', () => {
  it('rounds x/y to 1 decimal exactly like the store', () => {
    const t = toPersistedTransform({ x: 12.3456, y: -0.04, scale: 1.25, rotation: 0 });
    expect(t).toEqual({ x: 12.3, y: -0, scale: 1.25, rotation: 0 });
  });
});
