/**
 * The injected stylesheet (docs/01 §8): light DOM, one sheet, scoped reset under the tk- root.
 * Visual contract = the store customizer, extracted verbatim in docs/13-visual-parity.md — port
 * values from there (cited to ../treatink source), never re-derive. Tokens (--tk-*) are stamped by
 * applyTheme (theme.ts); every var() here carries the exact store default as its fallback.
 * tk- class names are the documented theming contract (docs/02 §3) — renaming is breaking.
 */

import { THUMB_BG_DATA_URI } from './thumb-bg.js';

export const STYLES_ELEMENT_ID = 'tk-styles';

/** Store stacking breakpoint: below this the two columns stack (store @media 700px, docs/13 §3). */
export const MOBILE_BREAKPOINT_PX = 700;
/** Store gap breakpoint (Tailwind md:) — gaps widen at 768px independent of stacking. */
export const GAP_BREAKPOINT_PX = 768;

export const STYLESHEET = `
.tk-overlay, .tk-overlay * { margin: 0; padding: 0; box-sizing: border-box; }
/* ── Appear/hide (owner 2026-07-21): opacity-only fades — transforms are deliberately avoided
 *    so the canvas geometry (pointer math, drag anchors) is stable from the first frame. ── */
@keyframes tk-overlay-in { from { opacity: 0; } to { opacity: 1; } }
.tk-overlay { animation: tk-overlay-in 0.2s ease-out; }
.tk-modal { animation: tk-overlay-in 0.25s ease-out; }
.tk-overlay.tk-closing { animation: tk-overlay-in 0.18s ease-in reverse forwards; pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .tk-overlay, .tk-modal, .tk-overlay.tk-closing { animation: none; }
}
.tk-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--tk-z-index, 2147483000);
  background: var(--tk-overlay-color, rgba(0, 0, 0, 0.55));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--tk-font-family, 'Montserrat', system-ui, sans-serif);
  color: #000000;
}

/* ── The card (store customizer-container: bg-white rounded-20 box-shadow, docs/13 §3) ── */
.tk-modal {
  position: relative;
  background: var(--tk-surface, #ffffff);
  border-radius: var(--tk-border-radius, 20px);
  width: min(1180px, 94vw);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}
/* (The store's decorative bottom wave was removed by owner request, 2026-07-22 — A-08.) */

/* ── SDK modal chrome (Charter §7.1, VP-04) — not part of the store card. ── */
.tk-header {
  background: var(--tk-header-background, #F26B1D);
  color: var(--tk-header-text, #ffffff);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  position: relative;
  z-index: 1;
}
/* 24px = WCAG "large text" — the default white-on-#f26b1d header passes at the 3:1 threshold. */
.tk-title { font-size: 24px; font-weight: 600; }
.tk-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 999px;
  transition: background 0.2s;
}
.tk-close:hover { background: rgba(255, 255, 255, 0.18); }

/* ── Body = store customizer-container-inner: 40px padding, two 50% columns (canvas left,
 *    controls right), gap 20px → 40px at ≥768px (store gap-5 md:gap-10). Sits above the wave. ── */
.tk-body {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 20px;
  padding: 40px;
  overflow: auto;
  flex: 1;
  position: relative;
  z-index: 1;
  background: transparent;
}
.tk-preview { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
/* Store customizer-controls-container: column, gap 8px → 20px at ≥768px (gap-2 md:gap-5). */
.tk-controls { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
@media (min-width: ${GAP_BREAKPOINT_PX}px) {
  .tk-body { gap: 40px; }
  .tk-controls { gap: 20px; }
}

/* ── Canvas area: the store's dashed 3:4 frame (docs/13 §4). The FRAME owns the border, the
 *    drop surface, and the cursor; the canvas fills it borderless. ── */
.tk-canvas-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border: 3px dashed var(--tk-primary, #a99cdf);
  border-radius: var(--tk-border-radius, 20px);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.tk-canvas-frame.tk-dragging { cursor: grabbing; }
.tk-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.tk-lowres {
  color: #7a4f01;
  background: #fdf3d7;
  border-radius: var(--tk-radius-control, 10px);
  padding: 8px 12px;
  font-size: 14px;
}

/* ── Upload empty state: overlaid on the canvas, anchored above the frame bottom
 *    (store .upload-container: bottom 25%, children max-width 220px). ── */
.tk-upload-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.tk-upload-overlay[hidden] { display: none; } /* author display:flex must not defeat [hidden] */
.tk-upload-overlay > * { max-width: 220px; }
.tk-upload-icon { color: var(--tk-accent, #ffa518); }
.tk-upload-prompt {
  font-size: 16px;
  line-height: 24px;
  color: #000000;
  margin-bottom: 20px;
  white-space: pre-line;
}
.tk-upload-button {
  background: var(--tk-primary, #a99cdf);
  color: #ffffff;
  border: none;
  border-radius: var(--tk-radius-button, 15px);
  padding: 14px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
}
@media (max-width: ${MOBILE_BREAKPOINT_PX - 1}px) {
  .tk-upload-overlay { bottom: 35%; } /* store ≤700px override */
  .tk-upload-button { padding: 10px 15px; } /* store default-btn mobile padding */
  /* Owner (2026-07-21): tighter empty state on small screens. */
  .tk-upload-icon { width: 44px; height: 44px; }
  .tk-upload-prompt { font-size: 14px; line-height: 20px; margin-bottom: 12px; }
}

/* ── Control cards: store .customizer-controls (docs/13 §5). ── */
.tk-image-controls, .tk-text, .tk-cutouts {
  background: var(--tk-panel, #e2e6ff);
  border-radius: var(--tk-border-radius, 20px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tk-card-label {
  font-weight: 500;
  color: #374151;
  text-align: center;
  user-select: none;
}

/* ── Image-controls card (docs/13 §5.1; owner 2026-07-21: stacked column —
 *    label on top, then the action buttons, then the slider). ── */
.tk-image-controls { align-items: center; gap: 8px; }
.tk-image-controls[hidden] { display: none; }
.tk-icon-row { display: flex; justify-content: center; }
.tk-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 12px;
  border-radius: 4px;
  color: #000000;
  cursor: pointer;
  transition: background 0.2s;
}
.tk-icon-button:hover { background: #f3f4f6; }
.tk-image-controls .tk-slider { width: 100%; margin-top: 8px; }

/* ── Zoom: slider-only, store .slider-input (docs/13 §5.1, VP-03). ── */
.tk-slider {
  --tk-thumb-w: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 320px;
  align-self: center;
  position: relative;
  margin-bottom: 45px; /* room for the tooltip below the track */
}
/* Store tooltip bubble riding the thumb (PetCustomizer.scss .slider-input .tooltip). */
.tk-slider-tooltip {
  position: absolute;
  bottom: -50px;
  transform: translateX(-50%);
  background: #ffffff;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  font-size: 14px;
  padding: 6px 15px;
  border-radius: 8px;
  white-space: nowrap;
  transition: transform 0.1s ease-in-out;
}
.tk-slider-tooltip[hidden] { display: none; }
.tk-zoom-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 5px;
  background: transparent;
  outline: none;
  cursor: pointer;
}
/* Intended progress fill, cross-browser (I-01): filled = primary over the darker track.
 * --tk-slider-fill is set by the control from the value. */
.tk-zoom-slider::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 5px;
  background: linear-gradient(
    to right,
    var(--tk-primary, #a99cdf) var(--tk-slider-fill, 0%),
    var(--tk-primary-strong, #8c7ec2) var(--tk-slider-fill, 0%)
  );
}
.tk-zoom-slider::-moz-range-track {
  height: 8px;
  border-radius: 5px;
  background: linear-gradient(
    to right,
    var(--tk-primary, #a99cdf) var(--tk-slider-fill, 0%),
    var(--tk-primary-strong, #8c7ec2) var(--tk-slider-fill, 0%)
  );
}
.tk-zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -5px;
  background: #ffffff;
  border: 2px solid var(--tk-primary, #a99cdf);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s;
}
.tk-zoom-slider::-webkit-slider-thumb:hover { transform: scale(1.1); }
.tk-zoom-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #ffffff;
  border: 2px solid var(--tk-primary, #a99cdf);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.tk-zoom-slider:disabled { opacity: 0.5; cursor: default; }

/* ── Cutout browser: store frame-select card (docs/13 §5.3). ── */
.tk-cutouts { gap: 0; }
.tk-cutouts-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.tk-collapsible { overflow: hidden; transition: height 0.3s ease; }
@media (prefers-reduced-motion: reduce) {
  .tk-collapsible { transition: none; }
}
.tk-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
.tk-chip {
  background: transparent;
  border: 2px solid var(--tk-primary, #a99cdf);
  color: #000000;
  border-radius: var(--tk-radius-control, 10px);
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
  cursor: pointer;
  transition: 0.2s;
}
.tk-chip[aria-selected='true'] {
  background: var(--tk-primary, #a99cdf);
  border-color: var(--tk-primary, #a99cdf);
  color: #ffffff;
}
/* 3-up scroll-snap pager, 320px like the store swiper (slidesPerView 3, spaceBetween 10). */
.tk-pager {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
}
.tk-cutout-row {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 320px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.tk-cutout-row::-webkit-scrollbar { display: none; }
/* Layered thumb: grey backdrop + photo (z0) behind the frame PNG (z1) — store .bg-buttons. */
.tk-cutout-thumb {
  position: relative;
  flex: 0 0 calc(33.333% - 7px);
  aspect-ratio: 3 / 4;
  scroll-snap-align: start;
  padding: 0;
  border: 1px solid #ffffff;
  border-radius: var(--tk-radius-control, 10px);
  background-image: url('${THUMB_BG_DATA_URI}');
  background-size: 100%;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s;
  user-select: none;
}
.tk-thumb-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}
.tk-thumb-frame {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}
.tk-cutout-thumb:hover { border-color: var(--tk-primary, #a99cdf); }
.tk-cutout-thumb:focus-visible { border: 2px solid var(--tk-primary, #a99cdf); outline: none; }
.tk-cutout-thumb[aria-selected='true'] { border: 2px solid var(--tk-primary, #a99cdf); }
/* Store pagination bullets: orange, 10px → 14px active (frames-pagination).
 * Fixed height = the ACTIVE bullet size, so the bullet's smooth grow/shrink never
 * shifts the Browse All button below (owner 2026-07-22). */
.tk-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 14px;
}
.tk-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: var(--tk-accent, #ffa518);
  opacity: 0.3;
  cursor: pointer;
  transition: opacity 0.3s ease-in-out, width 0.3s, height 0.3s;
}
.tk-dot[aria-current='true'] { width: 14px; height: 14px; opacity: 1; }
.tk-browse-wrap { display: flex; justify-content: center; margin-top: 12px; }
.tk-browse-all {
  background: var(--tk-primary, #a99cdf);
  color: #ffffff;
  border: none;
  border-radius: var(--tk-radius-control, 10px);
  padding: 10px 20px;
  font-weight: 500;
  font-size: 15px;
  cursor: pointer;
}

/* ── Browse-All modal: store ModalWrapper + FramesModal (docs/13 §6). ── */
.tk-frames-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tk-frames-overlay[hidden] { display: none; }
.tk-frames-modal {
  position: relative;
  width: calc(100% - 40px);
  max-height: calc(100% - 40px);
  border-radius: 12px;
  background: var(--tk-surface-alt, #F6F6FC);
  box-shadow: -2px 0px 10px rgba(0, 0, 0, 0.2);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
/* Floating circular close (store .modal-close-btn). */
.tk-frames-close {
  position: absolute;
  top: -10px;
  right: -15px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--tk-surface-alt, #F6F6FC);
  color: var(--tk-primary, #a99cdf);
  box-shadow: -2px 0px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  transition: 0.2s ease;
}
.tk-frames-close:hover { background: var(--tk-primary, #a99cdf); color: #ffffff; }
/* Store h4 = Mitr semibold. */
.tk-frames-title {
  font-family: 'Mitr', var(--tk-font-family, 'Montserrat', system-ui, sans-serif);
  font-weight: 600;
  font-size: 24px;
}
/* Pill search field (store SearchField.scss). */
.tk-search {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 384px;
}
.tk-search-input {
  height: 48px;
  width: 100%;
  padding: 0 20px;
  background: #ffffff;
  border: 2px solid var(--tk-primary, #a99cdf);
  border-radius: 100px;
  outline: none;
  transition: 0.2s;
  font-size: 16px;
  font-family: inherit;
}
.tk-search-input::-webkit-search-cancel-button { display: none; -webkit-appearance: none; }
.tk-search-clear {
  position: absolute;
  left: 20px;
  background: none;
  border: none;
  padding: 0;
  color: #000000;
  cursor: pointer;
  display: flex;
  z-index: 1;
}
.tk-search-clear:not([hidden]) + .tk-search-input { padding-left: 50px; }
.tk-search-icon {
  position: absolute;
  right: 20px;
  color: #000000;
  display: flex;
  pointer-events: none;
}
/* Modal chips are the 14px variant (FramesModal.scss). */
.tk-chip-lg { font-size: 14px; padding: 4px 12px; }
/* Scrollable centered grid; store thumb widths 270/200/150. */
.tk-frames-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  width: 100%;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;
}
.tk-frames-grid .tk-cutout-thumb { flex: 0 0 270px; }
@media (max-width: 1000px) {
  .tk-frames-grid .tk-cutout-thumb { flex-basis: 200px; }
}
@media (max-width: 800px) {
  .tk-frames-grid .tk-cutout-thumb { flex-basis: 150px; }
}
.tk-frames-empty { color: #6b7280; text-align: center; margin: 40px 0; }

/* ── Loading states (owner 2026-07-22): shimmer skeletons + canvas spinner. ── */
@keyframes tk-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
.tk-skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.55) 25%,
    rgba(255, 255, 255, 0.85) 50%,
    rgba(255, 255, 255, 0.55) 75%
  );
  background-size: 200% 100%;
  animation: tk-shimmer 1.4s ease-in-out infinite;
}
.tk-skeleton-chip { width: 72px; height: 27px; border-radius: var(--tk-radius-control, 10px); }
.tk-skeleton-thumb {
  flex: 0 0 calc(33.333% - 7px);
  aspect-ratio: 3 / 4;
  border-radius: var(--tk-radius-control, 10px);
}
/* Full-frame shimmer over the canvas — same blink as the cutout skeletons, but tinted from the
 * panel lavender so it reads on the white frame (the card skeletons shimmer white-on-lavender). */
.tk-canvas-loading {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(226, 230, 255, 0.35) 25%,
    rgba(226, 230, 255, 0.75) 50%,
    rgba(226, 230, 255, 0.35) 75%
  );
  background-size: 200% 100%;
}
@media (prefers-reduced-motion: reduce) {
  .tk-skeleton { animation: none; background: rgba(255, 255, 255, 0.7); }
  .tk-canvas-loading { animation: none; background: rgba(226, 230, 255, 0.5); }
}

/* Personalization text: store pet-name card (docs/13 §5.2) — centered column, native 16px
 * checkbox (no accent override — store ships the UA default), borderless white pill input. */
.tk-text { align-items: center; gap: 8px; }
.tk-text-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}
/* Custom purple checkbox (owner 2026-07-21 — replaces the store's native default). */
.tk-text-checkbox {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border: 2px solid var(--tk-primary, #a99cdf);
  border-radius: 5px;
  background: #ffffff no-repeat center / 12px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.tk-text-checkbox:checked {
  background-color: var(--tk-primary, #a99cdf);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
}
.tk-text-checkbox:focus-visible {
  outline: 2px solid var(--tk-primary-strong, #8c7ec2);
  outline-offset: 2px;
}
.tk-text-input {
  width: 100%;
  max-width: 320px;
  border: none;
  border-radius: var(--tk-radius-control, 10px);
  padding: 8px;
  font-size: 16px;
  text-align: center;
  font-family: inherit;
  background: #ffffff;
}
.tk-text-input:focus { outline: 2px solid var(--tk-primary, #a99cdf); }

/* Save CTA: store Button filled primary (docs/13 §5.4, Button.scss .default-btn). */
.tk-save-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--tk-accent, #ffa518);
  color: #ffffff;
  border: none;
  border-radius: var(--tk-radius-button, 15px);
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
}
.tk-save-button:hover:not(:disabled) { background: var(--tk-accent-hover, #dd9133); }
.tk-save-button:disabled { opacity: 0.3; cursor: default; }
.tk-save-button svg[hidden] { display: none; } /* arrow hides while saving (store) */

/* ── Message section (owner 2026-07-22): one slot for ingest/save/generic errors. ── */
.tk-messages {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  background: #fdecea;
  color: #b3261e;
  border-radius: var(--tk-radius-control, 10px);
  padding: 10px 14px;
  font-size: 14px;
  line-height: 20px;
}
.tk-messages[hidden] { display: none; }
.tk-message { flex: 1 1 auto; }
.tk-message-dismiss {
  flex: 0 0 auto;
  display: inline-flex;
  background: none;
  border: none;
  padding: 2px;
  color: inherit;
  cursor: pointer;
}

.tk-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── Mobile: store @media(max-width:700px) — stacked, edge-to-edge card, wave hidden,
 *    control cards tighten to radius 10 (docs/13 §3). Outer 20px side gutter comes from the
 *    store page container (contained-width ≤800px). ── */
@media (max-width: ${MOBILE_BREAKPOINT_PX - 1}px) {
  .tk-modal { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; box-shadow: none; }
  .tk-body { flex-direction: column; padding: 20px; gap: 20px; }
  .tk-preview, .tk-controls { flex: 0 0 auto; width: 100%; }
  .tk-image-controls, .tk-text, .tk-cutouts { border-radius: var(--tk-radius-control, 10px); }
  .tk-save-button { padding: 10px 15px; } /* store default-btn mobile padding */
  /* Owner (2026-07-21): smaller header title on mobile. 19px at weight 700 stays WCAG
   * "large text" (≥14pt bold — axe requires 700), keeping white-on-#f26b1d at the 3:1 threshold. */
  .tk-title { font-size: 19px; font-weight: 700; }
  .tk-slider { --tk-thumb-w: 23px; }
  .tk-zoom-slider { height: 10px; }
  .tk-zoom-slider::-webkit-slider-runnable-track { height: 10px; }
  .tk-zoom-slider::-moz-range-track { height: 10px; }
  .tk-zoom-slider::-webkit-slider-thumb { width: 23px; height: 23px; margin-top: -6px; }
  .tk-zoom-slider::-moz-range-thumb { width: 23px; height: 23px; }
}
`;

/** Inject the sheet once per document. */
export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLES_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLES_ELEMENT_ID;
  style.textContent = STYLESHEET;
  doc.head.appendChild(style);
}
