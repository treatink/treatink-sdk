import { ensureStyles } from './styles.js';

/**
 * The portal modal shell (Charter §7.1): full overlay at document.body, branded header with a
 * close control, scroll-locked page behind, two-column body (preview left, controls right) that
 * stacks on mobile via the injected stylesheet. Full a11y scaffold (focus trap etc.) is P2-T03;
 * the dialog role + labels land here so the shell is announceable from day one.
 * All text via textContent — never innerHTML (docs/11 §3).
 */

export interface ModalCopy {
  headerTitle: string;
  closeLabel: string;
}

export interface ModalHandles {
  overlay: HTMLElement;
  preview: HTMLElement;
  controls: HTMLElement;
  closeButton: HTMLButtonElement;
  /** Remove the modal and undo the scroll lock. */
  unmount(): void;
}

export function mountModal(doc: Document, copy: ModalCopy): ModalHandles {
  ensureStyles(doc);

  const overlay = doc.createElement('div');
  overlay.className = 'tk-overlay';

  const modal = doc.createElement('div');
  modal.className = 'tk-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', copy.headerTitle);

  const header = doc.createElement('div');
  header.className = 'tk-header';
  const title = doc.createElement('div');
  title.className = 'tk-title';
  title.textContent = copy.headerTitle;
  const closeButton = doc.createElement('button');
  closeButton.className = 'tk-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', copy.closeLabel);
  closeButton.textContent = '×';
  header.append(title, closeButton);

  const body = doc.createElement('div');
  body.className = 'tk-body';
  const preview = doc.createElement('div');
  preview.className = 'tk-preview';
  const controls = doc.createElement('div');
  controls.className = 'tk-controls';
  body.append(preview, controls);

  modal.append(header, body);
  overlay.appendChild(modal);

  // Scroll-lock the page behind (Charter §7.1); restore the exact prior value on unmount.
  const previousOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';
  doc.body.appendChild(overlay);

  return {
    overlay,
    preview,
    controls,
    closeButton,
    unmount() {
      overlay.remove();
      doc.body.style.overflow = previousOverflow;
    },
  };
}
