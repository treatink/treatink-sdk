import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  SDK_ERROR_CODES,
  STATUS_BY_CODE,
  fromEnvelope,
  type ApiErrorEnvelope,
} from './errors.js';
import { TreatinkError } from '../types.js';

// P1-T05: identical TreatinkError shapes from a live-style envelope and a fixture-triggered error.

describe('fromEnvelope', () => {
  it('maps a live-style envelope, all fields', () => {
    const body: ApiErrorEnvelope = {
      error: {
        type: 'invalid_request_error',
        code: 'validation_error',
        message: 'personalization_text is too long',
        param: 'personalization_text',
        request_id: 'req_123',
      },
    };
    const err = fromEnvelope(422, body);
    expect(err).toBeInstanceOf(TreatinkError);
    expect(err.name).toBe('TreatinkError');
    expect(err.code).toBe('validation_error');
    expect(err.status).toBe(422);
    expect(err.message).toBe('personalization_text is too long');
    expect(err.param).toBe('personalization_text');
    expect(err.requestId).toBe('req_123');
  });

  it('fixture-triggered error is shape-identical to the live one (Charter §11)', () => {
    // How FixtureTransport will build errors from failNext({ status, code }) (P1-T06):
    const code = 'upload_validation_failed';
    const fixtureBody: ApiErrorEnvelope = {
      error: { type: 'invalid_request_error', code, message: 'simulated failure' },
    };
    const liveBody: ApiErrorEnvelope = {
      error: { type: 'invalid_request_error', code, message: 'simulated failure' },
    };
    const fixtureErr = fromEnvelope(STATUS_BY_CODE[code], fixtureBody);
    const liveErr = fromEnvelope(422, liveBody);

    expect(fixtureErr).toBeInstanceOf(TreatinkError);
    expect({ ...fixtureErr, message: fixtureErr.message }).toEqual({
      ...liveErr,
      message: liveErr.message,
    });
    expect(fixtureErr.code).toBe(liveErr.code);
    expect(fixtureErr.status).toBe(liveErr.status);
    expect(fixtureErr.param).toBeUndefined();
    expect(fixtureErr.requestId).toBeUndefined();
  });

  it('omits optional fields when the envelope lacks them', () => {
    const err = fromEnvelope(404, {
      error: { type: 'invalid_request_error', code: 'not_found', message: 'no such cutout label' },
    });
    expect(err.code).toBe('not_found');
    expect(err.status).toBe(404);
    expect('param' in err && err.param !== undefined).toBe(false);
    expect('requestId' in err && err.requestId !== undefined).toBe(false);
  });
});

describe('code registry (docs/02 §4)', () => {
  it('every API code has a status in the table', () => {
    for (const code of API_ERROR_CODES) {
      expect(STATUS_BY_CODE[code], code).toBeTypeOf('number');
    }
  });

  it('SDK-local codes never overlap API codes', () => {
    for (const code of SDK_ERROR_CODES) {
      expect(API_ERROR_CODES).not.toContain(code);
    }
    expect(SDK_ERROR_CODES).toEqual([
      'key_scope_violation',
      'unsupported_file_type',
      'upload_failed',
    ]);
  });

  it('superseded Charter codes are not in the registry (invalid_request, channel_not_registered, session_*)', () => {
    const all: string[] = [...API_ERROR_CODES, ...SDK_ERROR_CODES];
    expect(all).not.toContain('invalid_request');
    expect(all).not.toContain('channel_not_registered');
    expect(all.some((c) => c.startsWith('session_'))).toBe(false);
  });
});
