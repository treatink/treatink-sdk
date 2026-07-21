import type { CopyStrings } from '../types.js';

/**
 * Every user-visible designer string, all overridable via init `copy` (docs/10 §8, Charter §7.3).
 * Channel voice lives here — e.g. Riley's sets personalizationTextLabel to
 * "Include Pet Name on Label".
 */
export const DEFAULT_COPY: CopyStrings = {
  headerTitle: 'Personalize Your Product',
  closeLabel: 'Close',
  uploadPrompt: "Drag your pet's photo here\nand start personalizing!", // store two-line prompt
  uploadButton: 'Or Select Image',
  zoomInLabel: 'Zoom in', // compat only — no −/+ buttons (VP-03)
  zoomOutLabel: 'Zoom out', // compat only — no −/+ buttons (VP-03)
  zoomSliderLabel: 'Zoom',
  categoryAll: 'Browse All',
  imageControlsLabel: 'Image Controls',
  rotateLeftLabel: 'Rotate Left',
  rotateRightLabel: 'Rotate Right',
  deleteImageLabel: 'Delete Image',
  cutoutsLabel: 'Choose Your Background',
  browseAllTitle: 'Browse All Backgrounds',
  searchPlaceholder: 'Search',
  noCutoutsFound: 'No backgrounds found',
  personalizationTextLabel: 'Include Pet Name on Label', // store default (docs/13 §5.2)
  personalizationTextPlaceholder: 'Pet Name',
  lowResWarning: 'This photo is low resolution — the printed label may look blurry.',
  saveButton: 'Save Customization',
  savingLabel: 'Saving...', // store spelling (three dots)
  saveErrorRetry: 'Upload failed. Check your connection and try again.',
  genericError: 'Something went wrong. Please try again.',
};

export function resolveCopy(overrides: Partial<CopyStrings>): CopyStrings {
  return { ...DEFAULT_COPY, ...overrides };
}
