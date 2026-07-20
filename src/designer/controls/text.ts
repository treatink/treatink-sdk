import type { CopyStrings } from '../../types.js';

/**
 * Personalization-text control (P2-T09, Charter §7.2/§12): opt-in toggle + input. Channel voice
 * comes via copy.personalizationTextLabel (Riley's: "Include Pet Name on Label"). Length cap =
 * template.maxTextLength ?? config.maxPersonalizationLength (docs/10 §5); visual auto-shrink still
 * applies in the engine. One style per template — no font controls.
 */

export interface TextHooks {
  onChange(enabled: boolean, value: string): void;
}

export interface TextControl {
  root: HTMLElement;
  setMaxLength(max: number): void;
}

export function mountText(
  doc: Document,
  host: HTMLElement,
  copy: Pick<CopyStrings, 'personalizationTextLabel' | 'personalizationTextPlaceholder'>,
  initial: { value?: string; enabled?: boolean; maxLength: number },
  hooks: TextHooks,
): TextControl {
  const root = doc.createElement('div');
  root.className = 'tk-text';

  const toggleLabel = doc.createElement('label');
  toggleLabel.className = 'tk-text-toggle';
  const toggle = doc.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'tk-text-checkbox';
  const labelText = doc.createElement('span');
  labelText.textContent = copy.personalizationTextLabel;
  toggleLabel.append(toggle, labelText);

  const input = doc.createElement('input');
  input.type = 'text';
  input.className = 'tk-text-input';
  input.placeholder = copy.personalizationTextPlaceholder;
  input.setAttribute('aria-label', copy.personalizationTextLabel);
  input.maxLength = initial.maxLength;
  if (initial.value) input.value = initial.value.slice(0, initial.maxLength);
  toggle.checked = initial.enabled ?? false; // draft re-open restores the toggle (P3-T04)
  input.hidden = !toggle.checked;

  const emit = () => hooks.onChange(toggle.checked, input.value);
  toggle.addEventListener('change', () => {
    input.hidden = !toggle.checked;
    if (toggle.checked) input.focus();
    emit();
  });
  input.addEventListener('input', emit);

  root.append(toggleLabel, input);
  host.appendChild(root);
  return {
    root,
    setMaxLength(max) {
      input.maxLength = max;
      if (input.value.length > max) {
        input.value = input.value.slice(0, max);
        emit();
      }
    },
  };
}
