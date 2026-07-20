import { renderComposite, getContext } from './render.js';
import type { TextOptions } from './text.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './types.js';
import type { CanvasLike, EditorImage, ExportResult } from './types.js';
import type { LabelZone } from '../types.js';

/**
 * Export (docs/05 §8): three artifacts from one deterministic render.
 * 1. print   — the 900×1200 composite, staticBg EXCLUDED (saveCanvas.js:24 sets it null first).
 * 2. source  — the untouched original upload.
 * 3. display — product-mockup preview: print composite drawn into the variant's label_zone on the
 *              catalog image (docs/05 §8.1.3). Falls back to the print composite for no-zone
 *              products. Backs `previewUrl`; never uploaded (GP-08).
 * Plus the low-res flag (Charter D.8 adapted to store space, where edit == print space):
 * the mapping upscales the source beyond 105% of its native pixels.
 */

/** The environment seam: canvas creation + PNG encoding are injected (docs/01 §6 — no DOM here). */
export interface EngineEnv {
  createCanvas(width: number, height: number): CanvasLike;
  /** Full-quality PNG (store: canvas.toBlob(..., 'image/png'); API path passes quality 1.0). */
  toBlob(canvas: CanvasLike): Promise<Blob>;
}

export interface ExportInput {
  env: EngineEnv;
  /** MVP: the single placed photo (docs/05 §1 scope note). */
  image: EditorImage;
  /** The photo drawable + its native pixel dimensions. */
  photo: unknown;
  photoNatural: { width: number; height: number };
  /** The cutout PNG drawable. */
  cutout: unknown;
  text?: TextOptions | null;
  /** The untouched original upload — passed through as the `source` artifact. */
  source: Blob;
  /** Product mockup (catalog_image) + the variant's normalized label_zone, for the display composite. */
  mockup?: { drawable: unknown; width: number; height: number } | null;
  labelZone?: LabelZone | null;
}

/**
 * Low-res flag (Charter D.8): drawn size in print space vs native pixels. Store space means
 * drawn = fitted box × scale; no zone mapping involved (docs/05 §8.2).
 */
export function computeLowRes(
  image: Pick<EditorImage, 'width' | 'height' | 'scale'>,
  natural: { width: number; height: number },
): boolean {
  return (
    image.width * image.scale > 1.05 * natural.width ||
    image.height * image.scale > 1.05 * natural.height
  );
}

export async function exportArtifacts(input: ExportInput): Promise<ExportResult> {
  const { env } = input;

  // 1. Print composite — 900×1200, NO staticBg (docs/05 §8), not dragging, text included.
  const printCanvas = env.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  renderComposite(printCanvas, {
    images: [input.image],
    resolveDrawable: () => input.photo,
    cutout: input.cutout,
    text: input.text ?? null,
  });
  const print = await env.toBlob(printCanvas);

  // 3. Display composite — mockup with the print composite placed in label_zone (docs/05 §8.1.3).
  let display: Blob;
  if (input.mockup && input.labelZone) {
    const { mockup, labelZone } = { mockup: input.mockup, labelZone: input.labelZone };
    const displayCanvas = env.createCanvas(mockup.width, mockup.height);
    const ctx = getContext(displayCanvas);
    ctx.drawImage(mockup.drawable, 0, 0, mockup.width, mockup.height);
    ctx.drawImage(
      printCanvas,
      labelZone.x * mockup.width,
      labelZone.y * mockup.height,
      labelZone.width * mockup.width,
      labelZone.height * mockup.height,
    );
    display = await env.toBlob(displayCanvas);
  } else {
    // No-zone product (labelZone null) or no mockup: the bare print composite is the preview.
    display = print;
  }

  return {
    print,
    display,
    source: input.source,
    lowRes: computeLowRes(input.image, input.photoNatural),
  };
}
