import { TreatinkError } from './types.js';
import type { TreatinkEvent } from './types.js';

/**
 * The tk event bus (docs/10 §2, Charter §6.2): 'designer:open' | 'designer:close' |
 * 'draft:saved' | 'error'. Public surface is `tk.on(event, handler) → unsubscribe`; `emit` is
 * internal — the designer (P2), save/drafts (P3), and the error boundary below call it.
 */

export type EventHandler = (payload: unknown) => void;

export interface EventBus {
  on(event: TreatinkEvent, handler: EventHandler): () => void;
  emit(event: TreatinkEvent, payload: unknown): void;
}

export function createEventBus(): EventBus {
  const handlers = new Map<TreatinkEvent, Set<EventHandler>>();
  return {
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },
    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      // Snapshot: handlers may unsubscribe (or subscribe) during emit without skipping anyone.
      for (const handler of [...set]) {
        handler(payload);
      }
    },
  };
}

/**
 * Error boundary: every TreatinkError that surfaces from a public namespace method also fires the
 * 'error' event (docs/10 §2), then rethrows unchanged. Sync throws and async rejections both count.
 */
export function instrumentNamespace<T extends object>(
  api: T,
  onError: (error: TreatinkError) => void,
): T {
  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(api)) {
    if (typeof value !== 'function') {
      wrapped[key] = value;
      continue;
    }
    const fn = value as (...args: unknown[]) => unknown;
    wrapped[key] = (...args: unknown[]) => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.catch((error: unknown) => {
            if (error instanceof TreatinkError) onError(error);
            throw error;
          });
        }
        return result;
      } catch (error) {
        if (error instanceof TreatinkError) onError(error);
        throw error;
      }
    };
  }
  return wrapped as T;
}
