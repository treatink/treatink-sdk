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

/** Map a raw API error envelope to a TreatinkError. P1-T05. */
export function fromEnvelope(_status: number, _body: ApiErrorEnvelope): TreatinkError {
  throw new TreatinkError('not_implemented', 'fromEnvelope: implemented in P1-T05');
}
