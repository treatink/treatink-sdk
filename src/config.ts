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
/**
 * Owner update 2026-07-22: api.treatink.com is the legacy host; the current API lives at
 * treatinkapi.com (staging: staging.treatinkapi.com). The transport appends the /v1/... paths.
 */
export const DEFAULT_API_BASE_URL = 'https://treatinkapi.com';
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

export function resolveConfig(config: TreatinkConfig): ResolvedConfig {
  assertPublishableKey(config.apiKey);
  if (typeof config.channel !== 'string' || config.channel.trim() === '') {
    throw new TreatinkError(
      'bad_request',
      'Treatink.init requires `channel` — the registered storefront hostname.',
      { param: 'channel' },
    );
  }
  return {
    apiKey: config.apiKey,
    channel: config.channel,
    // Default 'fixtures' until the live API is wired (docs/09).
    mode: config.mode ?? 'fixtures',
    apiBaseUrl: config.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    maxPersonalizationLength: config.maxPersonalizationLength ?? DEFAULT_MAX_PERSONALIZATION_LENGTH,
    debug: config.debug ?? false,
    // Designer theme/copy defaults are P2-T04; init only carries the overrides through.
    theme: { ...config.theme },
    copy: { ...config.copy },
  };
}
