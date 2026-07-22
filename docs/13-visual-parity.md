# 13 · Visual Parity Spec — the designer must look exactly like the store customizer

**Owner directive (2026-07-21):** the SDK designer's default look = the current `treatink.com`
customizer, **as rendered by `PetCustomizer.jsx` in API mode** — not a reinterpretation, not the
Charter §7.3 idealized palette. Everything below is extracted from the store source and is the
authoritative pixel contract for Phase 5 (`phases/05-visual-parity.md`). Where this doc and
`docs/design-reference.md` §3 disagree, **this doc wins** (design-reference carried the Charter
palette, which does not match the real site).

All store paths relative to `../treatink/web/`. The reference DOM is
`src/components/customizer/PetCustomizer.jsx` (the component actually rendered in API mode via
`APICustomizerWrapper.jsx`; `DesktopCustomizer.jsx`/`MobilePetCustomizer.jsx` are used elsewhere and
differ in details — do **not** port from them). The reference styles are
`PetCustomizer.scss`, `src/index.css` (palette + fonts), `src/App.scss` (utility classes),
`src/components/ui/Button.scss`, `FramesModal.scss`, `SearchField.scss`,
`src/components/ui/ModalWrapper.scss`, plus Tailwind utility classes inline in the JSX.

Scope deltas from the store (owner-confirmed 2026-07-21):

- **No pet-type selection** (Charter §2/§12 — subject selection deferred). The "Choose Your Pet"
  card is omitted entirely; the `not-selected` red-outline/shake affordance goes with it.
- **Rotation is IN scope** (owner veto of the earlier "rotation stays 0" MVP note, `docs/09`):
  rotate-left/right buttons (±15° additive, store `customizerSlice.jsx:594-600`) ship in the
  image-controls card. The engine already ports the math; this is UI wiring + coverage.
- **Zoom is slider-only** (store desktop has no −/+ buttons); the −/+ buttons are removed and the
  px-dimensions tooltip is added. Keyboard a11y = native range-input arrow keys.
- **The SDK modal keeps its own header bar** (Charter §7.1 chrome: title + ×). The store card
  renders below it; in the iframe integration that chrome came from the host modal.
- **Single photo** (Charter §2). No multi-image UI (no image count > 1, no duplicate).

## 1. Design tokens (exact store values)

Palette (`index.css:48-67`):

| Token (CSS var) | Value | Store var | Used for |
| --- | --- | --- | --- |
| `--tk-primary` | `#a99cdf` | `--purple` | dashed canvas border, chips border, selected chip/thumb, upload/browse buttons, slider thumb border, input focus |
| `--tk-primary-strong` | `#8c7ec2` | `--purple-darker` | slider track, purple-button hovers |
| `--tk-panel` | `#e2e6ff` | `--purple-light` | control-card background |
| `--tk-surface-alt` | `#F6F6FC` | `--purple-extra-light` | Browse-All modal surface + close button |
| `--tk-accent` | `#ffa518` | `--orange` | save button, pagination bullets, upload icon |
| `--tk-accent-hover` | `#dd9133` | `--orange-hover` | save button hover |
| `--tk-header-background` | `#F26B1D` (unchanged) | — | SDK modal header (SDK chrome, Charter §7.3) |
| `--tk-surface` | `#ffffff` | — | modal card, thumbs, inputs |
| `--tk-overlay-color` | `rgba(0,0,0,0.55)` (unchanged) | — | SDK overlay (store's nested modal uses 0.6) |

Radii (store utilities `App.scss:43-57`, `Button.scss`):

| Token | Value | Used for |
| --- | --- | --- |
| `--tk-radius` (`borderRadius`) | **20px** | modal card, canvas wrapper, control cards |
| `--tk-radius-button` | **15px** | filled buttons (save, upload picker) |
| `--tk-radius-control` | **10px** | chips, thumbs, text input, Browse-All button, mobile cards |

Shadows / misc:

- Card shadow: `0 4px 30px rgba(0,0,0,0.10)` (`App.scss .box-shadow`).
- Slider thumb shadow: `0 2px 4px rgba(0,0,0,0.2)`.
- Nested-modal shadow: `-2px 0px 10px rgba(0,0,0,0.2)`; overlay `rgba(0,0,0,0.6)`.
- Transitions: buttons `0.3s`; chips/thumbs/misc `0.2s`; collapsible height `0.3s ease`
  (`App.scss .collapsible-content`).

**Theming contract (ThemeConfig, `docs/10` §8 — additive, non-breaking):** existing keys keep their
meaning with NEW defaults (`primary: '#a99cdf'`, `accent: '#ffa518'`, `borderRadius: '20px'`). New
optional keys: `primaryStrong`, `panelBackground`, `accentHover`, `surfaceAlt`, `buttonRadius`,
`controlRadius`. Resolution rule: an explicit token wins; an omitted derived token is computed from
its base (`primaryStrong`/`panelBackground` from `primary`, `accentHover` from `accent`, radii by
`min()` step-down from `borderRadius`) via `color-mix()` with a static fallback — so a partner who
overrides only `primary`/`accent`/`borderRadius` still gets a coherent palette, while the untouched
defaults are the **exact store hexes**, not derived approximations.

## 2. Typography (`index.css`)

- Body/UI: `'Montserrat', system-ui, sans-serif` — 400; labels 500; buttons 600. The SDK must NOT
  fetch Montserrat (no third-party requests, `docs/design-reference` §4); the host stack degrades
  gracefully. Base text `#000`; secondary labels `#374151` (Tailwind `text-gray-700`).
- Headings (Browse-All title): `'Mitr'` (store: `h1..h5 { font-family:'Mitr' }`). Mitr-Regular is
  already bundled for the label engine; the UI may reuse it at weight 400–600.
- Paragraphs: 16px/24px, `margin-bottom: 20px` (global `p` rule — the upload prompt relies on it).

## 3. Layout — modal body IS the store card

Store structure (`PetCustomizer.jsx:337-676`):

```
tk-modal                      ← white card: radius 20, shadow 0 4px 30px rgba(0,0,0,.1)
  tk-header                   ← SDK chrome (unchanged contract)
  tk-body                     ← .customizer-container-inner equivalent:
                                 padding 40px (store p-10); display flex; row-reverse;
                                 justify-content space-between; align-items flex-start;
                                 gap 20px (<768px) / 40px (≥768px  — store gap-5 md:gap-10)
    tk-controls  (DOM first → renders RIGHT via row-reverse)   width 50%
    tk-preview   (DOM second → renders LEFT)                    width 50%
  ::after wave                ← decorative footer wave (store customizer-container:after):
                                 200px tall, bottom-anchored, z below content, hidden <700px;
                                 asset = wave.svg (614 B) inlined as data URI
```

- Modal width: `min(1180px, 94vw)` (store `contained-width` max 1180). Max-height 92vh; the body
  scrolls; the wave stays pinned to the modal bottom (position it on the modal, body above it).
- Canvas column (`customizer-content`) and controls column are **50% / 50%** (store SCSS
  `PetCustomizer.scss:171-198`), not the current 3:2 flex.
- **Mobile breakpoint = 700px** (store `@media(max-width:700px)`), replacing the SDK's 768 for
  layout stacking: column-reverse (canvas on top), padding 0, no card shadow, card radius kept by
  the modal (SDK stays full-screen <700px), control cards radius 10px, wave hidden. Tailwind `md:`
  gaps still flip at 768px — keep both breakpoints exactly as the store does.

## 4. Canvas area (left column) — the upload surface

Store: `PetCustomizer.jsx:606-666`, `PetCustomizer.scss:176-190`.

- Wrapper `tk-canvas-frame` (new class): `position:relative; width:100%; aspect-ratio:3/4;
  border:3px dashed var(--tk-primary); border-radius:20px; overflow:hidden; display:flex;
  align-items:center; justify-content:center; cursor:pointer` (`grabbing` while dragging).
- `canvas.tk-canvas` fills it: `width:100%; height:100%`, **no border of its own** (the dashed
  border moves from the canvas to the wrapper), transparent background (the store's staticBg
  `/images/background.png` 404s in production — there is no canvas background; do not invent one).
- Drag-drop + pointer handlers live on the **wrapper**; drop accepts files anywhere on the canvas.
  `dragover` must be prevented on the wrapper (store does).
- **Empty state** (no photo) — overlay inside the wrapper (`tk-upload-overlay`, replaces the
  `tk-dropzone` card in the controls column, which is REMOVED):
  - `position:absolute; inset:0; display:flex; flex-direction:column; align-items:center;
    justify-content:center;` then store override `top:unset; bottom:25%` — children max-width
    220px, centered text (`PetCustomizer.scss .upload-container`).
  - Children: upload icon (64×64, the store `icons/upload.svg` cloud+arrow inlined as SVG with
    `fill: currentColor; color: var(--tk-accent)`); prompt `<p>` 16px/24px black, two lines
    ("Drag your pet's photo here" / "and start personalizing!"), 20px bottom margin; picker button
    "Or Select Image" — **purple filled pill**: `background var(--tk-primary); color #fff;
    font-weight 600; padding 14px 24px; border-radius 15px; width fit-content; transition .3s`
    (store `Button.scss .default-btn.bg-secondary`; no hover shade is defined for the purple
    variant — don't add one). Hidden file input `accept="image/png, image/jpeg, image/webp"`
    (+ HEIC per SDK scope).
- Low-res warning (`tk-lowres`, SDK addition): keep, restyled to sit under the wrapper without
  breaking the store column rhythm.

## 5. Controls column (right) — the card stack

Container: `display:flex; flex-direction:column; gap:8px` (<768px) / `20px` (≥768px — store
`gap-2 md:gap-5`). Every card = `tk-card`: `background var(--tk-panel); padding 20px;
border-radius 20px` (10px <700px); labels centered, `user-select:none`, 500 weight `#374151`.

### 5.1 Image-controls card (`tk-image-controls`) — ONLY when a photo is present

Store `PetCustomizer.jsx:352-417`. Layout: `display:flex; align-items:center; gap:8px` — left
column (label + icon buttons), right the slider.

- Label "Image Controls" (copy key `imageControlsLabel`, new).
- Icon buttons (rotate-left, rotate-right, delete): `padding 12px; border-radius 4px;
  background none; hover background #f3f4f6` (Tailwind `hover:bg-gray-100`/`rounded`); lucide
  icons 20px inlined (`RotateCcw`, mirrored `RotateCcw`, `Trash`) with accessible labels + native
  `title` tooltips (the store's react-tooltip bubble is replicated by CSS `title`-less custom
  tooltip only if trivial; otherwise `title` suffices — visual parity target is the buttons).
  - Rotate: `rotation += ±15` additive (`customizerSlice.jsx:594-600`), re-render; transform
    carries rotation through save/draft/payload (already typed). Hit-testing stays axis-aligned
    (store behavior — do not "fix").
  - Delete: revoke object URL, clear photo/editor, disable slider, return to empty-state overlay.
- Slider block (`tk-slider`, store `.slider-input` `PetCustomizer.scss:309-429`):
  `display:flex; flex-direction:column; align-items:center; max-width 320px; position:relative;
  margin-bottom 45px` (room for the tooltip).
  - Tooltip (`tk-slider-tooltip`): absolute, `bottom:-50px; transform:translateX(-50%);
    left: ((scale − 0.4) / (maxScale − 0.4)) × 100%` (store fill-anchor math — cosmetic only, the
    clamp floor stays 0.5, `docs/05` §5); white bg, `box-shadow 0 0 10px rgba(0,0,0,.1)`,
    14px, `padding 6px 15px`, radius 8px, nowrap; content
    `${round(width×scale)} x ${round(height×scale)}px`.
  - Range input: appearance none, height 8px, radius 5px, transparent bg; WebKit track
    `background var(--tk-primary-strong)` 8px/5px; Moz track `#ddd` with `-moz-range-progress`
    `var(--tk-primary)`; thumb 18px white circle, `border 2px solid var(--tk-primary)`,
    thumb shadow above, `margin-top:-5px`, hover `scale(1.1)`; `min 0.5, max maxScale, step 0.1`.
    <700px: track 10px, thumb 23px, `margin-top:-6px`.
  - **No −/+ buttons.** `tk-zoom-in`/`tk-zoom-out` are removed from DOM, styles, and specs.

### 5.2 Pet-name card (`tk-text`)

Store `PetCustomizer.jsx:420-445`, `PetCustomizer.scss:220-238`.

- Centered column. Toggle row: native checkbox **16×16** (no `accent-color` override — the store
  ships the UA default) + label text (copy `personalizationTextLabel`, default "Include Pet Name
  on Label"), 500/#374151, 8px gap, pointer cursor.
- When checked: text input (`tk-text-input`): `width 100%; max-width 320px; padding 8px;
  font-size 16px; border-radius 10px; text-align center; background #fff; border none`
  (Tailwind preflight kills the UA border — reproduce that), `:focus { outline: 2px solid
  var(--tk-primary) }`; `maxLength` = template cap (fallback config, `docs/10` §5); placeholder
  copy `personalizationTextPlaceholder` default "Pet Name".

### 5.3 Cutout-browser card (`tk-cutouts`)

Store `PetCustomizer.jsx:499-587` + SCSS.

- Header row (whole row clickable, centered): label copy `cutoutsLabel` default **"Choose Your
  Background"** + chevron up/down 20px. Toggles a `tk-collapsible` wrapper
  (`overflow:hidden; transition height .3s ease` — measured height, store pattern). Default open.
- Category chips (`tk-chip`), centered wrap, gap 8px, margin-top 8px: **rounded 10px rectangles,
  NOT pills** — `font-size 11px; padding 4px 8px; border 2px solid var(--tk-primary); color #000;
  background transparent; transition .2s`; selected: `background var(--tk-primary); color #fff`.
  Categories from the dataset, displayed capitalized: Standard · Holidays · Birthdays · Occasions.
  Default category **Standard**. (No "Browse All" chip — Browse All is a button below.)
- Thumb pager (`tk-cutout-row`, replaces free-scroll row): store Swiper, `max-width 320px`,
  3 per view (`slide width calc(33.33% − 7px)`, 10px gaps), advance by page of 3, **pagination
  bullets** below (`tk-dots`): 10px circles `var(--tk-accent)` at 0.3 opacity; active 14px,
  opacity 1; clickable. Implement with CSS scroll-snap + a small controller (no Swiper dep).
- Thumb (`tk-cutout-thumb`): `aspect-ratio 3/4; border-radius 10px; overflow hidden;
  border 1px solid #fff; background url(background-grey.png) center/100%` (asset inlined,
  10.3 KB); selected: `border 2px solid var(--tk-primary)`; `user-select:none`.
  Layered content: **the shopper's photo behind the frame** — `img.tk-thumb-photo` absolute
  inset-0 cover z-0 (current photo object URL, when present), then `img.tk-thumb-frame` (the
  cutout PNG) relative z-10 cover. This is the store's live thumb preview
  (`PetCustomizer.jsx:553-565`).
- "Browse All" button (`tk-browse-all`): centered, margin-top 12px; `background var(--tk-primary);
  color #fff; font-weight 500; padding 10px 20px; border-radius 10px`.
- On open with no preselect: **auto-select the default cutout** (store preselects
  `artistic-frame-18`, category Standard — SDK equivalent: the fixture dataset's default, else the
  first Standard template) so the frame is visible on the canvas immediately, exactly like the
  store's empty state.

### 5.4 Save row

Store `PetCustomizer.jsx:589-602` + `Button.scss`.

- Full-width filled **orange** button (`tk-save-button`): `display:flex; justify-content:
  space-between; align-items:center; width 100%; padding 14px 24px; border-radius 15px;
  background var(--tk-accent); color #fff; font-weight 600; transition .3s;
  hover background var(--tk-accent-hover); disabled opacity .3` (store `[disabled]`), <700px
  padding 10px 15px. Content: label + lucide `ArrowRight` 30px inline SVG.
- Copy: `saveButton` default **"Save Customization"** (store API mode), `savingLabel` "Saving..."
  swaps the label while the pipeline runs (arrow hidden while saving, store behavior).
- Disabled until a photo exists (store: `images.length === 0`; SDK additionally requires a cutout,
  which auto-preselection satisfies).

## 6. Browse-All modal (`tk-frames-modal`) — nested overlay

Store `FramesModal.jsx` + `FramesModal.scss` + `ModalWrapper.scss` + `SearchField.scss`. Rendered
inside the SDK overlay (above the designer card), replacing the current inline `tk-cutout-grid`
expansion.

- Overlay: `position:absolute/fixed inset 0; background rgba(0,0,0,0.6);` centered; fade
  `opacity/visibility .3s`.
- Panel: width `min(100% − 40px, …)` with 20px vertical margins (store frames-modal overrides the
  516px base to 100%), `border-radius 12px; background var(--tk-surface-alt);
  box-shadow −2px 0 10px rgba(0,0,0,.2)`; content scrolls, `max-height calc(100vh − 40px)`;
  inner padding 16px.
- Close button: 40px circle, absolute `top −10px; right −15px`, `background var(--tk-surface-alt)`,
  purple ✕ (lucide `X`), shadow, hover: purple bg + white icon.
- Title: `h4`-styled "Browse All Backgrounds" — Mitr, 600, centered, 16px bottom margin
  (copy key `browseAllTitle`, new).
- Search (`tk-search`): centered, `max-width 384px; width 100%`; input `height 48px;
  padding 0 20px; background #fff; border 2px solid var(--tk-primary); border-radius 100px;
  outline none`; magnifier icon 20px absolute right 20px (inline SVG); filters templates by
  title/tags as you type; clear (✕) icon appears at left 20px when non-empty. Empty result:
  centered gray "No backgrounds found" (copy `noCutoutsFound`, new).
- Chips: same as §5.3 but `font-size 14px; padding 4px 12px`.
- Grid: `display:flex; flex-wrap:wrap; justify-content:center; gap 16px; max-height 60vh;
  overflow-y auto; padding-right 8px`; thumbs same layered structure as §5.3 at
  `width 270px` (≤1000px: 200px; ≤800px: 150px).
- Selecting a thumb selects the cutout and closes the modal (store behavior). Focus is trapped by
  the existing overlay trap; Escape closes the frames modal first, then the designer.

## 7. Bundled assets (no third-party requests — Charter §10.2)

| Asset | Source | Size | Ship as |
| --- | --- | --- | --- |
| Upload icon | `public/icons/upload.svg` | 1.9 KB | inline SVG, `currentColor` = `--tk-accent` |
| Wave footer | `public/images/wave.svg` | 614 B | CSS data URI on the modal `::after` |
| Thumb background | `public/images/background-grey.png` | 10.3 KB | CSS data URI (shared rule) |
| Icons: rotate ×2, trash, chevrons, arrow-right, ✕, magnifier | lucide paths | ~0.2 KB each | inline SVG |
| Mitr | already bundled (label engine) | — | reuse for the Browse-All title |

All go in the **designer chunk** (lazy), not the loader. Budget check (`docs/06` §2: chunk
≤ 150 KB gz) is a gate on every task.

## 8. Copy additions (`CopyStrings`, `docs/10` §8 — additive)

New keys with store defaults: `imageControlsLabel` "Image Controls" · `rotateLeftLabel` "Rotate
Left" · `rotateRightLabel` "Rotate Right" · `deleteImageLabel` "Delete Image" · `cutoutsLabel`
"Choose Your Background" · `browseAllTitle` "Browse All Backgrounds" · `searchPlaceholder`
"Search" · `noCutoutsFound` "No backgrounds found". Changed defaults: `uploadPrompt` → "Drag your
pet's photo here\nand start personalizing!" · `saveButton` → "Save Customization" (already) ·
`savingLabel` → "Saving...". Removed with the −/+ buttons: `zoomInLabel`/`zoomOutLabel` usage
moves to the slider's `zoomSliderLabel` only (keys stay in the type for compatibility; document).

## 9. Test impact map (update WITH each task — assertion intent preserved, selectors follow DOM)

| Spec | Impact |
| --- | --- |
| `designer-shell` | card geometry, 50/50 columns, wave, 700px stacking |
| `designer-theming` | NEW default hexes (`#a99cdf`/`#ffa518`/20px), new tokens, derivation rule |
| `designer-upload`, `designer-heic` | dropzone card → canvas overlay; picker button move |
| `designer-position` | −/+ buttons removed → slider-only; NEW rotate/delete coverage |
| `designer-text` | native checkbox, pill input styling hooks |
| `designer-cutouts` | chips (10px rect, no Browse-All chip), pager + dots, layered thumbs, auto-preselect, Browse-All modal |
| `designer-save-local`, `save-*`, `happy-path`, `draft-reopen` | save-button classes/labels; auto-preselect changes "no cutout" preconditions |
| `designer-a11y` | structure re-run; roles/labels preserved (dialog, range, checkbox, buttons) |
| `designer-lowres` | placement under the canvas wrapper |
| golden suite | UNCHANGED (engine untouched) + new rotation case (baseline from the store renderer via `gen-baseline.mjs`) |
| `size` | new inline assets — chunk budget must hold |

Never weaken an assertion to pass (`AGENTS.md` §0.4): selectors may change with the DOM; thresholds
and behavioral assertions may not.

## 10. Inherit vs improve — the engineering contract (owner directive, 2026-07-21)

The store customizer is the authority for **layout, feature set, and rendered look** — but parts of
its implementation are ad-hoc, and the owner has directed that technical details be brought to
industry level rather than ported verbatim. Rule of thumb: **port what the shopper sees; never port
how it's wired when the wiring is broken, dead, or inaccessible.** Every divergence is listed here
so "faithful" has an exact meaning; anything NOT listed is ported as-is.

### 10.1 Inherit exactly (the parity surface)

Palette, typography, geometry, spacing, radii, shadows, transitions (§1–§6); the feature set
(§ intro deltas); all engine math (`docs/05` — golden-tested, includes the store's axis-aligned
hit-test even for rotated photos: the store is ground truth for math per `README` priority order);
the rendered slider look; copy defaults; empty-state behavior; auto-preselected default cutout.

### 10.2 Improve (with the store defect cited)

| # | Store defect | SDK implementation |
| --- | --- | --- |
| I-01 | **Slider progress fill is dead code**: `PetCustomizer.scss:381-389` paints the fill via `input::before { width: var(--progress) }`, but `--progress` is set nowhere, and `::before` doesn't render on replaced elements anyway — Chrome shows a bare dark track while Firefox shows the intended purple fill via `-moz-range-progress` (`:369-373`). | Implement the **intended** fill cross-browser: track = `--tk-primary-strong`, filled portion = `--tk-primary`, via a background-gradient sized from the input value (standard technique). One consistent look in every engine. |
| I-02 | **Tooltip anchor drifts off the thumb**: `left: (scale−0.4)/(maxScale−0.4)` (`PetCustomizer.jsx:391-397`) uses a cosmetic 0.4 floor (real min is 0.5) and ignores thumb width, so the bubble misaligns at the ends. | Anchor to the true thumb center: `((value−0.5)/(max−0.5)) × (trackWidth − thumbWidth) + thumbWidth/2`. Same look, correct tracking. |
| I-03 | **Dead overlay canvas**: a second full-size `<canvas ref={overlayRef}>` (`PetCustomizer.jsx:632-643`) is mounted but never drawn to. | Not ported. One canvas. |
| I-04 | **Dead staticBg fetch**: `/images/background.png` 404s in production (`:170-177`), so no background ever draws. | Not ported (§4) — no background layer, no dead request. |
| I-05 | **Font-ready re-render hack**: `setPetName(prev => prev + " ")` then `.trim()` on a 50 ms timer (`:179-186`) to force a repaint — and it calls the action creator without `dispatch`, making it a silent no-op. | The SDK's existing flow: await Mitr via `ensureLabelFont`, then `render()` (`docs/05` §7). |
| I-06 | **Zero accessibility**: no `aria-*`, `role`, or `htmlFor` anywhere in `PetCustomizer.jsx`/`FramesModal.jsx` (grep-verified); collapsible headers and card togglers are click-only `<div>`s; icon buttons are unlabeled. | Keep the SDK a11y scaffold (axe gate, `docs/06` §5): real `<button aria-expanded>` togglers, labeled icon buttons, dialog semantics, focus trap, Escape layering. Visual output identical. |
| I-07 | **Mouse/touch double handlers + scroll hacks**: separate `onMouse*`/`onTouch*` plus a `body.overflow` + `touchmove`-preventDefault hack while dragging (`:219-238`); drags die when the pointer leaves the wrapper. | Keep the SDK's Pointer Events + `setPointerCapture` + `touch-action: none` (already built) — one code path, capture survives leaving the element, no global listeners. |
| I-08 | **Swiper + react-tooltip + lucide-react as runtime deps** for a 3-up pager, hover bubbles, and half a dozen icons. | Zero new dependencies (§7): CSS scroll-snap pager + dots controller, CSS tooltip, inlined SVG paths. Budget-safe, no supply-chain surface. |
| I-09 | **Collapsible via measured `scrollHeight` + rAF + magic `+10px`** (`:141-153`). | Clean measured-height transition (or `grid-template-rows` 0fr→1fr), no magic constants, honors `prefers-reduced-motion`. |
| I-10 | **Search filters `desc` only** (`FramesModal.jsx:141-143`) and references an undefined `--search-field-focused-bg` var (`SearchField.scss`). | Filter by title **and** tags (§6); drop the dead var. Same UX, better recall. |
| I-11 | **Style soup**: Tailwind utilities + SCSS + inline styles + `!important` overrides (e.g. `.upload-container { top: unset !important }`). | Everything lands in the one `tk-` stylesheet on `--tk-*` tokens — the values are ported, the delivery is the SDK's system. No `!important`. |
| I-12 | **Frame metadata bugs**: `customizerSlice.jsx` has shifted `name` fields (`holidays-frame-26.png` → `name: "holidays-frame-25"`, `:246,251`) and duplicate divergent `saveCanvasAPI.js` files. | Fixture dataset (GP-10) must be verified name↔file consistent — do not inherit the shift. The SDK keys on `cutoutLabelId`, never on frame filename strings. |
| I-13 | **Hardcoded `maxLength="20"`** on the pet-name input (`:437`). | Template-driven cap with config fallback (already built, `docs/10` §5). |
| I-14 | **No EXIF orientation, object-URL/IndexedDB leaks** (`useFileHandlers.js:28-35`; blobs never revoked). | Keep the SDK's EXIF correction (`docs/05` §10) and strict object-URL lifecycle (already built). |

These are engineering divergences, not visual ones — if any of them turns out to change a rendered
pixel beyond its row's stated intent, that's a spec bug: stop and re-check against the store.

## 11. Post-parity owner adjustments (2026-07-21) — deliberate deltas FROM the store

| # | Adjustment | Detail |
| --- | --- | --- |
| A-01 | Modal appear/hide animation | Opacity-only fades (in 0.2/0.25s, out 0.18s). Transforms deliberately avoided so canvas geometry is stable from the first frame; reduced-motion disables; a fresh open cuts a still-fading instance. |
| A-02 | Custom purple checkbox | Replaces the store's native default (§5.2): 18px, 2px `--tk-primary` border, radius 5, checked = purple fill + white check (data-URI SVG). |
| A-03 | Smaller mobile empty state | ≤700px: upload icon 44px, prompt 14px/20px. |
| A-04 | Smaller mobile header title | ≤700px: 19px / weight 700 (axe large-text keeps white-on-#f26b1d at 3:1). |
| A-05 | Image-controls stacked | Column: label → rotate/delete buttons → slider (store had label+buttons beside the slider). |
| A-06 | Low-res banner suppressed | Detection stays (`data-lowres`, `DesignerResult.lowRes`); the visible banner + AT announcement are off for now. Re-enable via the toggles in `designer.ts` render(). |
| A-07 | Cutout-browser loading skeletons (2026-07-22) | Shimmer chip pills + a 3-up thumb row mirroring the loaded layout; Browse All hidden until templates arrive; cleared on load error. |
| A-08 | Bottom wave removed (2026-07-22) | The store's decorative `customizer-container:after` wave is not rendered. |
| A-09 | Stable pagination-dots container (2026-07-22) | `.tk-dots` fixed at the active-bullet height (14px) so the bullet grow animation never shifts the Browse All button. |
| A-11 | Message section (2026-07-22) | One error slot for ingest/save/generic errors (`tk-messages`, dismissible, role=alert): desktop at the top of the controls column (above image controls + pet name), mobile right above the canvas; replaces the inline upload/save error lines. |
| A-12 | Whole-canvas click-to-pick (2026-07-22) | In the empty state, clicking anywhere on the canvas frame opens the file picker (store: button only). |
| A-13 | Wire-consistent ingest rules (2026-07-22) | Accepted formats = backend allowlist png/jpeg (+HEIC via transcode; webp/gif now rejected at ingest); 25 MB client cap; backend decode bounds pre-checked (12,000 px/side, 50 MP). |
| A-10 | Canvas loading shimmer (2026-07-22) | Full-frame lavender shimmer (same blink as the cutout skeletons) until the first cutout or photo renders; timed fallback removal if templates fail. |
