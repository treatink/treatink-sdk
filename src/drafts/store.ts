import { TreatinkError } from '../types.js';
import type { DraftRecord } from '../types.js';

/**
 * Drafts store (P3-T03, Charter §9, docs/10 §6): REFERENCE records only — asset ids, transform,
 * cutout id. NO image bytes, ever (docs/02 §6). localStorage under a versioned, channel-scoped
 * namespace; written only after a successful save. Bounded (LRU, default 5), TTL (default 30
 * days), migrate-or-discard on version bumps, in-memory fallback when localStorage is
 * unavailable or full.
 *
 * Keys: `treatink:v1:<channel>:index` (LRU order, oldest first) and
 *       `treatink:v1:<channel>:draft:<draftId>`.
 */

export const DRAFTS_VERSION = 'v1';
export const DEFAULT_MAX_DRAFTS = 5;
export const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** A reference record is tiny; anything bigger smells like smuggled image data. */
const MAX_RECORD_BYTES = 16 * 1024;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Enumerate keys (Storage.key/length equivalent). */
  keys(): string[];
}

export interface DraftsStoreOptions {
  channel: string;
  maxDrafts?: number;
  ttlMs?: number;
  /** Injected for tests; default wraps window.localStorage with in-memory fallback. */
  storage?: StorageLike;
  /** Clock injection for TTL tests. */
  now?: () => number;
}

class MemoryStorage implements StorageLike {
  readonly #map = new Map<string, string>();
  getItem(key: string) {
    return this.#map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.#map.set(key, value);
  }
  removeItem(key: string) {
    this.#map.delete(key);
  }
  keys() {
    return [...this.#map.keys()];
  }
}

function defaultStorage(): StorageLike {
  try {
    const ls = globalThis.localStorage;
    const probe = 'treatink:probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
      keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i)!),
    };
  } catch {
    return new MemoryStorage(); // unavailable (private mode, disabled) → session-scoped fallback
  }
}

export class DraftsStore {
  readonly #ns: string;
  readonly #max: number;
  readonly #ttlMs: number;
  readonly #now: () => number;
  #storage: StorageLike;

  constructor(options: DraftsStoreOptions) {
    this.#ns = `treatink:${DRAFTS_VERSION}:${options.channel}`;
    this.#max = options.maxDrafts ?? DEFAULT_MAX_DRAFTS;
    this.#ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.#now = options.now ?? Date.now;
    this.#storage = options.storage ?? defaultStorage();
    this.#migrateOrDiscard();
  }

  /** Older-version treatink keys are DISCARDED (no migrations defined yet — docs/10 §6). */
  #migrateOrDiscard(): void {
    try {
      for (const key of this.#storage.keys()) {
        if (key.startsWith('treatink:') && !key.startsWith(`treatink:${DRAFTS_VERSION}:`)) {
          this.#storage.removeItem(key);
        }
      }
    } catch {
      this.#storage = new MemoryStorage();
    }
  }

  #indexKey(): string {
    return `${this.#ns}:index`;
  }
  #draftKey(id: string): string {
    return `${this.#ns}:draft:${id}`;
  }

  #readIndex(): string[] {
    try {
      const raw = this.#storage.getItem(this.#indexKey());
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  #writeIndex(ids: string[]): void {
    this.#storage.setItem(this.#indexKey(), JSON.stringify(ids));
  }

  #readDraft(id: string): DraftRecord | null {
    try {
      const raw = this.#storage.getItem(this.#draftKey(id));
      if (!raw) return null;
      const record = JSON.parse(raw) as DraftRecord;
      if (this.#now() - Date.parse(record.updatedAt) > this.#ttlMs) {
        this.delete(id); // expired
        return null;
      }
      return record;
    } catch {
      this.delete(id); // corrupted → discard
      return null;
    }
  }

  /** Written ONLY after a successful save (P3-T01 resolved). LRU-evicts beyond the bound. */
  put(record: DraftRecord): void {
    const serialized = JSON.stringify(record);
    // Privacy guard (docs/02 §6): references only. Reject anything that smells like image bytes.
    if (
      serialized.length > MAX_RECORD_BYTES ||
      serialized.includes('data:image') ||
      serialized.includes('blob:')
    ) {
      throw new TreatinkError(
        'bad_request',
        'Draft records carry references only — never image bytes or media URLs.',
      );
    }
    const write = () => {
      this.#storage.setItem(this.#draftKey(record.draftId), serialized);
      const ids = this.#readIndex().filter((id) => id !== record.draftId);
      ids.push(record.draftId); // most-recent last
      while (ids.length > this.#max) {
        const evicted = ids.shift()!;
        this.#storage.removeItem(this.#draftKey(evicted));
      }
      this.#writeIndex(ids);
    };
    try {
      write();
    } catch {
      // quota/full → drop the oldest and retry once; still failing → in-memory fallback
      try {
        const ids = this.#readIndex();
        if (ids.length > 0) {
          this.delete(ids[0]!);
        }
        write();
      } catch {
        this.#storage = new MemoryStorage();
        write();
      }
    }
  }

  /** Most recent first. Expired/corrupted records are pruned on read. */
  list(): DraftRecord[] {
    const records: DraftRecord[] = [];
    for (const id of [...this.#readIndex()].reverse()) {
      const record = this.#readDraft(id);
      if (record) records.push(record);
    }
    return records;
  }

  get(draftId: string): DraftRecord | null {
    return this.#readDraft(draftId);
  }

  delete(draftId: string): void {
    this.#storage.removeItem(this.#draftKey(draftId));
    this.#writeIndex(this.#readIndex().filter((id) => id !== draftId));
  }

  clear(): void {
    for (const id of this.#readIndex()) {
      this.#storage.removeItem(this.#draftKey(id));
    }
    this.#storage.removeItem(this.#indexKey());
  }
}
