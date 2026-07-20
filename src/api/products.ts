import type { ProductsApi } from '../types.js';
import type { Transport } from '../transport/transport.js';

/** tk.products — thin typed wrapper over the transport (docs/10 §3). No fetch here. */
export function createProductsApi(transport: Transport): ProductsApi {
  return {
    list: (params) => transport.listProducts(params),
    get: (sku) => transport.getProduct(sku),
  };
}
