/**
 * The injected stylesheet (docs/01 §8): light DOM, one sheet, scoped reset under the tk- root.
 * Visual contract = the store customizer, extracted verbatim in docs/13-visual-parity.md — port
 * values from there (cited to ../treatink source), never re-derive. Tokens (--tk-*) are stamped by
 * applyTheme (theme.ts); every var() here carries the exact store default as its fallback.
 * tk- class names are the documented theming contract (docs/02 §3) — renaming is breaking.
 */

export const STYLES_ELEMENT_ID = 'tk-styles';

/** Store stacking breakpoint: below this the two columns stack (store @media 700px, docs/13 §3). */
export const MOBILE_BREAKPOINT_PX = 700;
/** Store gap breakpoint (Tailwind md:) — gaps widen at 768px independent of stacking. */
export const GAP_BREAKPOINT_PX = 768;

/** Store wave footer (docs/13 §3) — used as a mask so it tints from --tk-panel (I-11-adjacent:
 *  the store hardcodes #e2e6ff in the SVG; masking keeps the identical default look themeable). */
const WAVE_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23000' d='M0,192L30,165.3C60,139,120,85,180,90.7C240,96,300,160,360,170.7C420,181,480,139,540,133.3C600,128,660,160,720,197.3C780,235,840,277,900,277.3C960,277,1020,235,1080,229.3C1140,224,1200,256,1260,250.7C1320,245,1380,203,1410,181.3L1440,160L1440,320L1410,320C1380,320,1320,320,1260,320C1200,320,1140,320,1080,320C1020,320,960,320,900,320C840,320,780,320,720,320C660,320,600,320,540,320C480,320,420,320,360,320C300,320,240,320,180,320C120,320,60,320,30,320L0,320Z'/%3E%3C/svg%3E")`;

export const STYLESHEET = `
.tk-overlay, .tk-overlay * { margin: 0; padding: 0; box-sizing: border-box; }
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
/* Decorative wave pinned to the card bottom (store customizer-container:after — 200px,
 * bottom-anchored, under the content, hidden on mobile). */
.tk-modal::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 200px;
  pointer-events: none;
  background-color: var(--tk-panel, #e2e6ff);
  -webkit-mask-image: ${WAVE_MASK};
  mask-image: ${WAVE_MASK};
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: 50% 100%;
  mask-position: 50% 100%;
  -webkit-mask-size: 100%;
  mask-size: 100%;
}

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
.tk-upload-error { color: #b3261e; margin-top: 8px; font-size: 14px; }
@media (max-width: ${MOBILE_BREAKPOINT_PX - 1}px) {
  .tk-upload-overlay { bottom: 35%; } /* store ≤700px override */
  .tk-upload-button { padding: 10px 15px; } /* store default-btn mobile padding */
}

/* ── Control cards: store .customizer-controls (docs/13 §5). ── */
.tk-zoom, .tk-text, .tk-cutouts {
  background: var(--tk-panel, #e2e6ff);
  border-radius: var(--tk-border-radius, 20px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Zoom (interim — slider-only rework lands in P5-T04). */
.tk-zoom { flex-direction: row; align-items: center; gap: 10px; }
.tk-zoom-in, .tk-zoom-out {
  background: var(--tk-primary, #a99cdf);
  color: #ffffff;
  border: none;
  border-radius: var(--tk-radius-control, 10px);
  width: 36px;
  height: 36px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  transition: background 0.2s;
}
.tk-zoom-in:hover, .tk-zoom-out:hover { background: var(--tk-primary-strong, #8c7ec2); }
.tk-zoom-in:disabled, .tk-zoom-out:disabled { opacity: 0.4; cursor: default; }
.tk-zoom-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 8px;
  border-radius: 5px;
  background: transparent;
  outline: none;
  cursor: pointer;
}
.tk-zoom-slider::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 5px;
  background: var(--tk-primary-strong, #8c7ec2);
}
.tk-zoom-slider::-moz-range-track {
  height: 8px;
  border-radius: 5px;
  background: var(--tk-primary-strong, #8c7ec2);
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

/* Cutout browser (interim — store chips/pager/thumbs land in P5-T07). */
.tk-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.tk-chip {
  background: transparent;
  border: 2px solid var(--tk-primary, #a99cdf);
  color: #000000;
  border-radius: var(--tk-radius-control, 10px);
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: 0.2s;
}
.tk-chip[aria-selected='true'] {
  background: var(--tk-primary, #a99cdf);
  border-color: var(--tk-primary, #a99cdf);
  color: #ffffff;
}
.tk-cutout-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.tk-cutout-grid { flex-wrap: wrap; overflow-x: visible; max-height: 40vh; overflow-y: auto; }
.tk-cutout-thumb {
  flex: 0 0 auto;
  width: 64px;
  height: 85px;
  padding: 0;
  border: 1px solid #ffffff;
  border-radius: var(--tk-radius-control, 10px);
  background: #ffffff;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s;
  user-select: none;
}
.tk-cutout-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tk-cutout-thumb:hover { border-color: var(--tk-primary, #a99cdf); }
.tk-cutout-thumb:focus-visible { border: 2px solid var(--tk-primary, #a99cdf); outline: none; }
.tk-cutout-thumb[aria-selected='true'] { border: 2px solid var(--tk-primary, #a99cdf); }

/* Personalization text (store pet-name card, docs/13 §5.2 — full parity in P5-T06). */
.tk-text { align-items: center; }
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
.tk-text-checkbox { width: 16px; height: 16px; }
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

/* Save CTA (store Button filled primary — full parity in P5-T09). */
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
.tk-save-error { color: #b3261e; margin-top: 8px; font-size: 14px; }

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
  .tk-modal::after { display: none; }
  .tk-body { flex-direction: column; padding: 20px; gap: 20px; }
  .tk-preview, .tk-controls { flex: 0 0 auto; width: 100%; }
  .tk-zoom, .tk-text, .tk-cutouts { border-radius: var(--tk-radius-control, 10px); }
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
