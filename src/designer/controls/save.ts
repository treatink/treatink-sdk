import { TreatinkError } from '../../types.js';
import type { CopyStrings } from '../../types.js';

/**
 * Save CTA (P2-T11): in-flight + error states; success is signalled by the designer closing.
 * P2 saves locally (composite → onComplete); the real upload-on-save pipeline lands in P3-T01,
 * and the full failure/retry UX in P3-T02 — this control already re-enables for retry.
 */

export interface SaveHooks {
  onSave(): Promise<void>;
  onError(error: TreatinkError): void;
}

export interface SaveControl {
  root: HTMLElement;
  setEnabled(enabled: boolean): void;
}

export function mountSave(
  doc: Document,
  host: HTMLElement,
  copy: Pick<CopyStrings, 'saveButton' | 'savingLabel' | 'saveErrorRetry' | 'genericError'>,
  hooks: SaveHooks,
): SaveControl {
  const root = doc.createElement('div');
  root.className = 'tk-save';

  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'tk-save-button';
  button.textContent = copy.saveButton;
  button.disabled = true;

  const error = doc.createElement('p');
  error.className = 'tk-save-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = copy.savingLabel;
    error.hidden = true;
    hooks
      .onSave()
      .catch((cause: unknown) => {
        const err =
          cause instanceof TreatinkError
            ? cause
            : new TreatinkError('bad_request', copy.genericError, { cause });
        error.textContent = copy.saveErrorRetry;
        error.hidden = false;
        hooks.onError(err);
      })
      .finally(() => {
        button.textContent = copy.saveButton;
        button.disabled = false;
      });
  });

  root.append(button, error);
  host.appendChild(root);
  return {
    root,
    setEnabled(enabled) {
      button.disabled = !enabled;
    },
  };
}
