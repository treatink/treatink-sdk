# api/

Thin typed namespaces over the `Transport` (docs/10 §3). No `fetch`, no business logic beyond
shaping calls + client-side validation. **No `sessions`** (GP-18).

| File | Surface | Task |
|---|---|---|
| `products.ts` | `tk.products.list/get` | P1-T08 |
| `templates.ts` | `tk.templates.list({sku})` (cutout-labels) | P1-T08 |
| `artwork.ts` | `tk.artwork.upload({role,file})` — runs declare→PUT→finalize; validates type + ≤25 MB first | P1-T08 |
| `orders.ts` | `tk.orders.buildPayload()` — pure, assembles the docs/08 §7 body from a draft | P3-T05 |
