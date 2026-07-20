import { CANVAS_HEIGHT, CANVAS_WIDTH } from './types.js';
import type { Context2DLike } from './types.js';
import type { PetNamePosition } from '../types.js';

/**
 * Personalization-text placement (docs/05 §7) — ported from renderPetName.js. Four per-cutout
 * vertical offsets in 1200-space, centered X, Mitr 400 auto-fit 68→30 within 40% width, theme
 * color.
 *
 * DETERMINISM (docs/05 §7 caveat): the store measures BEFORE its font await — measurement could
 * run on a fallback font. The port is synchronous and requires the caller to have Mitr loaded
 * before calling (designer preloads it; the golden harness registers it). Goldens anchor to the
 * fonts-loaded result.
 */

/** The four vertical offsets in 1200-space (renderPetName.js:5-10). Verbatim. */
export const PET_NAME_POSITIONS: Record<PetNamePosition, number> = {
  default: 160,
  upper: 130,
  top: 100,
  bottom: 320,
};

export const TEXT_MAX_FONT = 68; // renderPetName.js:23 (in 900-space)
export const TEXT_MIN_FONT = 30; // renderPetName.js:24
export const TEXT_BOX_WIDTH_FRACTION = 0.4; // renderPetName.js:25

export interface TextOptions {
  text: string;
  /** Shopper override ("customPetNamePosition"). Wins over the frame hint. */
  customPosition?: PetNamePosition;
  /** The per-cutout hint ("selectedFrame.petNamePosition" / wire pet_name_position). */
  framePosition?: PetNamePosition;
  /** Cutout theme — wire lowercase; the store's 'Dark' check maps to 'dark' here (docs/08 §5). */
  theme?: 'light' | 'dark';
  /** Explicit override ("customPetNameColor"). */
  customColor?: string;
}

export interface TextPlacement {
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export function placePersonalizationText(
  ctx: Context2DLike,
  canvas: { width: number; height: number },
  options: TextOptions,
): TextPlacement {
  // Offset resolution (renderPetName.js:12-17): custom wins; else frame hint; else default 160.
  const originalOffsetY = options.customPosition
    ? PET_NAME_POSITIONS[options.customPosition]
    : (PET_NAME_POSITIONS[options.framePosition ?? 'default'] ?? 160);
  const textY = (originalOffsetY / CANVAS_HEIGHT) * canvas.height; // :18
  const textX = canvas.width / 2; // :20

  const maxFontSize = TEXT_MAX_FONT * (canvas.width / CANVAS_WIDTH); // :23
  const minFontSize = TEXT_MIN_FONT * (canvas.width / CANVAS_WIDTH); // :24
  const boundingBoxWidth = canvas.width * TEXT_BOX_WIDTH_FRACTION; // :25

  ctx.textAlign = 'center'; // :27
  const color = options.customColor ?? (options.theme === 'dark' ? 'white' : 'black'); // :28-32
  ctx.fillStyle = color;

  // Auto-fit (:34-40) — VERBATIM, including the store quirk: if nothing fits, the loop exits at
  // minFontSize − 1 and the text renders at that size.
  let fontSize = maxFontSize;
  while (fontSize >= minFontSize) {
    ctx.font = `400 ${fontSize}px Mitr`;
    if (ctx.measureText(options.text).width <= boundingBoxWidth) break;
    fontSize -= 1;
  }

  ctx.font = `400 ${fontSize}px Mitr`; // :45
  ctx.fillText(options.text, textX, textY); // :46
  return { x: textX, y: textY, fontSize, color };
}
