# save/

`pipeline.ts` — upload-on-save orchestration (Charter §8.4, docs/04 §2.3), asset-based:

1. Render via `cutout-engine.export` → print (900×1200), source, display composites.
2. `artwork.upload({role:'source'})` and `artwork.upload({role:'rendered'})` (each declare→PUT→finalize).
3. `previewUrl` = object URL of the **display** composite (mockup + label in zone, GP-08 — no server read).
4. Write the `DraftRecord` (asset ids) and fire `onComplete` with the `DesignerResult`.

Explicit failure UX per step (`upload_failed`, `upload_validation_failed`); nothing persists on
abandonment. Implemented by P3-T01/T02.
