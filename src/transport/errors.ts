import { TreatinkError } from '../types.js';

/**
 * Central error-code registry + envelope mapping (docs/02 §4). The real API envelope is
 * { error: { type, code, message, param, request_id } }. Keep ALL codes here — do not scatter
 * string literals. Implemented/exercised by: P1-T05.
 */

/** Codes the backend can return (verified against treatink-api errors.py). */
export const API_ERROR_CODES = [
  'bad_request',
  'invalid_cursor',
  'invalid_api_key',
  'insufficient_permissions',
  'not_found',
  'upload_quota_exceeded',
  'upload_incomplete',
  'upload_expired',
  'asset_not_final',
  'cutout_label_not_final',
  'upload_too_large',
  'unsupported_media_type',
  'validation_error',
  'upload_validation_failed',
  'service_unavailable',
] as const;

/** SDK-local codes — never come from the wire. */
export const SDK_ERROR_CODES = [
  'key_scope_violation',
  'unsupported_file_type',
  'upload_failed',
] as const;

export interface ApiErrorEnvelope {
  error: { type: string; code: string; message: string; param?: string; request_id?: string };
}

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type SdkErrorCode = (typeof SDK_ERROR_CODES)[number];

/** HTTP status per API code (docs/02 §4 table). Fixtures use this to emit live-identical errors. */
export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  invalid_cursor: 400,
  invalid_api_key: 401,
  insufficient_permissions: 403,
  not_found: 404,
  upload_quota_exceeded: 409,
  upload_incomplete: 409,
  upload_expired: 409,
  asset_not_final: 409,
  cutout_label_not_final: 409,
  upload_too_large: 413,
  unsupported_media_type: 415,
  validation_error: 422,
  upload_validation_failed: 422,
  service_unavailable: 503,
};

/**
 * Map a raw API error envelope to a TreatinkError. Both HttpTransport (live) and FixtureTransport
 * route errors through here, so fixture mode produces identical error objects (Charter §11).
 */
export function fromEnvelope(status: number, body: ApiErrorEnvelope): TreatinkError {
  const e = body.error;
  return new TreatinkError(e.code, e.message, {
    status,
    ...(e.param !== undefined ? { param: e.param } : {}),
    ...(e.request_id !== undefined ? { requestId: e.request_id } : {}),
  });
}
