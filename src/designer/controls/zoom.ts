import { MIN_SCALE, clampScale } from '../../cutout-engine/index.js';
import type { CopyStrings } from '../../types.js';

/**
 * Zoom (P2-T07 → P5-T04, docs/13 §5.1): SLIDER-ONLY like the store desktop (VP-03 — no −/+
 * buttons), min 0.5 / max maxScale / step 0.1 (docs/05 §5), with the store's px-dimensions
 * tooltip riding the thumb. Tooltip anchoring uses the corrected thumb-center math (I-02) —
 * the store's (scale−0.4)/(maxScale−0.4) anchor drifts off the thumb; the fill is painted
 * cross-browser via a value-sized gradient (I-01 — the store's --progress fill is dead code).
 */

export const ZOOM_STEP = 0.1;

export interface ZoomHooks {
  onScale(scale: number): void;
}

export interface ZoomControl {
  root: HTMLElement;
  slider: HTMLInputElement;
  /** Enable once a photo is loaded; maxScale + fitted box come from its initial fit. */
  enable(maxScale: number, scale: number, box: { width: number; height: number }): void;
  /** Back to the pre-photo state (photo deleted). */
  disable(): void;
  setValue(scale: number): void;
}

export function mountZoom(
  doc: Document,
  host: HTMLElement,
  copy: Pick<CopyStrings, 'zoomSliderLabel'>,
  hooks: ZoomHooks,
): ZoomControl {
  const root = doc.createElement('div');
  root.className = 'tk-slider';

  // Store slider tooltip: "W x Hpx" of the scaled display box, riding the thumb below the track.
  const tooltip = doc.createElement('div');
  tooltip.className = 'tk-slider-tooltip';
  tooltip.setAttribute('aria-hidden', 'true'); // decorative — the slider itself is the control
  tooltip.hidden = true;

  const slider = doc.createElement('input');
  slider.type = 'range';
  slider.className = 'tk-zoom-slider';
  slider.min = String(MIN_SCALE); // 0.5 — store floor (docs/05 §5)
  slider.step = '0.1';
  slider.setAttribute('aria-label', copy.zoomSliderLabel);

  let maxScale = 1;
  let box: { width: number; height: number } | null = null;

  /** Fill + tooltip follow the value (I-01/I-02): fraction of the [0.5, max] range. */
  const sync = (scale: number) => {
    const fraction = maxScale > MIN_SCALE ? (scale - MIN_SCALE) / (maxScale - MIN_SCALE) : 0;
    // Cross-browser track fill: filled portion in --tk-primary over the --tk-primary-strong track.
    slider.style.setProperty('--tk-slider-fill', `${(fraction * 100).toFixed(2)}%`);
    if (box) {
      tooltip.textContent = `${Math.round(box.width * scale)} x ${Math.round(box.height * scale)}px`;
      // Thumb-center anchor: fraction of (100% − thumb) + half a thumb, then translateX(-50%).
      tooltip.style.left = `calc(${fraction.toFixed(4)} * (100% - var(--tk-thumb-w, 18px)) + var(--tk-thumb-w, 18px) / 2)`;
    }
  };

  const emit = (raw: number) => {
    const scale = clampScale(Math.round(raw * 10) / 10, maxScale);
    slider.value = String(scale);
    sync(scale);
    hooks.onScale(scale);
  };
  slider.addEventListener('input', () => emit(parseFloat(slider.value)));

  slider.disabled = true;
  sync(MIN_SCALE);

  root.append(tooltip, slider);
  host.appendChild(root);
  return {
    root,
    slider,
    enable(newMaxScale, scale, newBox) {
      maxScale = newMaxScale;
      box = newBox;
      slider.max = String(newMaxScale);
      slider.value = String(scale);
      slider.disabled = false;
      tooltip.hidden = false;
      sync(scale);
    },
    disable() {
      box = null;
      slider.disabled = true;
      tooltip.hidden = true;
      slider.value = String(MIN_SCALE);
      sync(MIN_SCALE);
    },
    setValue(scale) {
      slider.value = String(scale);
      sync(scale);
    },
  };
}
