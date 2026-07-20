import { resolveCopy } from './copy.js';
import { mountUpload } from './controls/upload.js';
import { mountZoom } from './controls/zoom.js';
import type { ZoomControl } from './controls/zoom.js';
import { mountModal } from './modal.js';
import type { ModalHandles } from './modal.js';
import { applyTheme, resolveTheme } from './theme.js';
import {
  computeInitialFit,
  dragMove,
  dragStart,
  hitTest,
  pointerToCanvas,
  renderComposite,
} from '../cutout-engine/index.js';
import type { CanvasLike, EditorImage } from '../cutout-engine/index.js';
import type { LoadedPhoto } from '../media/exif.js';
import { mountCutouts } from './controls/cutouts.js';
import { mountText } from './controls/text.js';
import type { TextControl } from './controls/text.js';
import { ensureLabelFont } from './font.js';
import { PET_NAME_POSITIONS } from '../cutout-engine/index.js';
import { TreatinkError } from '../types.js';
import type {
  CopyStrings,
  DesignerOptions,
  Page as PageOf,
  Template,
  ThemeConfig,
  TreatinkEvent,
} from '../types.js';

/**
 * Designer lifecycle (P2-T01): open/close, SINGLE-instance guard, designer:open/close events.
 * This module is the lazy "designer chunk" — the loader pulls it on first open() (docs/06 §2).
 * Theming/copy resolution (P2-T04) happens here; controls/engine wiring arrive with P2-T05…T11.
 */

export interface DesignerContext {
  copy: Partial<CopyStrings>;
  theme: ThemeConfig;
  emit: (event: TreatinkEvent, payload: unknown) => void;
  /** Fallback text cap when a template has no maxTextLength (docs/10 §5). */
  maxPersonalizationLength: number;
  /** Templates (cutout-labels) for the open SKU — transport-backed (docs/01 §4). */
  listTemplates: (params: {
    sku: string;
    limit?: number;
    cursor?: string;
  }) => Promise<PageOf<Template>>;
}

interface ActiveDesigner {
  handles: ModalHandles;
  options: DesignerOptions;
  context: DesignerContext;
  canvas: HTMLCanvasElement;
  photo: LoadedPhoto | null;
  editor: EditorImage | null;
  isDragging: boolean;
  zoom: ZoomControl | null;
  cutout: { template: Template; image: HTMLImageElement } | null;
  text: { enabled: boolean; value: string };
  textControl: TextControl | null;
  fontReady: boolean;
}

let active: ActiveDesigner | null = null;

/** Re-render the 900×1200 preview from current state (docs/05 §6). Cutout arrives in P2-T08. */
function render(state: ActiveDesigner): void {
  const value = state.text.value.trim();
  const showText = state.text.enabled && value !== '' && state.fontReady;
  renderComposite(state.canvas as unknown as CanvasLike, {
    images: state.editor ? [state.editor] : [],
    resolveDrawable: () => state.photo?.image,
    cutout: state.cutout?.image, // the frame PNG on top — its alpha is the mask (docs/05 §6)
    isDragging: state.isDragging, // dims the cutout to 0.6 while dragging (canvasRenderer.js:40)
    text: showText
      ? {
          text: value,
          ...(state.cutout ? { framePosition: state.cutout.template.petNamePosition } : {}),
          ...(state.cutout ? { theme: state.cutout.template.theme } : {}),
        }
      : null,
  });
  if (state.editor) {
    state.canvas.dataset['x'] = String(state.editor.x);
    state.canvas.dataset['y'] = String(state.editor.y);
    state.canvas.dataset['scale'] = String(state.editor.scale);
  }
  state.canvas.dataset['cutout'] = state.cutout?.template.cutoutLabelId ?? '';
  state.canvas.dataset['textY'] = showText
    ? String(PET_NAME_POSITIONS[state.cutout?.template.petNamePosition ?? 'default'])
    : '';
}

/** Load the selected cutout's mask PNG, then re-render with it on top. */
async function selectCutout(state: ActiveDesigner, template: Template): Promise<void> {
  const image = new Image();
  image.src = template.maskUrl;
  await image.decode();
  state.cutout = { template, image };
  // Text cap follows the template (fallback: config) — docs/10 §5.
  state.textControl?.setMaxLength(template.maxTextLength ?? state.context.maxPersonalizationLength);
  render(state);
}

/** Drag-to-pan (docs/05 §4, pointerHandlers.js): freeform, no clamp; scale-aware anchor. */
function wireDrag(state: ActiveDesigner): void {
  const { canvas } = state;
  let anchor: { x: number; y: number } | null = null;

  canvas.addEventListener('pointerdown', (event) => {
    if (!state.editor) return;
    const rect = canvas.getBoundingClientRect();
    const mouse = pointerToCanvas(event.clientX, event.clientY, rect);
    const hit = hitTest([state.editor], mouse.x, mouse.y);
    if (hit === null) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    anchor = dragStart(state.editor, mouse.x, mouse.y);
    state.isDragging = true;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!anchor || !state.editor) return;
    const rect = canvas.getBoundingClientRect();
    const mouse = pointerToCanvas(event.clientX, event.clientY, rect);
    const next = dragMove(state.editor, anchor, mouse.x, mouse.y);
    state.editor.x = next.x;
    state.editor.y = next.y;
    render(state);
  });
  const end = () => {
    if (!anchor) return;
    anchor = null;
    state.isDragging = false;
    render(state);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
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
  state.zoom?.enable(state.editor.maxScale, state.editor.scale);
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

  const state: ActiveDesigner = {
    handles,
    options,
    context,
    canvas,
    photo: null,
    editor: null,
    isDragging: false,
    zoom: null,
    cutout: null,
    text: { enabled: false, value: options.personalizationText ?? '' },
    textControl: null,
    fontReady: false,
  };
  active = state;

  const surfaceError = (error: TreatinkError) => {
    options.onError?.(error);
    context.emit('error', error);
  };
  mountUpload(document, handles.controls, copy, {
    onPhoto: (photo) => acceptPhoto(state, photo),
    onError: surfaceError,
  });
  state.zoom = mountZoom(document, handles.controls, copy, {
    onScale: (scale) => {
      if (!state.editor) return;
      state.editor.scale = scale;
      render(state);
    },
  });
  wireDrag(state);
  state.textControl = mountText(
    document,
    handles.controls,
    copy,
    {
      ...(options.personalizationText ? { value: options.personalizationText } : {}),
      maxLength: context.maxPersonalizationLength,
    },
    {
      onChange: (enabled, value) => {
        state.text = { enabled, value };
        if (enabled && !state.fontReady) {
          // Mitr must be loaded BEFORE the fit loop measures (docs/05 §7) — lazy font chunk.
          void ensureLabelFont(document)
            .then(() => {
              state.fontReady = true;
              render(state);
            })
            .catch((cause: unknown) => {
              surfaceError(
                new TreatinkError('bad_request', 'The label font could not be loaded.', { cause }),
              );
            });
        }
        render(state);
      },
    },
  );
  mountCutouts(
    document,
    handles.controls,
    copy,
    {
      sku: options.sku,
      ...(options.cutoutLabelId ? { preselectId: options.cutoutLabelId } : {}),
      listTemplates: context.listTemplates,
    },
    {
      onSelect: (template) => {
        selectCutout(state, template).catch((cause: unknown) => {
          surfaceError(
            new TreatinkError('bad_request', 'The cutout image could not be loaded.', { cause }),
          );
        });
      },
      onError: surfaceError,
    },
  );

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
