import { resolveCopy } from './copy.js';
import { mountUpload } from './controls/upload.js';
import { mountModal } from './modal.js';
import type { ModalHandles } from './modal.js';
import { applyTheme, resolveTheme } from './theme.js';
import { computeInitialFit, renderComposite } from '../cutout-engine/index.js';
import type { CanvasLike, EditorImage } from '../cutout-engine/index.js';
import type { LoadedPhoto } from '../media/exif.js';
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
  canvas: HTMLCanvasElement;
  photo: LoadedPhoto | null;
  editor: EditorImage | null;
}

let active: ActiveDesigner | null = null;

/** Re-render the 900×1200 preview from current state (docs/05 §6). Cutout arrives in P2-T08. */
function render(state: ActiveDesigner): void {
  renderComposite(state.canvas as unknown as CanvasLike, {
    images: state.editor ? [state.editor] : [],
    resolveDrawable: () => state.photo?.image,
  });
}

function acceptPhoto(state: ActiveDesigner, photo: LoadedPhoto): void {
  if (state.photo) URL.revokeObjectURL(state.photo.objectUrl);
  state.photo = photo;
  // Fresh upload → the store's initial fit (docs/05 §3); naturalWidth/Height are EXIF-upright.
  state.editor = {
    id: crypto.randomUUID(),
    ...computeInitialFit(photo.naturalWidth, photo.naturalHeight),
  };
  // Oriented dimensions exposed for tests/AT context.
  state.canvas.dataset['naturalWidth'] = String(photo.naturalWidth);
  state.canvas.dataset['naturalHeight'] = String(photo.naturalHeight);
  render(state);
}

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

  // Preview canvas — the fixed 900×1200 edit==print space (docs/05 §0), CSS-scaled to fit.
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  canvas.className = 'tk-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', copy.headerTitle);
  handles.preview.appendChild(canvas);

  const state: ActiveDesigner = { handles, options, context, canvas, photo: null, editor: null };
  active = state;

  const surfaceError = (error: TreatinkError) => {
    options.onError?.(error);
    context.emit('error', error);
  };
  mountUpload(document, handles.controls, copy, {
    onPhoto: (photo) => acceptPhoto(state, photo),
    onError: surfaceError,
  });

  handles.closeButton.addEventListener('click', () => closeDesigner());
  context.emit('designer:open', { sku: options.sku });
}

export function closeDesigner(): void {
  if (!active) return;
  const { handles, options, context, photo } = active;
  active = null;
  if (photo) URL.revokeObjectURL(photo.objectUrl);
  handles.unmount();
  options.onClose?.();
  context.emit('designer:close', { sku: options.sku });
}
