import { resolveCopy } from './copy.js';
import { mountImageControls } from './controls/image-controls.js';
import type { ImageControlsControl } from './controls/image-controls.js';
import { mountUpload } from './controls/upload.js';
import type { UploadControl } from './controls/upload.js';
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
  hitTest,
  pointerToCanvas,
  renderComposite,
  restoreImage,
} from '../cutout-engine/index.js';
import { runSavePipeline } from '../save/pipeline.js';
import type { CanvasLike, EditorImage, EngineEnv } from '../cutout-engine/index.js';
import type { LoadedPhoto } from '../media/exif.js';
import { mountCutouts } from './controls/cutouts.js';
import type { CutoutsControl } from './controls/cutouts.js';
import { mountSave } from './controls/save.js';
import type { SaveControl } from './controls/save.js';
import { mountText } from './controls/text.js';
import type { TextControl } from './controls/text.js';
import { ensureLabelFont } from './font.js';
import { PET_NAME_POSITIONS } from '../cutout-engine/index.js';
import { TreatinkError } from '../types.js';
import type {
  Asset,
  AssetRole,
  CopyStrings,
  DesignerOptions,
  DesignerResult,
  DraftRecord,
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
  /** The two-step asset upload (docs/08 §6) — backs the save pipeline (P3-T01). */
  uploadArtwork: (input: { role: AssetRole; file: Blob }) => Promise<Asset>;
  /** Persist the reference DraftRecord + emit draft:saved — only after a successful save (P3-T03). */
  saveDraft: (result: DesignerResult) => void;
  /** Look up a saved draft for re-open (P3-T04). */
  getDraft: (draftId: string) => DraftRecord | null;
}

interface ActiveDesigner {
  handles: ModalHandles;
  options: DesignerOptions;
  context: DesignerContext;
  canvas: HTMLCanvasElement;
  /** The dashed 3:4 wrapper — drop target + cursor surface (docs/13 §4). */
  frame: HTMLElement;
  upload: UploadControl | null;
  imageControls: ImageControlsControl | null;
  cutouts: CutoutsControl | null;
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
  /** Draft transform awaiting the re-selected photo (P3-T04); consumed on first accept. */
  restoredTransform: DraftRecord['transform'] | null;
  /** Spinner over the canvas until the first cutout renders (removed once, then null). */
  canvasLoading: HTMLElement | null;
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
 * Save (P3-T01): the upload-on-save pipeline — engine export → two-asset upload (source +
 * rendered, real ast_ ids) → local previewUrl → onComplete → close. Asset-based, no sessions.
 */
async function save(state: ActiveDesigner): Promise<void> {
  const { photo, editor, cutout, options } = state;
  if (!photo || !editor || !cutout) {
    throw new TreatinkError('bad_request', 'Add a photo and choose a cutout before saving.');
  }
  const value = state.text.value.trim();
  const includeText = state.text.enabled && value !== '';
  if (includeText && !state.fontReady) {
    await ensureLabelFont(document);
    state.fontReady = true;
  }

  const result = await runSavePipeline({
    env: BROWSER_ENV,
    sku: options.sku,
    editor,
    photo: {
      drawable: photo.image,
      naturalWidth: photo.naturalWidth,
      naturalHeight: photo.naturalHeight,
      file: photo.file,
    },
    cutout: { template: cutout.template, drawable: cutout.image },
    text: includeText
      ? {
          text: value,
          framePosition: cutout.template.petNamePosition,
          theme: cutout.template.theme,
        }
      : null,
    product: state.product,
    mockup: state.mockup,
    upload: state.context.uploadArtwork,
  });

  state.context.saveDraft(result); // reference record + draft:saved event (P3-T03)
  options.onComplete?.(result);
  closeDesigner();
}

let active: ActiveDesigner | null = null;

/** Re-render the 900×1200 preview from current state (docs/05 §6). Cutout arrives in P2-T08. */
function render(state: ActiveDesigner): void {
  // First content on the canvas ends the loading state.
  if (state.canvasLoading && (state.cutout || state.photo)) {
    state.canvasLoading.remove();
    state.canvasLoading = null;
  }
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
    state.canvas.dataset['rotation'] = String(state.editor.rotation);
  }
  state.canvas.dataset['cutout'] = state.cutout?.template.cutoutLabelId ?? '';
  state.canvas.dataset['textY'] = showText
    ? String(PET_NAME_POSITIONS[state.cutout?.template.petNamePosition ?? 'default'])
    : '';

  // Low-res flag (Charter D.8, P2-T10): still computed and returned in DesignerResult.lowRes,
  // and exposed as data-lowres for tests — but the visible banner + AT announcement are
  // SUPPRESSED for now (owner 2026-07-21). Re-enable by restoring the hidden/liveRegion toggles.
  const lowRes =
    state.editor && state.photo
      ? computeLowRes(state.editor, {
          width: state.photo.naturalWidth,
          height: state.photo.naturalHeight,
        })
      : false;
  state.lowRes = lowRes;
  state.canvas.dataset['lowres'] = String(lowRes);

  state.save?.setEnabled(canSave(state)); // photo + cutout required; low-res never blocks
}

/** Load the selected cutout's mask PNG, then re-render with it on top. */
async function selectCutout(state: ActiveDesigner, template: Template): Promise<void> {
  const image = new Image();
  // Live masks are served cross-origin (storage/CDN). Without CORS opt-in the canvas would TAINT
  // and toBlob() would throw at save (docs/05 §8.1 — the mask host must send CORS headers, like
  // the mockup). Fixtures (same-origin/blob) are unaffected.
  image.crossOrigin = 'anonymous';
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
    state.frame.classList.add('tk-dragging'); // store: cursor grabbing while dragging
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
    state.frame.classList.remove('tk-dragging');
    render(state);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

/** Delete (store deleteImageHandler): back to the empty state; the design survives cutout-only. */
function deletePhoto(state: ActiveDesigner): void {
  if (!state.photo) return;
  URL.revokeObjectURL(state.photo.objectUrl);
  state.photo = null;
  state.editor = null;
  delete state.canvas.dataset['x'];
  delete state.canvas.dataset['y'];
  delete state.canvas.dataset['scale'];
  delete state.canvas.dataset['rotation'];
  delete state.canvas.dataset['naturalWidth'];
  delete state.canvas.dataset['naturalHeight'];
  state.zoom?.disable();
  state.imageControls?.setVisible(false); // store: card exists only with a photo
  state.upload?.setVisible(true); // the empty-state overlay returns
  state.cutouts?.setPhoto(null); // thumbs drop the photo layer
  render(state);
}

function acceptPhoto(state: ActiveDesigner, photo: LoadedPhoto): void {
  if (state.photo) URL.revokeObjectURL(state.photo.objectUrl);
  state.photo = photo;
  state.upload?.setVisible(false); // the empty-state overlay yields to the photo (docs/13 §4)
  state.imageControls?.setVisible(true);
  state.cutouts?.setPhoto(photo.objectUrl); // thumbs live-preview the photo behind each frame
  const fit = computeInitialFit(photo.naturalWidth, photo.naturalHeight);
  if (state.restoredTransform) {
    // Draft re-open (P3-T04): fitted box + maxScale derive from the re-selected photo; the
    // draft's x/y/scale/rotation flow through the store's ||-fallback restore path (docs/05 §3).
    const restored = restoreImage(
      { ...state.restoredTransform, width: fit.width, height: fit.height, maxScale: fit.maxScale },
      photo.naturalWidth,
      photo.naturalHeight,
    );
    state.editor = { id: crypto.randomUUID(), ...restored };
    state.restoredTransform = null; // one-shot: a replacement photo re-fits fresh
  } else {
    // Fresh upload → the store's initial fit (docs/05 §3); naturalWidth/Height are EXIF-upright.
    state.editor = { id: crypto.randomUUID(), ...fit };
  }
  // Oriented dimensions exposed for tests/AT context.
  state.canvas.dataset['naturalWidth'] = String(photo.naturalWidth);
  state.canvas.dataset['naturalHeight'] = String(photo.naturalHeight);
  state.zoom?.enable(state.editor.maxScale, state.editor.scale, {
    width: state.editor.width,
    height: state.editor.height,
  });
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

  // A previous instance may still be fading out (animated close) — cut it instantly so exactly
  // one overlay ever exists for selectors, focus, and stacking.
  for (const closing of document.querySelectorAll('.tk-overlay.tk-closing')) closing.remove();

  // Draft re-open (P3-T04): restore METADATA — cutout, transform, text, zone. The photo is NOT
  // re-hydrated (no bytes stored; a pk key cannot GET the source asset back — docs/10 §6): the
  // shopper re-selects it; re-save creates a fresh draft + assets. Documented limitation.
  const draft = options.draftId ? context.getDraft(options.draftId) : null;
  const draftMissing = Boolean(options.draftId && !draft);
  const preselectCutoutId = options.cutoutLabelId ?? draft?.cutout.cutoutLabelId;

  const handles = mountModal(
    document,
    { headerTitle: copy.headerTitle, closeLabel: copy.closeLabel },
    { onRequestClose: () => closeDesigner() },
  );
  applyTheme(handles.overlay, resolveTheme(context.theme));

  // The store's canvas area (docs/13 §4): dashed 3:4 frame owns the border, drop surface, and
  // cursor; the fixed 900×1200 edit==print canvas (docs/05 §0) fills it, CSS-scaled.
  const frame = document.createElement('div');
  frame.className = 'tk-canvas-frame';
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  canvas.className = 'tk-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', copy.headerTitle);
  frame.appendChild(canvas);
  // Canvas loading state (owner 2026-07-22): visible until the first cutout renders (live
  // templates take a beat) — a full-frame shimmer, same treatment as the cutout skeletons.
  const canvasLoading = document.createElement('div');
  canvasLoading.className = 'tk-canvas-loading tk-skeleton';
  canvasLoading.setAttribute('role', 'status');
  canvasLoading.setAttribute('aria-label', copy.headerTitle);
  frame.appendChild(canvasLoading);
  handles.preview.appendChild(frame);

  const state: ActiveDesigner = {
    handles,
    options,
    context,
    canvas,
    frame,
    upload: null,
    imageControls: null,
    cutouts: null,
    photo: null,
    editor: null,
    isDragging: false,
    zoom: null,
    cutout: null,
    text: {
      enabled: Boolean(draft?.personalizationText),
      value: draft?.personalizationText ?? options.personalizationText ?? '',
    },
    textControl: null,
    fontReady: false,
    lowRes: false,
    lowResWarning: null,
    lowResCopy: copy.lowResWarning,
    save: null,
    product: null,
    mockup: null,
    restoredTransform: draft?.transform ?? null,
    canvasLoading,
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
  if (draftMissing) {
    // Unknown/expired draftId: surface not_found; the modal continues as a fresh design.
    surfaceError(
      new TreatinkError('not_found', 'The requested draft no longer exists.', { param: 'draftId' }),
    );
  }
  // Upload = the on-canvas empty state; the frame is the drop target (docs/13 §4).
  state.upload = mountUpload(document, frame, copy, {
    onPhoto: (photo) => acceptPhoto(state, photo),
    onError: surfaceError,
  });
  // Image-controls card (docs/13 §5.1): rotate ±15° + delete + the slider, hidden until a photo.
  state.imageControls = mountImageControls(document, handles.controls, copy, {
    onRotate: (degrees) => {
      if (!state.editor) return;
      state.editor.rotation += degrees; // additive, store customizerSlice.jsx:594-600 (VP-02)
      render(state);
    },
    onDelete: () => deletePhoto(state),
  });
  state.zoom = mountZoom(document, state.imageControls.sliderHost, copy, {
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
      ...(state.text.value ? { value: state.text.value } : {}),
      ...(state.text.enabled ? { enabled: true } : {}),
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
  state.cutouts = mountCutouts(
    document,
    handles.controls,
    copy,
    {
      sku: options.sku,
      // explicit option wins; else the re-opened draft's cutout (P3-T04)
      ...(preselectCutoutId ? { preselectId: preselectCutoutId } : {}),
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
    onSave: () => save(state),
    onError: surfaceError,
  });

  // If templates never arrive (load error), drop the canvas spinner — the error is surfaced.
  void state.cutouts.ready.finally(() => {
    setTimeout(() => {
      if (state.canvasLoading && !state.cutout) {
        state.canvasLoading.remove();
        state.canvasLoading = null;
      }
    }, 4000); // grace for the mask image decode after ready resolves
  });

  if (state.text.enabled) {
    // Restored text renders as soon as Mitr is ready (draft re-open).
    void ensureLabelFont(document)
      .then(() => {
        state.fontReady = true;
        render(state);
      })
      .catch(() => undefined);
  }

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
