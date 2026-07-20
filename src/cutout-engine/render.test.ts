import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { computeLowRes, exportArtifacts, type EngineEnv } from './export.js';
import { computeInitialFit } from './geometry.js';
import { renderComposite } from './render.js';
import { placePersonalizationText } from './text.js';
import type { CanvasLike, Context2DLike, EditorImage } from './types.js';

// P1-T10: composite order (bg → photo about center → cutout on top → text last), text placement
// per position with the store's auto-fit (incl. the min−1 quirk), export artifacts + lowRes.
// Canvas is injected (@napi-rs/canvas) — the engine itself has no DOM.

const env: EngineEnv = {
  createCanvas: (w, h) => createCanvas(w, h) as unknown as CanvasLike,
  toBlob: (canvas) =>
    Promise.resolve(
      new Blob([new Uint8Array((canvas as unknown as Canvas).toBuffer('image/png'))], {
        type: 'image/png',
      }),
    ),
};

function solidCanvas(w: number, h: number, color: string) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** A 900×1200 green cutout with a transparent rectangular opening. */
function cutoutWithOpening() {
  const c = solidCanvas(900, 1200, '#00ff00');
  c.getContext('2d').clearRect(300, 400, 300, 400);
  return c;
}

function pixelAt(canvas: Canvas, x: number, y: number) {
  const [r, g, b, a] = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
  return { r, g, b, a };
}

const IMG = (over: Partial<EditorImage> = {}): EditorImage => ({
  id: 'p',
  x: 0,
  y: 0,
  width: 900,
  height: 1200,
  rotation: 0,
  scale: 1,
  maxScale: 2,
  ...over,
});

describe('renderComposite (docs/05 §6, canvasRenderer.js)', () => {
  it('photo shows through the cutout opening; cutout covers elsewhere', () => {
    const canvas = createCanvas(900, 1200);
    renderComposite(canvas as unknown as CanvasLike, {
      images: [IMG()],
      resolveDrawable: () => solidCanvas(100, 100, '#ff0000'),
      cutout: cutoutWithOpening(),
    });
    expect(pixelAt(canvas, 450, 600)).toMatchObject({ r: 255, g: 0, b: 0, a: 255 }); // opening → photo
    expect(pixelAt(canvas, 100, 100)).toMatchObject({ r: 0, g: 255, b: 0, a: 255 }); // frame on top
  });

  it('scale applies about the box center (canvasRenderer.js:30-33)', () => {
    const canvas = createCanvas(900, 1200);
    renderComposite(canvas as unknown as CanvasLike, {
      images: [IMG({ scale: 0.5 })],
      resolveDrawable: () => solidCanvas(100, 100, '#ff0000'),
    });
    // scaled box = (225,300)–(675,900)
    expect(pixelAt(canvas, 450, 600).r).toBe(255); // inside
    expect(pixelAt(canvas, 100, 100).a).toBe(0); // outside → untouched
    expect(pixelAt(canvas, 224, 600).a).toBe(0); // just left of the box
    expect(pixelAt(canvas, 226, 600).r).toBe(255); // just inside
  });

  it('staticBg draws under the photo (preview layer)', () => {
    const canvas = createCanvas(900, 1200);
    renderComposite(canvas as unknown as CanvasLike, {
      images: [IMG({ scale: 0.5 })],
      resolveDrawable: () => solidCanvas(100, 100, '#ff0000'),
      staticBg: solidCanvas(10, 10, '#0000ff'),
    });
    expect(pixelAt(canvas, 100, 100)).toMatchObject({ r: 0, g: 0, b: 255 }); // bg where photo is not
    expect(pixelAt(canvas, 450, 600).r).toBe(255); // photo over bg
  });

  it('missing drawable is skipped, not an error (canvasRenderer.js:28)', () => {
    const canvas = createCanvas(900, 1200);
    expect(() =>
      renderComposite(canvas as unknown as CanvasLike, {
        images: [IMG()],
        resolveDrawable: () => undefined,
      }),
    ).not.toThrow();
    expect(pixelAt(canvas, 450, 600).a).toBe(0);
  });
});

describe('placePersonalizationText (docs/05 §7, renderPetName.js)', () => {
  /** Mock ctx: measureText width = chars × fontSize × 0.6; records calls. */
  function mockCtx() {
    let fontSize = 0;
    const calls: { fillText?: { text: string; x: number; y: number }; fonts: string[] } = {
      fonts: [],
    };
    const ctx: Context2DLike = {
      save() {},
      restore() {},
      clearRect() {},
      translate() {},
      rotate() {},
      scale() {},
      drawImage() {},
      globalAlpha: 1,
      textAlign: 'left',
      fillStyle: '',
      set font(value: string) {
        calls.fonts.push(value);
        fontSize = parseFloat(/ ([\d.]+)px /.exec(value)![1]!);
      },
      get font() {
        return calls.fonts.at(-1) ?? '';
      },
      measureText(text: string) {
        return { width: text.length * fontSize * 0.6 };
      },
      fillText(text: string, x: number, y: number) {
        calls.fillText = { text, x, y };
      },
    };
    return { ctx, calls };
  }
  const CANVAS = { width: 900, height: 1200 };

  it('places each position at its verbatim offset (160/130/100/320), centered X', () => {
    for (const [position, offset] of [
      ['default', 160],
      ['upper', 130],
      ['top', 100],
      ['bottom', 320],
    ] as const) {
      const { ctx } = mockCtx();
      const placement = placePersonalizationText(ctx, CANVAS, {
        text: 'Milo',
        framePosition: position,
      });
      expect(placement.y).toBe(offset);
      expect(placement.x).toBe(450);
    }
  });

  it('customPosition beats the frame hint; missing hint falls back to default', () => {
    const { ctx } = mockCtx();
    expect(
      placePersonalizationText(ctx, CANVAS, {
        text: 'Milo',
        framePosition: 'top',
        customPosition: 'bottom',
      }).y,
    ).toBe(320);
    expect(placePersonalizationText(mockCtx().ctx, CANVAS, { text: 'Milo' }).y).toBe(160);
  });

  it('short text keeps maxFontSize 68', () => {
    const { ctx, calls } = mockCtx();
    // 'Milo': 4 × 68 × 0.6 = 163.2 ≤ 360 → fits immediately
    const placement = placePersonalizationText(ctx, CANVAS, { text: 'Milo' });
    expect(placement.fontSize).toBe(68);
    expect(calls.fillText).toMatchObject({ text: 'Milo', x: 450, y: 160 });
  });

  it('long text shrinks until it fits 40% width', () => {
    const { ctx } = mockCtx();
    // 15 chars: 15 × f × 0.6 ≤ 360 → f ≤ 40 → first fitting integer stepping down from 68 is 40
    const placement = placePersonalizationText(ctx, CANVAS, { text: 'FifteenCharsAB!' });
    expect(placement.fontSize).toBe(40);
  });

  it('reproduces the store quirk: nothing fits → renders at minFontSize − 1', () => {
    const { ctx, calls } = mockCtx();
    // 31 chars never fits at ≥30 → loop exits at 29 and the final font uses it (renderPetName.js:35-45)
    const placement = placePersonalizationText(ctx, CANVAS, {
      text: 'Maximiliano von Fluffington III',
    });
    expect(placement.fontSize).toBe(29);
    expect(calls.fonts.at(-1)).toBe('400 29px Mitr');
  });

  it('theme drives the color: dark → white, light → black, custom wins', () => {
    const c = { text: 'Milo' };
    expect(placePersonalizationText(mockCtx().ctx, CANVAS, { ...c, theme: 'dark' }).color).toBe(
      'white',
    );
    expect(placePersonalizationText(mockCtx().ctx, CANVAS, { ...c, theme: 'light' }).color).toBe(
      'black',
    );
    expect(
      placePersonalizationText(mockCtx().ctx, CANVAS, {
        ...c,
        theme: 'dark',
        customColor: '#123456',
      }).color,
    ).toBe('#123456');
  });
});

describe('exportArtifacts (docs/05 §8, Charter D.8)', () => {
  const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

  async function firstBytes(blob: Blob, n: number) {
    return [...new Uint8Array((await blob.arrayBuffer()).slice(0, n))];
  }

  const baseInput = (over: Partial<Parameters<typeof exportArtifacts>[0]> = {}) => ({
    env,
    image: { id: 'p', ...computeInitialFit(400, 300) },
    photo: solidCanvas(400, 300, '#ff0000'),
    photoNatural: { width: 400, height: 300 },
    cutout: cutoutWithOpening(),
    source: new Blob(['original-bytes'], { type: 'image/jpeg' }),
    ...over,
  });

  it('produces print (PNG), passthrough source, and the lowRes flag', async () => {
    const result = await exportArtifacts(baseInput());
    expect(await firstBytes(result.print, 4)).toEqual(PNG_MAGIC);
    expect(result.source.type).toBe('image/jpeg');
    // 400×300 upload fits to 1280×960 drawn at scale 1 → upscaled way past 105% → low-res
    expect(result.lowRes).toBe(true);
  });

  it('high-res photo → lowRes false', async () => {
    const result = await exportArtifacts(
      baseInput({ photoNatural: { width: 4000, height: 3000 } }),
    );
    expect(result.lowRes).toBe(false);
  });

  it('display composite places the print into the mockup label_zone', async () => {
    const result = await exportArtifacts(
      baseInput({
        mockup: { drawable: solidCanvas(1000, 1000, '#0000ff'), width: 1000, height: 1000 },
        labelZone: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      }),
    );
    const img = await loadImage(Buffer.from(await result.display.arrayBuffer()));
    expect(img.width).toBe(1000);
    expect(img.height).toBe(1000);
    const canvas = createCanvas(1000, 1000);
    canvas.getContext('2d').drawImage(img, 0, 0);
    expect(pixelAt(canvas, 100, 100)).toMatchObject({ r: 0, g: 0, b: 255 }); // mockup outside zone
    // zone rect is (300,300)–(700,700); its center holds the print composite's opening → red photo
    expect(pixelAt(canvas, 500, 500).r).toBeGreaterThan(200);
    expect(pixelAt(canvas, 500, 500).b).toBe(0);
  });

  it('no mockup or null zone → display falls back to the print composite', async () => {
    const result = await exportArtifacts(baseInput({ mockup: null, labelZone: null }));
    expect(result.display).toBe(result.print);
  });

  it('computeLowRes boundary: exactly 105% is NOT low-res', () => {
    expect(computeLowRes({ width: 420, height: 315, scale: 1 }, { width: 400, height: 300 })).toBe(
      false,
    );
    expect(
      computeLowRes({ width: 420.1, height: 315, scale: 1 }, { width: 400, height: 300 }),
    ).toBe(true);
  });
});
