import { MIN_SCALE } from './types.js';
import type { EditorImage } from './types.js';
import type { Transform } from '../types.js';

/**
 * Transform semantics (docs/05 §2, §5, §8.2): {x, y} is the fitted box's top-left in 900×1200
 * canvas space; `scale` multiplies the box about its center; rotation in degrees (0 in MVP).
 * The persisted transform is self-contained for print re-render — no zone context.
 */

/** Zoom clamp: [0.5, maxScale] everywhere — slider min and pinch clamp (pointerHandlers.js:60). */
export function clampScale(scale: number, maxScale: number): number {
  return Math.max(MIN_SCALE, Math.min(maxScale, scale));
}

/** Pinch zoom from a captured baseline (pointerHandlers.js:56-60). Same clamp as the slider. */
export function pinchScale(
  initialScale: number,
  initialDistance: number,
  currentDistance: number,
  maxScale: number,
): number {
  const scaleFactor = currentDistance / initialDistance;
  return clampScale(initialScale * scaleFactor, maxScale);
}

/**
 * The persisted public transform (docs/05 §8, saveCanvas.js:45-53): x/y rounded to 1 decimal
 * exactly like the store (`parseFloat(image.x.toFixed(1))`); rotation carried (0 in MVP).
 */
export function toPersistedTransform(
  img: Pick<EditorImage, 'x' | 'y' | 'scale' | 'rotation'>,
): Transform {
  return {
    x: parseFloat(img.x.toFixed(1)),
    y: parseFloat(img.y.toFixed(1)),
    scale: img.scale,
    rotation: img.rotation,
  };
}
