import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './events.js';
import { Treatink } from './index.js';
import { TreatinkError } from './types.js';

// P1-T12: subscribe → emit calls the handler with the payload; unsubscribe stops it; multiple
// handlers per event; 'error' fires on a surfaced TreatinkError.

describe('event bus', () => {
  it('delivers the payload to a subscriber', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('designer:open', handler);
    bus.emit('designer:open', { sku: 'SSGTTBC' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ sku: 'SSGTTBC' });
  });

  it('unsubscribe stops delivery', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const off = bus.on('draft:saved', handler);
    bus.emit('draft:saved', 1);
    off();
    bus.emit('draft:saved', 2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(() => off()).not.toThrow(); // idempotent
  });

  it('supports multiple handlers per event and keeps events separate', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    const other = vi.fn();
    bus.on('designer:close', a);
    bus.on('designer:close', b);
    bus.on('designer:open', other);
    bus.emit('designer:close', 'bye');
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith('bye');
    expect(b).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledWith('bye');
    expect(other).not.toHaveBeenCalled();
  });

  it('a handler unsubscribing during emit does not skip the others', () => {
    const bus = createEventBus();
    const calls: string[] = [];
    const offA = bus.on('error', () => {
      calls.push('a');
      offA();
    });
    bus.on('error', () => calls.push('b'));
    bus.emit('error', null);
    expect(calls).toEqual(['a', 'b']);
  });
});

describe("tk.on('error') — public error boundary (docs/10 §2)", () => {
  it('fires with the surfaced TreatinkError, which still rejects the caller', async () => {
    const tk = Treatink.init({ apiKey: 'pk_test_x', channel: 'rileyspets.com' });
    const seen: unknown[] = [];
    tk.on('error', (payload) => seen.push(payload));

    tk.fixtures!.failNext('variants.list', { status: 503, code: 'service_unavailable' });
    const err = await tk.products.list().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TreatinkError);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(err); // the exact same error object, rethrown unchanged
  });

  it('fires for synchronous throws too (client-side validation)', async () => {
    const tk = Treatink.init({ apiKey: 'pk_test_x', channel: 'rileyspets.com' });
    const handler = vi.fn();
    tk.on('error', handler);
    await tk.artwork
      .upload({ role: 'source', file: new Blob(['x'], { type: 'text/plain' }) })
      .catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]![0] as TreatinkError).code).toBe('unsupported_file_type');
  });

  it('unsubscribe works on the public surface', async () => {
    const tk = Treatink.init({ apiKey: 'pk_test_x', channel: 'rileyspets.com' });
    const handler = vi.fn();
    const off = tk.on('error', handler);
    off();
    tk.fixtures!.failNext('variants.list', { status: 503, code: 'service_unavailable' });
    await tk.products.list().catch(() => undefined);
    expect(handler).not.toHaveBeenCalled();
  });
});
