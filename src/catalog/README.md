# catalog/

`adapter.ts` — the ONLY place raw catalog wire shapes (docs/08 §2–§5) are parsed into the internal
model (`Product`, `Template`). Isolates backend schema churn to one file (docs/01 §5). Resolves a
`sku` → `{ productFamily, variant }` (SKU lives on the variant, docs/04 §2.4). Implemented by P1-T07.
