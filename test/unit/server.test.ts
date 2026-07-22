import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitOrder } from '../../server/index.js';
import { TreatinkError } from '../../src/types.js';

// P3-T06: posts to a mocked endpoint with correct headers/body; idempotent re-post; secret-key
// guard; typed envelope errors.

const PAYLOAD = { external_order_id: 'partner-1001', currency: 'USD', line_items: [] };
const OK_BODY = {
  id: 'ord_0000000000000000000000000000c001',
  status: 'received',
  external_order_id: 'partner-1001',
  display_order_number: '#1001',
};

afterEach(() => vi.unstubAllGlobals());

describe('submitOrder (server-only, Charter §6.4)', () => {
  it('POSTs the docs/08 §7 body with Bearer sk + Idempotency-Key; no channel header (docs/04 §2.8)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(OK_BODY), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitOrder(PAYLOAD, {
      secretKey: 'sk_test_abc',
      channel: 'rileyspets.com',
      apiBaseUrl: 'https://staging.treatinkapi.com',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://staging.treatinkapi.com/v1/orders');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk_test_abc');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBe('partner-1001'); // defaults to external_order_id
    expect(Object.keys(headers).some((h) => /channel/i.test(h))).toBe(false);
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD);
    expect(result).toEqual({
      id: OK_BODY.id,
      status: 'received',
      externalOrderId: 'partner-1001',
      displayOrderNumber: '#1001',
    });
  });

  it('re-posting the same external_order_id returns the original order (idempotent)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response(JSON.stringify(OK_BODY), { status: 200 })),
        ),
    );
    const first = await submitOrder(PAYLOAD, { secretKey: 'sk_test_x', channel: 'c' });
    const again = await submitOrder(PAYLOAD, { secretKey: 'sk_test_x', channel: 'c' });
    expect(again).toEqual(first);
  });

  it('maps the error envelope to a TreatinkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              type: 'invalid_request_error',
              code: 'validation_error',
              message: 'The request is invalid.',
              param: 'line_items',
              request_id: 'req_1',
            },
          }),
          { status: 422 },
        ),
      ),
    );
    const err = await submitOrder(PAYLOAD, { secretKey: 'sk_test_x', channel: 'c' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(TreatinkError);
    expect((err as TreatinkError).code).toBe('validation_error');
    expect((err as TreatinkError).status).toBe(422);
    expect((err as TreatinkError).requestId).toBe('req_1');
  });

  it('rejects a publishable key with key_scope_violation before any network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const err = await submitOrder(PAYLOAD, { secretKey: 'pk_test_x', channel: 'c' }).catch(
      (e: unknown) => e,
    );
    expect((err as TreatinkError).code).toBe('key_scope_violation');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
