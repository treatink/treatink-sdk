# transport/

The single seam to any backend (docs/01 §4). **API namespaces never call `fetch` — they call the
transport.** Two implementations behind one `Transport` interface; `mode` picks one.

| File | Responsibility | Task |
|---|---|---|
| `transport.ts` | the `Transport` interface + shared wire↔asset types | done (skeleton) |
| `fixture-transport.ts` | bundled simulation (docs/08): catalog, two-step assets → object URLs, `failNext`, latency | P1-T06 |
| `http-transport.ts` | live: `fetch`, `Authorization: Bearer pk_…`, retry+backoff+jitter (GETs only), envelope→error. **No channel header** (docs/04 §2.8) | P4-T01/T02 |
| `errors.ts` | central code registry + envelope mapper (docs/02 §4) | P1-T05 |

Rules: only place URLs/headers/auth/retry live here. Fixtures and http must be swap-equal — a
consumer test passes identically in both modes.
