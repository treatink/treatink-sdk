import { createIcon } from '../icons.js';
import { TreatinkError } from '../../types.js';
import type { CopyStrings } from '../../types.js';

/**
 * Save CTA (P2-T11 → P5-T09, docs/13 §5.4): the store's filled-orange Button — label left,
 * ArrowRight 30px on the right (justify-between); while saving the label swaps to savingLabel and
 * the arrow hides (store PetCustomizer.jsx:589-602). Errors surface in the designer's message
 * section (owner 2026-07-22); success is signalled by the designer closing; re-enables for retry.
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
  button.disabled = true;
  const label = doc.createElement('span');
  label.className = 'tk-save-label';
  label.textContent = copy.saveButton;
  const arrow = createIcon(doc, 'arrow-right', 30); // store: <ArrowRight size={30} />
  button.append(label, arrow);

  button.addEventListener('click', () => {
    button.disabled = true;
    label.textContent = copy.savingLabel;
    arrow.setAttribute('hidden', ''); // store hides the arrow while submitting
    hooks
      .onSave()
      .catch((cause: unknown) => {
        const err =
          cause instanceof TreatinkError
            ? cause
            : new TreatinkError('bad_request', copy.genericError, { cause });
        hooks.onError(err); // the designer's message section shows copy.saveErrorRetry
      })
      .finally(() => {
        label.textContent = copy.saveButton;
        arrow.removeAttribute('hidden');
        button.disabled = false;
      });
  });

  root.append(button);
  host.appendChild(root);
  return {
    root,
    setEnabled(enabled) {
      button.disabled = !enabled;
    },
  };
}
