# 05 · Engine Reference — ported from the real store code

**Authoritative source for all customizer math, rendering, and logic.** Every number and rule here
is cited to the actual `treatink` store customizer. Owner decision (2026-07-20): *"use my current
math in treatink repo as guide for the customizer rules and logic … all calculation and logic can
be inherited from here."* Where the Charter's **Appendix D** disagrees with this doc, **this doc
wins** (see §9 for the specific conflicts).

All paths below are relative to the store repo at **`../treatink/web/src/`**.

## 0. The model in one paragraph

Editing happens **directly in a fixed 900 × 1200 canvas** — the same pixels that get printed. The
uploaded photo(s) are drawn into that canvas; the selected cutout PNG (the "frame") is drawn **on
top** at full canvas size; wherever the frame is transparent, the photo shows through; optional
personalization text is drawn last at a per-cutout vertical position. **There is no separate mockup
"zone," no zone→print remapping, and no alpha-mask geometry** — the frame PNG's own transparency is
the mask, at runtime, for free. The print composite is literally `canvas.toBlob()`.

> This is dramatically simpler than Charter Appendix D (which imports the Shopify prototype's
> zone-clamped model). The store model is the target.

## 1. Constants (`config/config.js`)

| Constant | Value | Source |
|---|---|---|
| `CANVAS_WIDTH` | **900** | `config/config.js:6` |
| `CANVAS_HEIGHT` | **1200** | `config/config.js:7` |
| `CUSTOMIZER_MAX_IMAGES_COUNT` | **3** | `config/config.js:5` |
| `MAX_CANVAS_COVERAGE` | **1.3** (130%) | `hooks/useFileHandlers.js:26` |

MVP scope note (Charter §2): the Charter narrows to **single photo** and **no rotation**. The store
supports up to 3 photos and rotation. The **math for each still ports from here** — MVP simply
exercises the single-photo, rotation-0 path. Keep the engine general enough that enabling
multi-photo/rotation later is not a rewrite, but the designer UI in MVP exposes one photo, no rotate
(see §9 and `phases/02-designer.md`).

## 2. Coordinate space & the image object

All editing is in **canvas space** (900 × 1200). The on-screen canvas is a uniform scaling of it;
pointer coordinates are converted before use:

```
scaleX = CANVAS_WIDTH  / canvasRect.width      // pointerHandlers.js:9,39
scaleY = CANVAS_HEIGHT / canvasRect.height
mouseX = (clientX - rect.left) * scaleX
mouseY = (clientY - rect.top ) * scaleY
```

An uploaded image is this object (created in `hooks/useFileHandlers.js`):

```ts
interface EditorImage {
  id: string;          // crypto.randomUUID()
  x: number;           // top-left X in canvas space (pre-scale box)
  y: number;           // top-left Y in canvas space
  width: number;       // fitted base width  (see §3)
  height: number;      // fitted base height
  rotation: number;    // degrees; 0 in MVP
  scale: number;       // multiplier about the box center; starts 1.0
  maxScale: number;    // upper zoom bound (see §3)
}
```

`width/height` are the **fitted display box** (not the photo's natural pixels). `scale` multiplies
that box about its center. This differs from Appendix D.3 (which uses natural-pixel top-left +
absolute natural multiplier) — **use the store model** (§9).

## 3. Initial fit on upload (`hooks/useFileHandlers.js:60-93`)

For a fresh upload (no restored properties):

```
aspectRatio = img.naturalWidth / img.naturalHeight

if aspectRatio >= 1:                      // landscape / square
    baseHeight = CANVAS_HEIGHT * 0.8      // 960
    baseWidth  = baseHeight * aspectRatio
else:                                     // portrait
    baseWidth  = CANVAS_WIDTH             // 900
    baseHeight = baseWidth / aspectRatio

initialScale = 1.0

maxScale = round( max( (CANVAS_WIDTH  * 1.3) / baseWidth,
                       (CANVAS_HEIGHT * 1.3) / baseHeight ) * 10 ) / 10   // 1-decimal

position = { x: 0.5, y: 0.61 }            // fractional placement anchor
x = CANVAS_WIDTH  * position.x - baseWidth  / 2     // horizontally centered
y = CANVAS_HEIGHT * position.y - baseHeight / 2     // centered on 61% height
rotation = 0
```

Guards: reject non-images and `image/svg+xml` (`:19`); reject upload if already at
`CUSTOMIZER_MAX_IMAGES_COUNT` (`:21-24`).

**Restore path** (`:37-52`): when re-opening with saved `customProperties`, take `x,y,width,height,
rotation,scale,maxScale` from the saved metadata, with fallbacks
(`width || CANVAS_WIDTH*0.5`, `height` from aspect, `scale || 1.0`, `maxScale || 5`, `x||0`, `y||0` —
the store uses `||`, not `??`, so a saved `0` for `x`/`y` still coalesces to `0` here but any other
falsy value would fall back; reproduce `||`). The SDK's
draft re-open (`docs` persistence, Charter §9) reproduces this.

## 4. Drag / pan (`functions/pointerHandlers.js`)

- **Hit test** (`:16-29`): iterate images top-most first. Scaled box:
  `scaledWidth = width*scale`, `scaledHeight = height*scale`, and because scale is about center,
  `offsetX = x + (width - scaledWidth)/2`, `offsetY = y + (height - scaledHeight)/2`. Hit if
  `mouse` is inside `[offsetX, offsetX+scaledWidth] × [offsetY, offsetY+scaledHeight]`.
- **Drag start** (`:25`): `dragStart = { x:(mouseX - img.x)/img.scale, y:(mouseY - img.y)/img.scale }`.
- **Drag move** (`:75-81`): `x = mouseX - dragStart.x*scale`, `y = mouseY - dragStart.y*scale`.
- **No clamping.** Panning is freeform; the photo may leave the visible area. (Contrast Appendix
  D.5's 15%-overlap zone clamp — **not** used; §9.)

## 5. Zoom (`functions/pointerHandlers.js:42-64` + slider in components)

- **Pinch** (touch, 2 fingers): `scaleFactor = currentDistance/initialDistance`;
  `newScale = initialScale * scaleFactor`; clamp `newScale = max(0.5, min(maxScale, newScale))`
  (`:59-60`). `initialDistance/initialScale` captured on first 2-finger frame (`:50-53`).
- **Slider/buttons** (`DesktopCustomizer.jsx:156-159`, mobile equivalents): slider `min = 0.5`,
  `max = maxScale`, `step = 0.1`, value = `scale`. **Note:** the tooltip *fill-ratio* math uses
  `(scale - 0.4)/(maxScale - 0.4)` (`:144-147`) — the `0.4` there is a cosmetic fill anchor only; the
  real clamp floor is **0.5** everywhere (slider `min`, pinch clamp). Port the floor as **0.5**.
- Scale is applied about the box center (see draw, §6). There is **no** center-of-zone re-anchor
  (contrast Appendix D.6; §9).
- MVP designer uses **buttons/slider** (Charter §7.2). Pinch is deferred (Charter §2) but the clamp
  math is the same and ports from here.

## 6. Rendering / compositing (`functions/canvasRenderer.js`)

Draw order per frame (`drawCanvas`):

```
ctx.clearRect(0,0,w,h)
if staticBg:  ctx.drawImage(staticBg, 0,0, w,h)          // optional background layer
for each image (in array order):                          // :26-36
    ctx.save()
    ctx.translate(img.x + img.width/2, img.y + img.height/2)
    ctx.rotate(img.rotation * Math.PI/180)
    ctx.scale(img.scale, img.scale)
    ctx.drawImage(el, -img.width/2, -img.height/2, img.width, img.height)
    ctx.restore()
if frameImage:                                            // the cutout PNG, ON TOP
    ctx.globalAlpha = isDragging ? 0.6 : 1.0              // dim while dragging for visibility
    ctx.drawImage(frameImage, 0,0, w,h)
    ctx.globalAlpha = 1.0
if includePetName:  renderPetName(...)                    // text last
```

Key facts: photo is drawn **scaled about its center**; the cutout PNG is drawn **last, full-canvas**,
and its transparency reveals the photo — **this is the entire "cutout" mechanism**. The 0.6 dim
while dragging is a UX affordance, not part of the exported result.

## 7. Personalization text (`functions/renderPetName.js`)

```
petNamePositions = { default: 160, upper: 130, top: 100, bottom: 320 }   // :5-10 (in 1200-space)
originalOffsetY  = customPetNamePosition
                 ? petNamePositions[customPetNamePosition]
                 : petNamePositions[selectedFrame?.petNamePosition ?? 'default'] ?? 160
textOffsetY = (originalOffsetY / CANVAS_HEIGHT) * canvas.height          // scale to actual canvas
textX = canvas.width / 2                                                 // centered
maxFontSize = 68 * (canvas.width / CANVAS_WIDTH)                         // :23
minFontSize = 30 * (canvas.width / CANVAS_WIDTH)
boundingBoxWidth = canvas.width * 0.4                                    // shrink to fit 40% width
font family = 'Mitr', weight 400
color = customPetNameColor ?? (selectedFrame.theme === 'Dark' ? 'white' : 'black')   // :28-32
```

Auto-fit: start at `maxFontSize`, decrement by 1 until `measureText(name).width <= boundingBoxWidth`
or `minFontSize` reached (`:34-40`). **Faithful-port caveat:** in the store the auto-fit
`measureText` loop (`:34-40`) runs **before** the `await document.fonts.load(...)`/`document.fonts.
ready` (`:42-43`); only the final `fillText` (`:46`) is after the await. So measurement can happen on
a not-yet-loaded font. For deterministic golden output (Node harness with Mitr bundled) **ensure Mitr
is loaded before the fit loop** and record any resulting size delta from the store — this is one place
the SDK legitimately improves on the store; anchor the golden to the fonts-loaded result.

The per-cutout position (`default|upper|top|bottom`) is exactly the Charter's
`personalization_text_position` hint (Charter §12) — this is why "pet name position is set per
cutout so it doesn't land on the image/cutout part." Port these four offsets **verbatim**.

## 8. Save / export

- **Local composite** (`functions/saveCanvas.js:28-66`): `canvas.toBlob(..., 'image/png')` (no
  quality arg; the API path `saveCanvasAPI.js:38` passes `1.0`) → the print composite. **Critical:
  `setStaticBg(null)` runs first (`:24`)** — the optional `staticBg` background layer
  (`canvasRenderer.js:21-23`, `/images/background.png`) is a **preview-only** element and is
  **excluded from the exported print composite**. A port must strip any preview background before
  export. Metadata persisted: `imageMetadata = { x, y, scale, width, height, maxScale, rotation }`
  (`:45-53`) — note **`x` and `y` are rounded to 1 decimal** (`parseFloat(image.x.toFixed(1))`); plus
  `label_template` (frame name), `petName`, `petType`. *(Store persists the blob to IndexedDB; the
  SDK replaces this with upload-on-save + references-only — Charter §9, `docs/04`.)*
- **Additive rotation** (`customizerSlice.jsx:594-600`): `rotateImage` does `rotation += angle`
  (accumulates), and `duplicateImage` offsets a copy by `+40,+40` (`:19-21`) — MVP uses neither
  (single photo, rotation 0), but note the contracts if enabled later. The store does **no EXIF**
  orientation correction (`useFileHandlers.js:28-35`); EXIF is an SDK addition (§10).
- **API/iframe mode** (`functions/saveCanvasAPI.js`): posts `FormData` with `sessionUuid`,
  `canvasImage` (composite PNG, quality 1.0), `petType`, `petName`, `labelTemplate`, and
  `originalImage` (from IndexedDB) to `upload-customization-artwork`. This is prior art for the
  SDK's upload-on-save and shows a **session concept already exists** in the store backend even
  though the public API docs omit it (`docs/04` §2.2).

### 8.1 The artifacts the SDK produces (Charter §8.4) — and what `previewUrl` shows
The SDK's save pipeline produces three artifacts from the same deterministic render:
1. **Print composite** — the 900 × 1200 canvas (`toBlob`, staticBg excluded). Uploaded as the
   **`rendered`** asset. This is the file that gets printed.
2. **Source** — the untouched original upload. Uploaded as the **`source`** asset.
3. **Display composite (`previewUrl`)** — **RESOLVED (was a gray area):** a product-mockup preview,
   **not** the bare cutout canvas. Built in-browser by drawing the print composite into the variant's
   `catalog_image` (the product mockup) at the variant's **`label_zone`** rectangle (scaled to
   `zone_px = {x·Wm, y·Hm, width·Wm, height·Hm}`). This matches Charter D.8's display composite (the
   cart thumbnail shows the *product* with the label on it, as Riley's expects) and is why the SDK
   still carries `label_zone`. `previewUrl` is a **local object URL** of this composite (GP-08); it is
   never uploaded. Requires the mockup to be CORS-readable (`crossOrigin="anonymous"`).

### 8.2 Coordinate semantics of the persisted transform — RESOLVED (was gray area E6)
Under the store model, **editing space == print space == the 900 × 1200 canvas.** Therefore the
persisted transform (`image_metadata = {x, y, scale, rotation}`) is expressed **in 900 × 1200
print-canvas pixels** and is **self-contained for print re-rendering**: the server reproduces the
print composite by drawing the source photo at `(x, y)` scaled by `scale` (rotation) into the 900 ×
1200 canvas, then the cutout PNG on top — **no zone context is needed** for the print (this dissolves
Charter §8.3's "transform is not self-contained" concern, which only applied to the Appendix-D
mockup model). `label_zone` is carried **only** for the display composite (§8.1.3) and any
product-mockup rendering — not for the printed output. **Backend contract note (for the order body,
`docs/08` §7):** `image_metadata` = `{x, y, scale, rotation}` in **900 × 1200 canvas space**. Document
this so the platform re-renders identically at print time — the WYSIWYG guarantee (Charter §3, §8.1).

## 9. Store ⟷ Charter Appendix D conflicts (resolved: store wins)

| Topic | Charter Appendix D | **Store code (authoritative)** |
|---|---|---|
| Coordinate model | mockup-natural-pixel space + separate 900×1200 print space, linked at export | **single 900×1200 canvas**; edit == print space |
| Label zone | normalized `{x,y,w,h}` zone on a mockup; editing clamped to it | **no zone in the editor**; product `label_zone` is only for display placement on a product mockup, not for editing/clamping |
| Transform | `x,y` = photo top-left in natural px; `scale` = absolute multiplier on natural px | `x,y` = box top-left in canvas space; `scale` multiplies the **fitted box** about center |
| Initial fit | cover-fit `max(z.w/Wp, z.h/Hp)`, anchored zone top-left | 80% canvas height (landscape) / full width (portrait), centered at `(0.5, 0.61)`, `scale=1` |
| Pan clamp | 15%-overlap-per-axis zone clamp | **none** (freeform) |
| Zoom | `1–3×` cover-fit, center-of-zone re-anchor | `[0.5, maxScale]`, about box center; `maxScale` from 130% coverage |
| Rotation | none | **exists** (`rotation`, `rotateImage` reducer) — MVP keeps it at 0 |
| Photos | single | up to **3** — MVP exposes 1 |
| Export | zone→900×1200 remap with independent axis scales | canvas **is** 900×1200; composite = `toBlob()` |
| Opening/alpha geometry (D.7) | precomputed largest-safe-rectangle etc. | **not used at runtime**; frame PNG transparency is the mask directly |

**Implication for golden tests:** parity is defined against the **store behavior** reproduced by the
ported engine (its own deterministic snapshots), **not** against Appendix D or the absent Shopify
prototype. See `docs/06` §Golden tests. This is why the missing prototype does not block the build.

## 10. What the SDK adds on top of the faithful port
- **Upload-on-save + references-only storage** (Charter §8.4/§9) replaces IndexedDB blob storage.
- **Personalization-text as an opt-in toggle** with template-defined length limit and the four
  position offsets above.
- **HEIC/EXIF handling** on ingest (Charter §7.2/§16.9) — lazy chunk.
- **Engine purity**: the store logic lives in React components; the SDK extracts the *math* into a
  DOM-free `cutout-engine` module with canvas injected (`docs/01` §6). Same numbers, cleaner seams.
