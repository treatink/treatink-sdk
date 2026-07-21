import { assertIngestableSize, loadOrientedPhoto } from '../../media/exif.js';
import type { LoadedPhoto } from '../../media/exif.js';
import { isHeic, transcodeHeicToJpeg } from '../../media/heic.js';
import { TreatinkError } from '../../types.js';
import type { CopyStrings } from '../../types.js';

/**
 * Photo input (P2-T05 → P5-T03, docs/13 §4): the store's on-canvas empty state — upload icon +
 * two-line prompt + purple "Or Select Image" pill, overlaid on the canvas frame; the FRAME is the
 * drop target (store PetCustomizer.jsx:606-666). Validation + EXIF-upright ingest unchanged.
 * Errors surface inline (.tk-upload-error) AND flow to onError/'error' via the callback.
 */

export interface UploadHooks {
  onPhoto(photo: LoadedPhoto): void;
  onError(error: TreatinkError): void;
}

export interface UploadControl {
  root: HTMLElement;
  /** Show/clear the inline error line. */
  setError(message: string | null): void;
  /** Toggle the empty-state overlay (hidden once a photo is accepted; back after delete). */
  setVisible(visible: boolean): void;
}

/** Store icons/upload.svg (cloud + arrow), fill switched to currentColor so it tints from
 *  --tk-accent (docs/13 §7). Built via DOM APIs — no innerHTML (docs/11 §3). */
const UPLOAD_ICON_PATHS = [
  'M32.3936 28.6874C32.3468 28.6277 32.287 28.5794 32.2188 28.5461C32.1506 28.5129 32.0757 28.4956 31.9998 28.4956C31.9239 28.4956 31.849 28.5129 31.7808 28.5461C31.7126 28.5794 31.6528 28.6277 31.6061 28.6874L24.6061 37.5437C24.5484 37.6174 24.5126 37.7058 24.5027 37.7989C24.4929 37.892 24.5095 37.986 24.5506 38.0701C24.5917 38.1542 24.6556 38.225 24.735 38.2745C24.8145 38.324 24.9062 38.3501 24.9998 38.3499H29.6186V53.4999C29.6186 53.7749 29.8436 53.9999 30.1186 53.9999H33.8686C34.1436 53.9999 34.3686 53.7749 34.3686 53.4999V38.3562H38.9998C39.4186 38.3562 39.6498 37.8749 39.3936 37.5499L32.3936 28.6874Z',
  'M50.7125 22.9188C47.85 15.3688 40.5563 10 32.0125 10C23.4688 10 16.175 15.3625 13.3125 22.9125C7.95625 24.3188 4 29.2 4 35C4 41.9062 9.59375 47.5 16.4937 47.5H19C19.275 47.5 19.5 47.275 19.5 47V43.25C19.5 42.975 19.275 42.75 19 42.75H16.4937C14.3875 42.75 12.4062 41.9125 10.9312 40.3937C9.4625 38.8812 8.68125 36.8438 8.75 34.7313C8.80625 33.0813 9.36875 31.5312 10.3875 30.225C11.4312 28.8938 12.8938 27.925 14.5188 27.4937L16.8875 26.875L17.7563 24.5875C18.2938 23.1625 19.0437 21.8313 19.9875 20.625C20.9192 19.4294 22.0228 18.3784 23.2625 17.5063C25.8313 15.7 28.8563 14.7437 32.0125 14.7437C35.1688 14.7437 38.1938 15.7 40.7625 17.5063C42.0063 18.3813 43.1062 19.4312 44.0375 20.625C44.9812 21.8313 45.7313 23.1687 46.2687 24.5875L47.1312 26.8687L49.4938 27.4937C52.8813 28.4062 55.25 31.4875 55.25 35C55.25 37.0688 54.4438 39.0188 52.9813 40.4813C52.264 41.2027 51.4108 41.7747 50.471 42.1641C49.5312 42.5535 48.5235 42.7527 47.5062 42.75H45C44.725 42.75 44.5 42.975 44.5 43.25V47C44.5 47.275 44.725 47.5 45 47.5H47.5062C54.4062 47.5 60 41.9062 60 35C60 29.2062 56.0563 24.3313 50.7125 22.9188Z',
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function createUploadIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', '64');
  svg.setAttribute('height', '64');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('tk-upload-icon');
  for (const d of UPLOAD_ICON_PATHS) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
  }
  return svg;
}

export function mountUpload(
  doc: Document,
  /** The canvas frame (docs/13 §4) — hosts the overlay AND is the drop target. */
  frame: HTMLElement,
  copy: Pick<CopyStrings, 'uploadPrompt' | 'uploadButton' | 'genericError'>,
  hooks: UploadHooks,
): UploadControl {
  const overlay = doc.createElement('div');
  overlay.className = 'tk-upload-overlay';

  const prompt = doc.createElement('p');
  prompt.className = 'tk-upload-prompt';
  prompt.textContent = copy.uploadPrompt; // '\n' renders as a line break (white-space: pre-line)

  const input = doc.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.className = 'tk-file-input tk-visually-hidden';
  input.setAttribute('aria-label', copy.uploadButton);
  input.tabIndex = -1; // keyboard users go through the visible button; the input is its proxy

  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'tk-upload-button';
  button.textContent = copy.uploadButton;
  button.addEventListener('click', () => input.click());

  const error = doc.createElement('p');
  error.className = 'tk-upload-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const ingest = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    try {
      // HEIC transcodes to JPEG first (lazy decoder chunk, P2-T06). Size-check the ORIGINAL
      // before decoding; the decoded JPEG then flows through the normal ingest validation.
      let ingestable: Blob & { type: string } = file;
      if (isHeic(file)) {
        assertIngestableSize(file);
        ingestable = await transcodeHeicToJpeg(file);
      }
      hooks.onPhoto(await loadOrientedPhoto(ingestable));
    } catch (cause) {
      const err =
        cause instanceof TreatinkError
          ? cause
          : new TreatinkError('unsupported_file_type', copy.genericError, { cause });
      setError(err.message);
      hooks.onError(err);
    }
  };

  input.addEventListener('change', () => {
    void ingest(input.files?.[0]);
    input.value = ''; // allow re-selecting the same file
  });
  // The whole canvas frame accepts drops, photo present or not (store wrapper onDrop).
  frame.addEventListener('dragover', (event) => event.preventDefault());
  frame.addEventListener('drop', (event) => {
    event.preventDefault();
    void ingest(event.dataTransfer?.files?.[0]);
  });

  function setError(message: string | null): void {
    error.hidden = message === null;
    error.textContent = message ?? '';
  }

  overlay.append(createUploadIcon(doc), prompt, button, error, input);
  frame.appendChild(overlay);
  return {
    root: overlay,
    setError,
    setVisible(visible: boolean): void {
      overlay.hidden = !visible;
    },
  };
}
