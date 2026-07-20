import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_CANVAS_COVERAGE } from './types.js';
import type { EditorImage } from './types.js';

/**
 * Geometry: coordinate space, initial fit, hit test, drag (docs/05 §2–§4). Ported VERBATIM from
 * the store customizer — every formula cites its source line. No DOM here; pointer conversion
 * takes a plain rect.
 */

/** The fractional placement anchor for fresh uploads (useFileHandlers.js:68). */
export const INITIAL_POSITION = { x: 0.5, y: 0.61 } as const;

/**
 * Initial fit for a fresh upload (useFileHandlers.js:60-93):
 * landscape/square (aspect ≥ 1) fits 80% of canvas height; portrait fits full canvas width;
 * centered at (0.5, 0.61); maxScale = 130% coverage bound rounded to 1 decimal.
 */
export function computeInitialFit(
  naturalWidth: number,
  naturalHeight: number,
): Omit<EditorImage, 'id'> {
  const aspectRatio = naturalWidth / naturalHeight; // useFileHandlers.js:69
  let baseWidth: number;
  let baseHeight: number;

  if (aspectRatio >= 1) {
    // landscape / square — useFileHandlers.js:72-74
    baseHeight = CANVAS_HEIGHT * 0.8;
    baseWidth = baseHeight * aspectRatio;
  } else {
    // portrait — useFileHandlers.js:75-78
    baseWidth = CANVAS_WIDTH;
    baseHeight = baseWidth / aspectRatio;
  }

  const initialScale = 1.0; // useFileHandlers.js:80
  // useFileHandlers.js:81-87 — 1-decimal rounding via *10 / 10
  const maxScale =
    Math.round(
      Math.max(
        (CANVAS_WIDTH * MAX_CANVAS_COVERAGE) / baseWidth,
        (CANVAS_HEIGHT * MAX_CANVAS_COVERAGE) / baseHeight,
      ) * 10,
    ) / 10;

  return {
    x: CANVAS_WIDTH * INITIAL_POSITION.x - baseWidth / 2, // useFileHandlers.js:90
    y: CANVAS_HEIGHT * INITIAL_POSITION.y - baseHeight / 2, // useFileHandlers.js:91
    width: baseWidth,
    height: baseHeight,
    rotation: 0,
    scale: initialScale,
    maxScale,
  };
}

/**
 * Restore path for a saved transform (useFileHandlers.js:37-52). The store uses `||` (not `??`)
 * for every fallback — reproduce exactly: any falsy saved value falls back.
 */
export function restoreImage(
  props: Partial<Omit<EditorImage, 'id'>>,
  naturalWidth: number,
  naturalHeight: number,
): Omit<EditorImage, 'id'> {
  const aspectRatio = naturalWidth / naturalHeight;
  return {
    x: props.x || 0,
    y: props.y || 0,
    width: props.width || CANVAS_WIDTH * 0.5,
    height: props.height || (props.width ? props.width / aspectRatio : CANVAS_HEIGHT * 0.5),
    rotation: props.rotation || 0,
    scale: props.scale || 1.0,
    maxScale: props.maxScale || 5,
  };
}

/** Screen → canvas-space pointer conversion (pointerHandlers.js:8-14). */
export function pointerToCanvas(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

/** The visually occupied box: scale applies about the box center (pointerHandlers.js:18-21). */
export function scaledBounds(img: Pick<EditorImage, 'x' | 'y' | 'width' | 'height' | 'scale'>): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const scaledWidth = img.width * img.scale;
  const scaledHeight = img.height * img.scale;
  return {
    x: img.x + (img.width - scaledWidth) / 2,
    y: img.y + (img.height - scaledHeight) / 2,
    width: scaledWidth,
    height: scaledHeight,
  };
}

/** Hit test, top-most image first (pointerHandlers.js:16-29). Returns the index or null. */
export function hitTest(
  images: readonly EditorImage[],
  mouseX: number,
  mouseY: number,
): number | null {
  for (let i = images.length - 1; i >= 0; i--) {
    const bounds = scaledBounds(images[i]!);
    if (
      mouseX >= bounds.x &&
      mouseX <= bounds.x + bounds.width &&
      mouseY >= bounds.y &&
      mouseY <= bounds.y + bounds.height
    ) {
      return i;
    }
  }
  return null;
}

/** Drag anchor captured on pointer down (pointerHandlers.js:25). */
export function dragStart(
  img: Pick<EditorImage, 'x' | 'y' | 'scale'>,
  mouseX: number,
  mouseY: number,
): { x: number; y: number } {
  return { x: (mouseX - img.x) / img.scale, y: (mouseY - img.y) / img.scale };
}

/**
 * Drag move → new top-left (pointerHandlers.js:75-81). Freeform: NO clamping — the photo may
 * leave the visible area (docs/05 §4; contrast Appendix D.5, not used).
 */
export function dragMove(
  img: Pick<EditorImage, 'scale'>,
  anchor: { x: number; y: number },
  mouseX: number,
  mouseY: number,
): { x: number; y: number } {
  return { x: mouseX - anchor.x * img.scale, y: mouseY - anchor.y * img.scale };
}
