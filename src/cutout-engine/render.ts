import { placePersonalizationText } from './text.js';
import type { TextOptions } from './text.js';
import type { CanvasLike, Context2DLike, EditorImage } from './types.js';

/**
 * Compositing (docs/05 §6) — ported from canvasRenderer.js drawCanvas. Draw order: clear →
 * optional staticBg (PREVIEW ONLY — never in export, docs/05 §8) → each photo scaled about its
 * center → the cutout PNG full-canvas ON TOP (its transparency IS the mask) → text last.
 */

export interface CompositeInput {
  images: readonly EditorImage[];
  /** imageCache.current.get equivalent — resolves an image id to its drawable. */
  resolveDrawable: (id: string) => unknown;
  /** Preview-only background layer (canvasRenderer.js:21-23). Excluded from export. */
  staticBg?: unknown;
  /** The cutout PNG ("frameImage"), drawn last at full canvas size. */
  cutout?: unknown;
  /** Dims the cutout to 0.6 alpha while dragging (canvasRenderer.js:40) — preview affordance. */
  isDragging?: boolean;
  /** Personalization text ("includePetName" + petName), drawn last (canvasRenderer.js:46-48). */
  text?: TextOptions | null;
}

export function renderComposite(canvas: CanvasLike, input: CompositeInput): void {
  const ctx = getContext(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height); // canvasRenderer.js:18

  if (input.staticBg) {
    ctx.drawImage(input.staticBg, 0, 0, canvas.width, canvas.height); // :21-23
  }

  for (const img of input.images) {
    const drawable = input.resolveDrawable(img.id);
    if (!drawable) continue; // :28 — missing cache entry is skipped, not an error
    ctx.save(); // :29-34
    ctx.translate(img.x + img.width / 2, img.y + img.height / 2);
    ctx.rotate((img.rotation * Math.PI) / 180);
    ctx.scale(img.scale, img.scale);
    ctx.drawImage(drawable, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();
  }

  if (input.cutout) {
    ctx.globalAlpha = input.isDragging ? 0.6 : 1.0; // :40
    ctx.drawImage(input.cutout, 0, 0, canvas.width, canvas.height); // :41
    ctx.globalAlpha = 1.0;
  }

  if (input.text && input.text.text !== '') {
    placePersonalizationText(ctx, canvas, input.text); // :46-48, text is always last
  }
}

export function getContext(canvas: CanvasLike): Context2DLike {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('cutout-engine: injected canvas has no 2d context');
  }
  return ctx;
}
