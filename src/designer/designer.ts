import { resolveCopy } from './copy.js';
import { mountUpload } from './controls/upload.js';
import { mountZoom } from './controls/zoom.js';
import type { ZoomControl } from './controls/zoom.js';
import { mountModal } from './modal.js';
import type { ModalHandles } from './modal.js';
import { applyTheme, resolveTheme } from './theme.js';
import {
  computeInitialFit,
  computeLowRes,
  dragMove,
  dragStart,
  exportArtifacts,
  hitTest,
  pointerToCanvas,
  renderComposite,
  toPersistedTransform,
} from '../cutout-engine/index.js';
import type { CanvasLike, EditorImage, EngineEnv } from '../cutout-engine/index.js';
import type { LoadedPhoto } from '../media/exif.js';
import { mountCutouts } from './controls/cutouts.js';
import { mountSave } from './controls/save.js';
import type { SaveControl } from './controls/save.js';
import { mountText } from './controls/text.js';
import type { TextControl } from './controls/text.js';
import { ensureLabelFont } from './font.js';
import { PET_NAME_POSITIONS } from '../cutout-engine/index.js';
import { TreatinkError } from '../types.js';
import type {
  CopyStrings,
  DesignerOptions,
  DesignerResult,
  Page as PageOf,
  Product,
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
  /** The product (variant+family) — mockup image + label_zone back the display preview (docs/05 §8.1). */
  getProduct: (sku: string) => Promise<Product>;
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
  lowRes: boolean;
  lowResWarning: HTMLElement | null;
  lowResCopy: string;
  save: SaveControl | null;
  product: Product | null;
  mockup: { drawable: HTMLImageElement; width: number; height: number } | null;
}

/** Browser EngineEnv: DOM canvas + toBlob, injected at the edge (docs/01 §6). */
const BROWSER_ENV: EngineEnv = {
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as CanvasLike;
  },
  toBlob(canvas) {
    const element = canvas as unknown as HTMLCanvasElement;
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (blob: Blob | null, error?: unknown) => {
        if (settled) return;
        settled = true;
        if (blob) resolve(blob);
        else reject(error instanceof Error ? error : new Error('canvas encode failed'));
      };
      element.toBlob((blob) => settle(blob), 'image/png'); // full quality, like the store (docs/05 §8)
      // Chromium can defer the toBlob encode callback for MANY seconds after FontFace text has
      // been drawn (observed ~7 s). If it stalls, fall back to the synchronous encoder.
      setTimeout(() => {
        if (settled) return;
        try {
          const dataUrl = element.toDataURL('image/png');
          const bytes = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
          const buffer = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
          settle(new Blob([buffer], { type: 'image/png' }));
        } catch (error) {
          settle(null, error);
        }
      }, 1500);
    });
  },
};

/** Save/close both consult this: photo + cutout are required for a save (P2-T11). */
function canSave(state: ActiveDesigner): boolean {
  return Boolean(state.photo && state.editor && state.cutout);
}

/**
 * P2-T11: local save — engine export → DesignerResult → onComplete → close. previewUrl is a LOCAL
 * object URL of the display composite (GP-08); artwork ids stay empty placeholders until the
 * upload-on-save pipeline (P3-T01) fills them.
 */
async function saveLocal(state: ActiveDesigner): Promise<void> {
  const { photo, editor, cutout, options, context } = state;
  if (!photo || !editor || !cutout) {
    throw new TreatinkError('bad_request', 'Add a photo and choose a cutout before saving.');
  }
  const value = state.text.value.trim();
  const includeText = state.text.enabled && value !== '';
  if (includeText && !state.fontReady) {
    await ensureLabelFont(document);
    state.fontReady = true;
  }

  const artifacts = await exportArtifacts({
    env: BROWSER_ENV,
    image: editor,
    photo: photo.image,
    photoNatural: { width: photo.naturalWidth, height: photo.naturalHeight },
    cutout: cutout.image,
    text: includeText
      ? {
          text: value,
          framePosition: cutout.template.petNamePosition,
          theme: cutout.template.theme,
        }
      : null,
    source: photo.file,
    mockup: state.mockup,
    labelZone: state.product?.labelZone ?? null,
  });

  const result: DesignerResult = {
    draftId: crypto.randomUUID(), // UUID v4 — also the idempotency token (docs/10 §4)
    sku: options.sku,
    ...(state.product ? { variantId: state.product.variantId } : {}),
    cutoutLabelId: cutout.template.cutoutLabelId,
    personalizationText: includeText ? value : null,
    petNamePosition: cutout.template.petNamePosition,
    previewUrl: URL.createObjectURL(artifacts.display),
    artwork: { sourceAssetId: '', renderedAssetId: '' }, // P3-T01 fills the real ast_ ids
    transform: toPersistedTransform(editor),
    // Interpreting context for the display composite; full-canvas for no-zone products.
    labelZone: state.product?.labelZone ?? { x: 0, y: 0, width: 1, height: 1 },
    lowRes: artifacts.lowRes,
  };

  options.onComplete?.(result);
  // NB: no 'draft:saved' here — that event belongs to the drafts store (P3-T03); nothing persists yet.
  void context;
  closeDesigner();
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

  // Low-res flag (Charter D.8, P2-T10): non-blocking warning, announced politely to AT.
  const lowRes =
    state.editor && state.photo
      ? computeLowRes(state.editor, {
          width: state.photo.naturalWidth,
          height: state.photo.naturalHeight,
        })
      : false;
  if (lowRes !== state.lowRes) {
    state.lowRes = lowRes;
    if (state.lowResWarning) state.lowResWarning.hidden = !lowRes;
    state.handles.liveRegion.textContent = lowRes ? state.lowResCopy : '';
  }

  state.save?.setEnabled(canSave(state)); // photo + cutout required; low-res never blocks
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
    lowRes: false,
    lowResWarning: null,
    lowResCopy: copy.lowResWarning,
    save: null,
    product: null,
    mockup: null,
  };
  active = state;

  // Product (variant+family) backs the display-composite preview; failures are non-fatal —
  // the preview falls back to the bare print composite (docs/05 §8.1).
  void context
    .getProduct(options.sku)
    .then((product) => {
      state.product = product;
      const mockup = new Image();
      mockup.crossOrigin = 'anonymous'; // mockup must be CORS-readable (docs/05 §8.1)
      mockup.src = product.images.catalogImageUrl;
      return mockup.decode().then(() => {
        state.mockup = {
          drawable: mockup,
          width: mockup.naturalWidth,
          height: mockup.naturalHeight,
        };
      });
    })
    .catch(() => undefined);

  // Low-res warning line under the preview (hidden until the flag trips).
  const lowResWarning = document.createElement('p');
  lowResWarning.className = 'tk-lowres';
  lowResWarning.textContent = copy.lowResWarning;
  lowResWarning.hidden = true;
  handles.preview.appendChild(lowResWarning);
  state.lowResWarning = lowResWarning;

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

  state.save = mountSave(document, handles.controls, copy, {
    onSave: () => saveLocal(state),
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
