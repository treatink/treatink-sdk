import { createIcon } from '../icons.js';
import type { CopyStrings } from '../../types.js';

/**
 * The store's image-controls card (P5-T05, docs/13 §5.1, PetCustomizer.jsx:352-417): visible only
 * while a photo is present; label + rotate-left / rotate-right / delete icon buttons on the left,
 * the zoom slider (mounted by the designer via `sliderHost`) on the right. Rotation is ±15°
 * additive (store customizerSlice.jsx:594-600, VP-02). Buttons carry aria-labels + native title
 * tooltips (the store's unlabeled react-tooltip buttons are an I-06 accessibility fix).
 */

export interface ImageControlsHooks {
  onRotate(degrees: number): void;
  onDelete(): void;
}

export interface ImageControlsControl {
  root: HTMLElement;
  /** The designer mounts the zoom slider into this (store: slider-input inside the card). */
  sliderHost: HTMLElement;
  /** Card exists only while a photo is present (store: images.length > 0). */
  setVisible(visible: boolean): void;
}

export function mountImageControls(
  doc: Document,
  host: HTMLElement,
  copy: Pick<
    CopyStrings,
    'imageControlsLabel' | 'rotateLeftLabel' | 'rotateRightLabel' | 'deleteImageLabel'
  >,
  hooks: ImageControlsHooks,
): ImageControlsControl {
  const root = doc.createElement('div');
  root.className = 'tk-image-controls';
  root.hidden = true;

  const label = doc.createElement('span');
  label.className = 'tk-card-label';
  label.textContent = copy.imageControlsLabel;

  const row = doc.createElement('div');
  row.className = 'tk-icon-row';

  const iconButton = (
    className: string,
    icon: 'rotate-ccw' | 'rotate-cw' | 'trash',
    title: string,
    onClick: () => void,
  ) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = `tk-icon-button ${className}`;
    button.setAttribute('aria-label', title);
    button.title = title;
    button.appendChild(createIcon(doc, icon));
    button.addEventListener('click', onClick);
    return button;
  };

  row.append(
    iconButton('tk-rotate-left', 'rotate-ccw', copy.rotateLeftLabel, () => hooks.onRotate(-15)),
    iconButton('tk-rotate-right', 'rotate-cw', copy.rotateRightLabel, () => hooks.onRotate(15)),
    iconButton('tk-delete-image', 'trash', copy.deleteImageLabel, () => hooks.onDelete()),
  );

  // Owner layout (2026-07-21): stacked — label, then the buttons, then the slider (sliderHost).
  root.append(label, row);
  host.appendChild(root);

  return {
    root,
    sliderHost: root,
    setVisible(visible: boolean): void {
      root.hidden = !visible;
    },
  };
}
