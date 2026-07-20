// Golden BASELINE generator (docs/06 §3). Run MANUALLY to (re)freeze expected outputs — the loop
// never regenerates baselines to make a test pass (AGENTS.md §0.4). Baselines come from the STORE's
// own render code executed headless (jsdom + @napi-rs/canvas, Mitr bundled), NOT from src/cutout-engine.
//
// Procedure (implemented in P1-T11):
//   1. Load the fixture matrix: test/golden/fixtures/*  (photo, cutout PNG, transform) cases —
//      portrait/landscape/square, 4 pet_name_position values, low-res, scale 1/mid/max, off-center pan.
//   2. For each case, render via a headless port of the store's drawCanvas + renderPetName
//      (../treatink/web/src/components/customizer/functions/{canvasRenderer,renderPetName}.js).
//      Ensure Mitr is loaded BEFORE the text auto-fit loop (docs/05 §7 caveat).
//   3. Emit the composite PNG + derived numbers (baseWidth/Height, maxScale, x/y, textOffsetY, lowRes)
//      to test/golden/expected/.
//   4. Also commit hand-computed numeric anchors (docs/05 §3/§7 formulas) — exact for integers, 1e-6 for floats.
//
// Tolerance for the port comparison (docs/06 §3): ≤0.1% of pixels differing by >2/255 per channel.

throw new Error('NOT_IMPLEMENTED: golden baseline generator (P1-T11). See procedure above.');
