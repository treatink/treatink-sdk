# Phase 02 · Designer (Charter M2)

**Goal:** the modal personalizer at **Riley's parity** (Charter §7.2) — native, embedded, no iframe
— rendered in light DOM with `tk-` classes, themeable via init params + host CSS, with
accessibility essentials. It drives the Phase-1 engine and fixtures; it does **not** yet run the
upload-on-save pipeline (that's P3 — here, Save fires `onComplete` with a locally-composited
result).

**In scope:** portal modal + header + scroll-lock + single-instance guard; photo input
(drag-drop + picker, EXIF, HEIC lazy transcode); positioning (drag + button/slider zoom);
category chips + thumbnail row + Browse All; personalization-text toggle/input with on-label render;
Save CTA (local composite → `onComplete`); theming (`ThemeConfig`→CSS vars) + copy overrides; a11y.
**Out of scope:** real asset upload & drafts (P3); live transport (P4); Shadow DOM,
pinch, keyboard nudge, inline `mount()` (deferred).

**Entry gate:** Phase 1 exit green (engine + fixtures + goldens).
**Exit gate:** `npm run verify` + `npm run test:e2e` (open→upload→position→text→save-local) +
`npm run test:a11y` green; **size budgets hold** (loader ≤ 15 KB gz, designer chunk ≤ 150 KB gz).

**Read first:** Charter §7, `docs/05-engine-reference.md` (§4–§7 for UI behavior), `docs/01` §8
(light DOM), `docs/02` §3 (`tk-` classes), `docs/06` §2 (budgets), §5 (a11y).

---

### P2-T01 · Modal shell + lifecycle
- depends_on: []
- does: `tk.designer.open(options)` / `close()`. Portal-render a full overlay at `document.body`
  with header ("Personalize Your Product", copy-overridable), close control, scroll-lock behind.
  Reject opening a second modal while one is live. Two-column layout (preview left, controls right),
  stacking to a full-screen sheet on mobile.
- dod: open renders the modal into `body`; close restores scroll; second `open()` while live is
  rejected; layout switches at mobile breakpoint.
- gate: `npm run test:e2e -- designer-shell`
- refs: Charter §7.1, `docs/01` §8

### P2-T02 · Lazy designer chunk + loader budget
- depends_on: [P2-T01]
- does: Ensure the `Treatink` global/loader stays tiny and the designer code loads as a lazy chunk
  on first `open()`. Wire both into `npm run size`.
- dod: loader ≤ 15 KB gz; designer chunk ≤ 150 KB gz; designer code is not in the loader bundle.
- gate: `npm run size`
- refs: Charter §4, §13, `docs/06` §2

### P2-T03 · Accessibility scaffold
- depends_on: [P2-T01]
- does: `role="dialog"` + `aria-modal`, focus trap, focus restoration on close, Escape to close,
  all controls tabbable + labeled, image alt text, low-res warning announced to AT.
- dod: `npm run test:a11y` reports 0 serious/critical on the open modal; keyboard trap/restore work
  in e2e.
- gate: `npm run test:a11y && npm run test:e2e -- designer-a11y`
- refs: Charter §7.3, `docs/06` §5

### P2-T04 · Theming + copy overrides
- depends_on: [P2-T01]
- does: Map `ThemeConfig` → `--tk-*` CSS variables (defaults: primary `#8EA0F6`, accent `#EA8D00`,
  etc. per Charter §7.3); one injected stylesheet with a scoped reset inside the `tk-` root; wire
  `copy` overrides for every designer string (`CopyStrings`).
- dod: init `theme`/`copy` change the rendered modal; host CSS on documented `tk-` classes overrides
  cleanly; default theme matches Charter values.
- gate: `npm run test:e2e -- designer-theming`
- refs: Charter §7.3, §6.1, `docs/02` §3

### P2-T05 · Photo input (drag-drop + picker, EXIF)
- depends_on: [P2-T01]
- does: Drag-and-drop zone + "Or Select Image" picker. Client-side validation (image types, reject
  SVG, ≤ 25 MB). EXIF orientation correction. Feed the loaded image into the engine's initial fit
  (`docs/05` §3).
- dod: both input paths load a photo; rotated-EXIF photo displays upright; invalid file →
  `unsupported_file_type` surfaced in UI; oversize rejected pre-"upload".
- gate: `npm run test:e2e -- designer-upload`
- refs: Charter §7.2, `docs/05` §3, `docs/02` §5

### P2-T06 · HEIC lazy transcode
- depends_on: [P2-T05]
- does: When a HEIC/HEIF file appears, lazy-load a decoder chunk and transcode to JPEG before
  ingest (Charter §16.9). Decoder is its own chunk, loaded only on first HEIC.
- dod: a HEIC upload succeeds and renders; the decoder is absent from initial bundles (verified by
  `size`/network in e2e).
- gate: `npm run test:e2e -- designer-heic && npm run size`
- refs: Charter §7.2, §13, §16.9, `docs/06` §2

### P2-T07 · Positioning (drag + zoom controls)
- depends_on: [P2-T01, P2-T05]
- does: Drag to pan and zoom buttons + slider driving the engine transform. Slider `min 0.4`,
  `max maxScale`, value `scale` (`docs/05` §5); buttons step; live canvas re-render (dim cutout to
  0.6 while dragging, `docs/05` §6). MVP: single photo, no rotation UI.
- dod: drag moves the photo; zoom controls change `scale` within `[0.5, maxScale]`; preview matches
  the engine's composite.
- gate: `npm run test:e2e -- designer-position`
- refs: `docs/05` §4–§6, Charter §7.2

### P2-T08 · Cutout browser (chips + row + Browse All)
- depends_on: [P2-T01, P1-T07]
- does: Category chips driven by template `category` metadata (Standard/Holidays/Birthdays/
  Occasions — not hard-coded), a paged thumbnail row, and a Browse All grid. Selecting a cutout
  re-renders with the new frame PNG on top.
- dod: chips reflect fixture template categories; selection updates the preview; Browse All lists
  all templates for the SKU.
- gate: `npm run test:e2e -- designer-cutouts`
- refs: Charter §7.2, Appendix B (`category`), `docs/01` §5

### P2-T09 · Personalization text
- depends_on: [P2-T01, P2-T07]
- does: Opt-in toggle + input (label via `copy.personalizationTextLabel`, e.g. "Include Pet Name on
  Label"). Length cap = `template.maxTextLength ?? config.maxPersonalizationLength ?? 20` (the backend
  has no length field — `docs/10` §5); visual auto-shrink still applies. Rendered onto the label at
  the template's `pet_name_position` using the engine text math (`docs/05` §7). One style per
  template, no font controls.
- dod: toggling on renders the text at the correct per-cutout Y; length limit enforced; color
  follows template theme.
- gate: `npm run test:e2e -- designer-text`
- refs: `docs/05` §7, Charter §7.2, §12

### P2-T10 · Low-res warning
- depends_on: [P2-T07]
- does: Surface the engine's `lowRes` flag (Charter D.8) as a non-blocking warning, announced to AT.
- dod: a small/over-zoomed photo triggers the warning; saving is still allowed.
- gate: `npm run test:e2e -- designer-lowres`
- refs: `docs/05` §8, Charter §7.2, §7.3

### P2-T11 · Save CTA (local composite → onComplete)
- depends_on: [P2-T07, P2-T09]
- does: Primary Save CTA renders the composite via the engine and fires `onComplete` with a
  **local** `DesignerResult` (object-URL preview; no network yet — real upload is P3). Show
  in-flight + success states; close on success.
- dod: Save produces a composite and calls `onComplete` with a well-formed `DesignerResult`
  (minus server URLs, filled in P3); modal closes on success.
- gate: `npm run test:e2e -- designer-save-local`
- refs: Charter §7.2, §6.3, `docs/05` §8

---

## Phase 2 exit checklist
- [ ] `npm run verify` green
- [ ] `npm run test:e2e` (shell, upload incl. HEIC, position, cutouts, text, low-res, save-local) green
- [ ] `npm run test:a11y` green; keyboard pass documented
- [ ] Size budgets hold (loader + designer chunk); HEIC decoder is a separate lazy chunk
- [ ] Riley's designer feature set reproduced natively (no iframe)
