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
  /** Polite live region for AT announcements (low-res warning etc., P2-T10). */
  liveRegion: HTMLElement;
  /** Remove the modal, undo the scroll lock, restore focus to the pre-open element. */
  unmount(): void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function mountModal(
  doc: Document,
  copy: ModalCopy,
  hooks: { onRequestClose: () => void },
): ModalHandles {
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

  // Polite live region — announcements (e.g. the low-res warning) without stealing focus.
  const liveRegion = doc.createElement('div');
  liveRegion.className = 'tk-live tk-visually-hidden';
  liveRegion.setAttribute('aria-live', 'polite');

  modal.append(header, body, liveRegion);
  overlay.appendChild(modal);

  // Focus management (Charter §7.3): remember the opener, trap Tab inside, Escape closes,
  // restore focus on unmount.
  const previouslyFocused = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hooks.onRequestClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = [...overlay.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const current = doc.activeElement;
    if (event.shiftKey && (current === first || !overlay.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !overlay.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  };
  overlay.addEventListener('keydown', onKeydown);

  // Scroll-lock the page behind (Charter §7.1); restore the exact prior value on unmount.
  const previousOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';
  doc.body.appendChild(overlay);
  closeButton.focus(); // initial focus lands inside the dialog

  return {
    overlay,
    preview,
    controls,
    closeButton,
    liveRegion,
    unmount() {
      overlay.removeEventListener('keydown', onKeydown);
      overlay.remove();
      doc.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    },
  };
}
