// Golden BASELINE generator (docs/06 §3). Run MANUALLY to (re)freeze expected outputs — the loop
// never regenerates baselines to make a test pass (AGENTS.md §0.4).
//
// Baselines come from the STORE's own render code executed headless — NOT from src/cutout-engine —
// so the port is validated against the reference implementation, not against itself:
//   - ../treatink/web/src/components/customizer/functions/canvasRenderer.js  (drawCanvas)
//   - ../treatink/web/src/components/customizer/functions/renderPetName.js   (text)
// bundled on the fly with esbuild (the store uses extensionless ESM imports Vite resolves),
// rendered onto @napi-rs/canvas with Mitr registered BEFORE the text fit loop (docs/05 §7 caveat:
// the store measures pre-font-load; goldens anchor to the fonts-loaded result).
//
// document.fonts is shimmed (renderPetName awaits document.fonts.load/ready only). drawCanvas is
// called with includePetName:false and renderPetName is then awaited directly — the same draw
// sequence (text last), but properly awaited (the store fire-and-forgets it inside drawCanvas).
//
// Inputs: test/golden/cases.json (hand-computed transforms) + fixtures/photos + fixtures/cutouts.
// Output: test/golden/expected/<case>.png  (frozen; commit with a reviewed math explanation only).
import { GlobalFonts, createCanvas, loadImage } from '@napi-rs/canvas';
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STORE = join(HERE, '../../../treatink/web/src/components/customizer/functions');

// ── bundle the store renderer (extensionless ESM → one importable module) ──
const bundle = await build({
  entryPoints: [join(STORE, 'canvasRenderer.js')],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;

// renderPetName touches only document.fonts — shim it (no jsdom needed).
globalThis.document = {
  fonts: { load: async () => [], ready: Promise.resolve() },
};

const { drawCanvas } = await import(moduleUrl);
// renderPetName is not re-exported by canvasRenderer — bundle it separately.
const petNameBundle = await build({
  entryPoints: [join(STORE, 'renderPetName.js')],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { renderPetName } = await import(
  `data:text/javascript;base64,${Buffer.from(petNameBundle.outputFiles[0].text).toString('base64')}`
);

GlobalFonts.registerFromPath(join(HERE, 'fixtures/fonts/Mitr-Regular.ttf'), 'Mitr');

const { cases } = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
mkdirSync(join(HERE, 'expected'), { recursive: true });

for (const c of cases) {
  const photo = await loadImage(join(HERE, 'fixtures/photos', `${c.photo}.png`));
  const cutout = await loadImage(join(HERE, '../../fixtures/cutouts', `${c.cutout}.png`));
  const canvas = createCanvas(900, 1200);
  const image = { id: 'p', ...c.image };

  drawCanvas({
    canvas,
    images: [image],
    staticBg: null,
    frameImage: cutout,
    imageCache: { current: new Map([['p', photo]]) },
    selectedFrame: null,
    includePetName: false,
    petName: '',
    isDragging: false,
  });

  if (c.text) {
    // Store form: selectedFrame.theme is capitalized ('Dark'/'Light'); wire form is lowercase.
    const selectedFrame = {
      petNamePosition: c.text.framePosition,
      theme: c.theme === 'dark' ? 'Dark' : 'Light',
    };
    await renderPetName(
      canvas.getContext('2d'),
      canvas,
      selectedFrame,
      c.text.value,
      null,
      c.text.customPosition ?? null,
    );
  }

  writeFileSync(join(HERE, 'expected', `${c.name}.png`), canvas.toBuffer('image/png'));
  console.log(`expected/${c.name}.png`);
}
console.log(`\n${cases.length} baselines frozen from the store renderer.`);
