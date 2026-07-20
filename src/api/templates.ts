import type { TemplatesApi } from '../types.js';
import type { Transport } from '../transport/transport.js';

/** tk.templates — cutout-labels, Charter-shaped (docs/10 §3, docs/04 §2.5). */
export function createTemplatesApi(transport: Transport): TemplatesApi {
  return {
    list: (params) => transport.listTemplates(params),
  };
}
