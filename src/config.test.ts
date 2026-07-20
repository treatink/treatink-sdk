import { describe, expect, it } from 'vitest';
import { Treatink } from './index.js';
import { ACCEPTED_KEY_PREFIXES, DEFAULT_API_BASE_URL, resolveConfig } from './config.js';
import { TreatinkError } from './types.js';

// P1-T04 accept/reject matrix (Charter §10.1, docs/04 §2.1, docs/06 §6).
const VALID = { apiKey: 'pk_test_abc123', channel: 'rileyspets.com' };

describe('key-prefix guard', () => {
  it.each(['pk_test_abc123', 'pk_live_abc123'])('accepts publishable key %s', (apiKey) => {
    const tk = Treatink.init({ ...VALID, apiKey });
    expect(tk).toBeTruthy();
    expect(tk.products).toBeDefined();
  });

  it.each([
    'sk_test_abc123', // secret test key
    'sk_live_abc123', // secret live key
    'tk_live_abc123', // Charter-era prefix — superseded, must NOT be accepted
    'tk_pub_abc123', // Charter-era prefix — superseded, must NOT be accepted
    'pk-test-abc123', // wrong separator — not a real prefix
    'PK_TEST_ABC', // prefixes are case-sensitive
    'abc123', // no prefix at all
    '', // empty
  ])('rejects %j with key_scope_violation, synchronously', (apiKey) => {
    let thrown: unknown;
    try {
      Treatink.init({ ...VALID, apiKey });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TreatinkError);
    expect((thrown as TreatinkError).code).toBe('key_scope_violation');
  });

  it('keeps the accepted prefixes in one constant (docs/04 §2.1)', () => {
    expect(ACCEPTED_KEY_PREFIXES).toEqual(['pk_test_', 'pk_live_']);
  });
});

describe('resolveConfig', () => {
  it('requires channel', () => {
    for (const channel of ['', '   ']) {
      expect(() => resolveConfig({ ...VALID, channel })).toThrowError(TreatinkError);
      try {
        resolveConfig({ ...VALID, channel });
      } catch (e) {
        expect((e as TreatinkError).code).toBe('bad_request');
        expect((e as TreatinkError).param).toBe('channel');
      }
    }
  });

  it('applies defaults: fixtures mode, base URL, text cap 20, debug off', () => {
    const r = resolveConfig(VALID);
    expect(r.mode).toBe('fixtures');
    expect(r.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(r.maxPersonalizationLength).toBe(20);
    expect(r.debug).toBe(false);
  });

  it('honors explicit overrides', () => {
    const r = resolveConfig({
      ...VALID,
      mode: 'live',
      apiBaseUrl: 'https://staging.api.treatink.com',
      maxPersonalizationLength: 12,
      debug: true,
    });
    expect(r.mode).toBe('live');
    expect(r.apiBaseUrl).toBe('https://staging.api.treatink.com');
    expect(r.maxPersonalizationLength).toBe(12);
    expect(r.debug).toBe(true);
  });
});

describe('instance shape', () => {
  it('exposes fixtures only in fixtures mode (docs/10 §2)', () => {
    expect(Treatink.init(VALID).fixtures).toBeDefined();
    expect(Treatink.init({ ...VALID, mode: 'live' }).fixtures).toBeUndefined();
  });
});
