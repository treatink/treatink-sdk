# Phase 05 · Visual Parity (owner-directed, 2026-07-21)

**Goal:** the designer modal's default look becomes **pixel-faithful to the store customizer**
(`PetCustomizer.jsx`, API mode) while staying fully themeable — colors, radii, and shades all flow
from `--tk-*` tokens a partner can override at `init`.

**The spec is `docs/13-visual-parity.md`** — every value there is extracted from store source with
citations. Do not re-derive styles from screenshots or memory; port from the spec, and when in
doubt open the cited store file. Scope deltas (no pet-type, rotation IN, slider-only zoom, SDK
header kept) are pinned in `docs/13` intro + `docs/09`.

**Inherit vs improve:** the store code is partly ad-hoc; `docs/13` §10 is the binding contract for
what is ported verbatim (layout, features, styles, math) vs implemented at industry level
(I-01…I-14: dead code not ported, real a11y, pointer events, zero new deps, one stylesheet, correct
slider fill/tooltip math, verified fixture metadata). Tasks below cite the I-numbers they own; do
not silently deviate beyond that list.

**Why a phase, not a patch:** this reshapes the designer DOM (upload moves onto the canvas,
zoom buttons go away, a nested Browse-All modal appears), so e2e/a11y specs must be updated in
lockstep, task by task, each behind a gate. Engine, transport, save pipeline, and public API
namespaces are untouched except: rotation UI wiring (T05) and cutout auto-preselect (T07).

**Entry gate:** `npm run verify` green on main (P1–P3 state).
**Exit gate:** full sweep green — `npm run verify && npm run test:golden && npm run test:e2e &&
npm run test:a11y && npm run size && npm run check:no-secret` — plus a human eyeball pass of the
harness (`npm run demo`) against the live store customizer.

Rules of engagement (all of `AGENTS.md` applies):

- Selectors in specs may change with the DOM; **assertion intent and thresholds may not**. Spec
  updates ship in the same commit as the DOM change they track.
- Class names are the documented theming contract (`docs/02` §3): removed/renamed classes must be
  listed in the task's commit body (pre-1.0, allowed, but recorded).
- Budgets are gates: designer chunk ≤ 150 KB gz with all inlined assets (`docs/06` §2).

---

### P5-T01 · Theme tokens + copy surface (the contract first)

- depends_on: []
- does: Extend `ThemeConfig` (additive: `primaryStrong`, `panelBackground`, `accentHover`,
  `surfaceAlt`, `buttonRadius`, `controlRadius`) and `CopyStrings` (keys in `docs/13` §8) in
  `src/types.ts`; update `theme.ts` defaults to the store palette (`docs/13` §1) with the
  explicit-wins / derive-from-base resolution rule; map new vars in `applyTheme`. Update
  `docs/10` §8 (types are frozen — this is a reviewed contract edit) and `docs/design-reference`
  §3 (mark the Charter palette superseded; store palette is truth).
- dod: `types.ts` == `docs/10`; defaults are the exact store hexes; overriding only
  `primary`/`accent`/`borderRadius` yields coherent derived shades.
- gate: `npm run typecheck && npm test -- config && npm run lint`

### P5-T02 · Modal shell & layout (the card)

- depends_on: [P5-T01]
- does: Rebuild the stylesheet frame per `docs/13` §3: modal = white card radius 20 + store
  shadow, width `min(1180px, 94vw)`; body = 40px padding, row-reverse 50/50 columns, 20/40px
  gaps; wave `::after` (data URI); mobile stacking breakpoint **700px** (column-reverse,
  padding 0, radius-10 cards, wave hidden); keep the header bar contract. Purge the derived
  `color-mix` roles that `docs/13` §1 replaces with explicit tokens.
- dod: two-column geometry matches the store at ≥700px and stacks below; header/theming vars
  intact.
- gate: `npm run test:e2e -- designer-shell && npm run test:e2e -- designer-theming && npm run size`
  (specs updated per `docs/13` §9)

### P5-T03 · Canvas area + upload overlay

- depends_on: [P5-T02]
- does: `docs/13` §4 — dashed 3:4 wrapper owns the border and the pointer/drop surface; canvas
  fills it borderless; empty-state overlay (orange upload icon, two-line prompt, purple pill
  picker) anchored at bottom 25%; **remove the `tk-dropzone` card** from the controls column;
  cursor pointer/grabbing; `tk-lowres` re-seated under the wrapper.
- dod: drop + click-to-pick work on the canvas; overlay disappears on photo accept and returns
  after delete (delete lands in T05 — until then, only on fresh open); HEIC path unaffected.
- gate: `npm run test:e2e -- designer-upload && npm run test:e2e -- designer-heic && npm run test:e2e -- designer-lowres`

### P5-T04 · Slider-only zoom with px tooltip

- depends_on: [P5-T02]
- does: `docs/13` §5.1 slider block — remove `tk-zoom-in`/`tk-zoom-out` everywhere (DOM, styles,
  copy usage, specs); restyle the range (track `--tk-primary-strong`, 18px white/purple thumb,
  mobile 10px/23px); implement the **intended** progress fill cross-browser (I-01 — the store's
  `--progress` fill is dead code; use a value-sized gradient, filled = `--tk-primary`); add the
  dimensions tooltip anchored to the true thumb center (I-02 — corrected math, not the store's
  0.4-floor drift; clamp floor stays 0.5, `docs/05` §5).
- dod: slider is the only zoom control; fill + tooltip track the thumb precisely in all three
  engines; tooltip reads `W x Hpx`; keyboard arrows still zoom (native range).
- gate: `npm run test:e2e -- designer-position && npm run test:a11y` (both updated)

### P5-T05 · Image-controls card (rotate + delete + slider)

- depends_on: [P5-T03, P5-T04]
- does: `docs/13` §5.1 card — appears only when a photo is present; icon buttons rotate-left /
  rotate-right (±15° additive, store `customizerSlice.jsx:594-600`) and delete (back to empty
  state); slider block moves inside. Rotation flows through render → export → transform →
  draft/payload (types already carry it). Extend the golden matrix with a rotation case,
  baseline generated from the **store renderer** via `test/golden/gen-baseline.mjs` (GP-13
  two-source rule). Record the owner veto (rotation now in MVP) in `docs/09` + `docs/05` §1 note.
- dod: rotated composite exports correctly and survives draft re-open; hit-testing stays
  axis-aligned (store behavior); card hidden pre-upload.
- gate: `npm run test:e2e -- designer-position && npm run test:golden && npm test -- cutout-engine`

### P5-T06 · Pet-name card

- depends_on: [P5-T02]
- does: `docs/13` §5.2 — centered native 16px checkbox + label, borderless white pill input
  (radius 10, centered text, purple focus outline, max-width 320px).
- dod: toggle/input behavior unchanged (cap, live label render); visuals match the spec.
- gate: `npm run test:e2e -- designer-text`

### P5-T07 · Cutout browser card (chips · pager · layered thumbs · auto-preselect)

- depends_on: [P5-T02]
- does: `docs/13` §5.3 — collapsible card ("Choose Your Background" + chevron; real
  `<button aria-expanded>` toggler + clean height transition, I-06/I-09); 11px rounded-10
  chips (no Browse-All chip; default category Standard); 3-up scroll-snap pager (320px, 10px
  gaps) with orange pagination dots — **no Swiper dep** (I-08); thumbs = grey-png background +
  shopper photo (cover, z-0) behind the frame PNG (z-10), 1px white → 2px purple selected;
  "Browse All" purple button; **auto-preselect the default cutout on open** when no
  `cutoutLabelId`/draft preselect exists. Verify the fixture dataset's cutout name↔file mapping
  (I-12 — do not inherit the store slice's shifted `name` fields).
- dod: pager pages by 3 with clickable dots; thumbs live-preview the current photo; canvas shows
  a frame immediately on open (like the store); save precondition satisfied by preselect.
- gate: `npm run test:e2e -- designer-cutouts && npm run test:e2e -- designer-save-local`
  (save spec re-checked: "no cutout" preconditions updated)

### P5-T08 · Browse-All modal + search

- depends_on: [P5-T07]
- does: `docs/13` §6 — nested overlay panel on `--tk-surface-alt` (radius 12, floating circular
  close, Mitr title), pill search field (48px / 2px purple / radius 100px, magnifier + clear
  icons) filtering by title **and** tags (I-10 — store filtered `desc` only), 14px chips,
  centered scrollable grid (270/200/150px thumbs), select-closes, Escape layering (frames modal
  first; dialog semantics per I-06). Replaces the inline `tk-cutout-grid`.
- dod: full catalog browsable + searchable; a11y (trap, labels, Escape) holds.
- gate: `npm run test:e2e -- designer-cutouts && npm run test:a11y`

### P5-T09 · Save row + full-parity sweep

- depends_on: [P5-T03, P5-T05, P5-T06, P5-T07, P5-T08]
- does: `docs/13` §5.4 — full-width orange save button (justify-between + ArrowRight 30, hover
  `--tk-accent-hover`, disabled 0.3, "Saving..." swap). Then the sweep: run every suite; fix
  stragglers (`happy-path`, `draft-reopen`, `quickstart` selectors); verify chunk budget with all
  assets inlined; `npm run demo` harness eyeball vs the live store customizer side by side.
- dod: exit gate green; STATE.md phase status + iteration log updated; class-contract changes
  listed in the commit body.
- gate: `npm run verify && npm run test:golden && npm run test:e2e && npm run test:a11y && npm run check:no-secret`

---

## Task graph

```
T01 ─→ T02 ─┬→ T03 ─┬───────────→ T05 ─┐
            ├→ T04 ─┘                  │
            ├→ T06 ────────────────────┤
            └→ T07 ─→ T08 ─────────────┴→ T09
```

T03/T04/T06/T07 are independent after T02 and may interleave; T09 is the convergence + sweep.
