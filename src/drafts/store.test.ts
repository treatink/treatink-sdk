import { describe, expect, it } from 'vitest';
import { DEFAULT_TTL_MS, DraftsStore, type StorageLike } from './store.js';
import { TreatinkError } from '../types.js';
import type { DraftRecord } from '../types.js';

// P3-T03: reference records only; LRU + TTL; versioned namespace migrate-or-discard; in-memory
// fallback; the persistence guard proves no image bytes can be stored.

class FakeStorage implements StorageLike {
  map = new Map<string, string>();
  failNextSet = 0;
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failNextSet > 0) {
      this.failNextSet -= 1;
      throw new Error('QuotaExceededError');
    }
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()];
  }
}

const record = (id: string, updatedAt = '2026-07-20T12:00:00.000Z'): DraftRecord => ({
  draftId: id,
  createdAt: updatedAt,
  updatedAt,
  channel: 'rileyspets.com',
  product: { sku: 'SSGTTBC', variantId: 'var_fx_00000001' },
  cutout: { cutoutLabelId: 'cut_fx_00000001', petNamePosition: 'default' },
  personalizationText: 'Milo',
  transform: { x: 0, y: 132, scale: 1, rotation: 0 },
  labelZone: { x: 0.321, y: 0.316, width: 0.358, height: 0.478 },
  artwork: { sourceAssetId: 'ast_fx_00000001', renderedAssetId: 'ast_fx_00000002' },
  status: 'completed',
});

const NOW = Date.parse('2026-07-20T12:00:00.000Z');
const store = (storage: FakeStorage, now = NOW) =>
  new DraftsStore({ channel: 'rileyspets.com', storage, now: () => now });

describe('CRUD + keys (docs/10 §6)', () => {
  it('put/list/get/delete/clear over the namespaced keys', () => {
    const storage = new FakeStorage();
    const drafts = store(storage);
    drafts.put(record('d1'));
    drafts.put(record('d2'));
    expect(storage.map.has('treatink:v1:rileyspets.com:index')).toBe(true);
    expect(storage.map.has('treatink:v1:rileyspets.com:draft:d1')).toBe(true);
    expect(drafts.list().map((r) => r.draftId)).toEqual(['d2', 'd1']); // newest first
    expect(drafts.get('d1')?.artwork.sourceAssetId).toBe('ast_fx_00000001');
    drafts.delete('d1');
    expect(drafts.get('d1')).toBeNull();
    drafts.clear();
    expect(drafts.list()).toEqual([]);
    expect(storage.map.size).toBe(0);
  });

  it('LRU: the 6th put evicts the oldest (default bound 5)', () => {
    const drafts = store(new FakeStorage());
    for (let i = 1; i <= 6; i++) drafts.put(record(`d${i}`));
    const ids = drafts.list().map((r) => r.draftId);
    expect(ids).toHaveLength(5);
    expect(ids).not.toContain('d1');
    expect(ids[0]).toBe('d6');
  });

  it('re-putting an existing draft refreshes its LRU slot', () => {
    const drafts = store(new FakeStorage());
    for (let i = 1; i <= 5; i++) drafts.put(record(`d${i}`));
    drafts.put(record('d1')); // refresh
    drafts.put(record('d6')); // evicts d2 now, not d1
    const ids = drafts.list().map((r) => r.draftId);
    expect(ids).toContain('d1');
    expect(ids).not.toContain('d2');
  });
});

describe('TTL + hygiene', () => {
  it('expired records prune on read (default 30 days)', () => {
    const storage = new FakeStorage();
    const drafts = store(storage);
    drafts.put(record('old', new Date(NOW - DEFAULT_TTL_MS - 1000).toISOString()));
    drafts.put(record('fresh'));
    expect(drafts.list().map((r) => r.draftId)).toEqual(['fresh']);
    expect(storage.map.has('treatink:v1:rileyspets.com:draft:old')).toBe(false);
  });

  it('corrupted JSON is discarded, not thrown', () => {
    const storage = new FakeStorage();
    const drafts = store(storage);
    drafts.put(record('ok'));
    storage.map.set('treatink:v1:rileyspets.com:draft:ok', '{nope');
    expect(drafts.list()).toEqual([]);
  });

  it('migrate-or-discard: older-version treatink keys are removed at construction', () => {
    const storage = new FakeStorage();
    storage.map.set('treatink:v0:rileyspets.com:draft:legacy', '{}');
    storage.map.set('unrelated:key', 'kept');
    store(storage);
    expect(storage.map.has('treatink:v0:rileyspets.com:draft:legacy')).toBe(false);
    expect(storage.map.get('unrelated:key')).toBe('kept');
  });
});

describe('privacy guard (docs/02 §6, docs/06 §6)', () => {
  it('rejects records smelling of image bytes; stored values stay small JSON', () => {
    const drafts = store(new FakeStorage());
    const poisoned = { ...record('evil'), personalizationText: 'data:image/png;base64,AAAA' };
    expect(() => drafts.put(poisoned)).toThrowError(TreatinkError);
    const huge = { ...record('fat'), personalizationText: 'x'.repeat(20_000) };
    expect(() => drafts.put(huge)).toThrowError(TreatinkError);

    const storage = new FakeStorage();
    const clean = store(storage);
    clean.put(record('ok'));
    for (const value of storage.map.values()) {
      expect(value.length).toBeLessThan(4096);
      expect(value).not.toContain('data:image');
      expect(value).not.toContain('blob:');
      expect(() => JSON.parse(value) as unknown).not.toThrow(); // small JSON, never a Blob
    }
  });
});

describe('degradation', () => {
  it('quota failure evicts the oldest and retries; hard failure falls back to memory', () => {
    const storage = new FakeStorage();
    const drafts = store(storage);
    drafts.put(record('d1'));
    drafts.put(record('d2'));
    storage.failNextSet = 1; // one quota error → evict + retry path
    drafts.put(record('d3'));
    expect(drafts.get('d3')).not.toBeNull();

    storage.failNextSet = 99; // storage hard-down → in-memory fallback keeps working
    drafts.put(record('d4'));
    expect(drafts.get('d4')).not.toBeNull();
  });

  it('works without localStorage at all (Node/test env)', () => {
    const drafts = new DraftsStore({ channel: 'x' }); // no injected storage, no globalThis.localStorage
    drafts.put(record('d1'));
    expect(drafts.list()).toHaveLength(1);
  });
});
