import { resolveCopy } from './copy.js';
import { mountModal } from './modal.js';
import type { ModalHandles } from './modal.js';
import { applyTheme, resolveTheme } from './theme.js';
import { TreatinkError } from '../types.js';
import type { CopyStrings, DesignerOptions, ThemeConfig, TreatinkEvent } from '../types.js';

/**
 * Designer lifecycle (P2-T01): open/close, SINGLE-instance guard, designer:open/close events.
 * This module is the lazy "designer chunk" — the loader pulls it on first open() (docs/06 §2).
 * Theming/copy resolution (P2-T04) happens here; controls/engine wiring arrive with P2-T05…T11.
 */

export interface DesignerContext {
  copy: Partial<CopyStrings>;
  theme: ThemeConfig;
  emit: (event: TreatinkEvent, payload: unknown) => void;
}

interface ActiveDesigner {
  handles: ModalHandles;
  options: DesignerOptions;
  context: DesignerContext;
}

let active: ActiveDesigner | null = null;

export function openDesigner(context: DesignerContext, options: DesignerOptions): void {
  if (active) {
    // Charter §7.1: opening a second modal while one is live is rejected.
    const error = new TreatinkError(
      'bad_request',
      'A designer modal is already open — close it before opening another.',
    );
    options.onError?.(error);
    context.emit('error', error);
    return;
  }

  const copy = resolveCopy(context.copy);
  const handles = mountModal(
    document,
    { headerTitle: copy.headerTitle, closeLabel: copy.closeLabel },
    { onRequestClose: () => closeDesigner() },
  );
  applyTheme(handles.overlay, resolveTheme(context.theme));
  active = { handles, options, context };

  handles.closeButton.addEventListener('click', () => closeDesigner());
  context.emit('designer:open', { sku: options.sku });
}

export function closeDesigner(): void {
  if (!active) return;
  const { handles, options, context } = active;
  active = null;
  handles.unmount();
  options.onClose?.();
  context.emit('designer:close', { sku: options.sku });
}
