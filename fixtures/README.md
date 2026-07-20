# fixtures/

Shipped, contract-faithful backend data (Charter §11, docs/08). The default backend in dev/CI;
`FixtureTransport` serves these. Wire JSON here matches docs/08 **exactly**; the catalog adapter
normalizes to the internal model.

Populated by **P1-T07** per the extraction spec in `docs/08` §9:
- `cutouts/` — ~95 mask PNGs from `../treatink/web/public/frames/`.
- `catalog/` — products/variants/cutout-labels JSON (docs/08 §2–§5), incl. edge cases (null
  `label_zone`, slug/sku collision, storefront-only Riley's product, a non-pet variant).
- Deterministic ids: `prd_fx_… var_fx_… cut_fx_… ast_fx_… ord_fx_…`.

Cite the source path for each extracted asset. Test-only inputs (sample photos incl. HEIC + a low-res
one) live under `test/golden/fixtures/`, not here.
