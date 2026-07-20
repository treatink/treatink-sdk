import { loadOrientedPhoto } from '../../media/exif.js';
import type { LoadedPhoto } from '../../media/exif.js';
import { TreatinkError } from '../../types.js';
import type { CopyStrings } from '../../types.js';

/**
 * Photo input (P2-T05, Charter §7.2): drag-and-drop zone + "Or Select Image" picker, validation,
 * EXIF-upright ingest. Emits the loaded photo to the designer; error surfacing stays in the UI
 * (.tk-upload-error) AND flows to onError/'error' via the callback.
 */

export interface UploadHooks {
  onPhoto(photo: LoadedPhoto): void;
  onError(error: TreatinkError): void;
}

export interface UploadControl {
  root: HTMLElement;
  /** Show/clear the inline error line. */
  setError(message: string | null): void;
}

export function mountUpload(
  doc: Document,
  host: HTMLElement,
  copy: Pick<CopyStrings, 'uploadPrompt' | 'uploadButton' | 'genericError'>,
  hooks: UploadHooks,
): UploadControl {
  const root = doc.createElement('div');
  root.className = 'tk-upload';

  const dropzone = doc.createElement('div');
  dropzone.className = 'tk-dropzone';
  const prompt = doc.createElement('p');
  prompt.className = 'tk-upload-prompt';
  prompt.textContent = copy.uploadPrompt;

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
      hooks.onPhoto(await loadOrientedPhoto(file));
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
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('tk-dropzone-active');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('tk-dropzone-active'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('tk-dropzone-active');
    void ingest(event.dataTransfer?.files?.[0]);
  });

  function setError(message: string | null): void {
    error.hidden = message === null;
    error.textContent = message ?? '';
  }

  dropzone.append(prompt, button, input);
  root.append(dropzone, error);
  host.appendChild(root);
  return { root, setError };
}
