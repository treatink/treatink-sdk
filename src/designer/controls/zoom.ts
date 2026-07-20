import { MIN_SCALE, clampScale } from '../../cutout-engine/index.js';
import type { CopyStrings } from '../../types.js';

/**
 * Zoom controls (P2-T07, docs/05 §5): slider min 0.5 / max maxScale / step 0.1 + −/+ buttons,
 * exactly the store's DesktopCustomizer slider (:156-158 — the 0.4 there is only a cosmetic
 * tooltip anchor; the real floor is 0.5 everywhere). Buttons step by 0.1 with the same clamp.
 */

export const ZOOM_STEP = 0.1;

export interface ZoomHooks {
  onScale(scale: number): void;
}

export interface ZoomControl {
  root: HTMLElement;
  slider: HTMLInputElement;
  /** Enable once a photo is loaded; maxScale comes from its initial fit. */
  enable(maxScale: number, scale: number): void;
  setValue(scale: number): void;
}

export function mountZoom(
  doc: Document,
  host: HTMLElement,
  copy: Pick<CopyStrings, 'zoomInLabel' | 'zoomOutLabel' | 'zoomSliderLabel'>,
  hooks: ZoomHooks,
): ZoomControl {
  const root = doc.createElement('div');
  root.className = 'tk-zoom';

  const out = doc.createElement('button');
  out.type = 'button';
  out.className = 'tk-zoom-out';
  out.setAttribute('aria-label', copy.zoomOutLabel);
  out.textContent = '−';

  const slider = doc.createElement('input');
  slider.type = 'range';
  slider.className = 'tk-zoom-slider';
  slider.min = String(MIN_SCALE); // 0.5 — store slider min (DesktopCustomizer.jsx:156)
  slider.step = '0.1';
  slider.setAttribute('aria-label', copy.zoomSliderLabel);

  const zoomIn = doc.createElement('button');
  zoomIn.type = 'button';
  zoomIn.className = 'tk-zoom-in';
  zoomIn.setAttribute('aria-label', copy.zoomInLabel);
  zoomIn.textContent = '+';

  let maxScale = 1;
  const emit = (raw: number) => {
    const scale = clampScale(Math.round(raw * 10) / 10, maxScale);
    slider.value = String(scale);
    hooks.onScale(scale);
  };
  out.addEventListener('click', () => emit(parseFloat(slider.value) - ZOOM_STEP));
  zoomIn.addEventListener('click', () => emit(parseFloat(slider.value) + ZOOM_STEP));
  slider.addEventListener('input', () => emit(parseFloat(slider.value)));

  const setDisabled = (disabled: boolean) => {
    out.disabled = disabled;
    zoomIn.disabled = disabled;
    slider.disabled = disabled;
  };
  setDisabled(true);

  root.append(out, slider, zoomIn);
  host.appendChild(root);
  return {
    root,
    slider,
    enable(newMaxScale, scale) {
      maxScale = newMaxScale;
      slider.max = String(newMaxScale);
      slider.value = String(scale);
      setDisabled(false);
    },
    setValue(scale) {
      slider.value = String(scale);
    },
  };
}
