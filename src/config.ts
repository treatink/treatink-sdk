import { TreatinkError } from './types.js';
import type { TreatinkConfig } from './types.js';

/**
 * Init-time config validation + the key-prefix guard (Charter §10.1, docs/04 §2.1, docs/11 §1).
 * The browser build accepts ONLY publishable keys. Keep the accepted-prefix list in ONE place so a
 * rename is a single edit.
 *
 * Implemented by: P1-T04.
 */

export const ACCEPTED_KEY_PREFIXES = ['pk_test_', 'pk_live_'] as const;
export const DEFAULT_API_BASE_URL = 'https://api.treatink.com';
export const DEFAULT_MAX_PERSONALIZATION_LENGTH = 20;

export interface ResolvedConfig extends Required<Pick<TreatinkConfig, 'channel'>> {
  apiKey: string;
  channel: string;
  mode: 'live' | 'fixtures';
  apiBaseUrl: string;
  maxPersonalizationLength: number;
  debug: boolean;
  theme: NonNullable<TreatinkConfig['theme']>;
  copy: NonNullable<TreatinkConfig['copy']>;
}

/** Throws TreatinkError('key_scope_violation') for any non-publishable key. */
export function assertPublishableKey(apiKey: string): void {
  const ok = ACCEPTED_KEY_PREFIXES.some((p) => apiKey.startsWith(p));
  if (!ok) {
    throw new TreatinkError(
      'key_scope_violation',
      'Treatink.init requires a publishable key (pk_test_… or pk_live_…). ' +
        'Secret keys must never be used in the browser.',
    );
  }
}

export function resolveConfig(_config: TreatinkConfig): ResolvedConfig {
  // P1-T04: validate apiKey (assertPublishableKey) + channel present, apply defaults
  // (mode:'fixtures', apiBaseUrl, maxPersonalizationLength), merge theme/copy defaults.
  throw new TreatinkError('not_implemented', 'resolveConfig: implemented in P1-T04');
}
