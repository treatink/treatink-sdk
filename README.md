# Treatink Customizer SDK — Build Blueprint

This repository will become **`@treatink/sdk`**: a TypeScript/JavaScript library that third-party
websites embed to add Treatink product personalization to their storefronts. It replaces the
current iframe prototype with a native, embedded modal designer plus a typed, publishable-key API
client.

**Right now this repo contains no product code — it contains the blueprint an AI agent (or a
human) follows to build the SDK, phase by phase, under an automated execute-and-verify loop.**

## Read these in order

1. **[`AGENTS.md`](./AGENTS.md)** — the loop contract. How work is picked, done, verified,
   committed, and when to stop. **Every agent reads this first, every iteration.**
2. **[`STATE.md`](./STATE.md)** — the progress ledger. The loop's memory: what's done, what's
   next, what's blocked.
3. **[`docs/`](./docs)** — the durable knowledge base (read on demand, linked from tasks):
   - [`01-architecture.md`](./docs/01-architecture.md) — modules, dependency direction, boundaries
   - [`02-conventions.md`](./docs/02-conventions.md) — coding standards, TS rules, error model
   - [`03-workflow.md`](./docs/03-workflow.md) — the execute-and-verify loop in full detail
   - [`04-api-reconciliation.md`](./docs/04-api-reconciliation.md) — **brief vs. live API**, per field, with gated dependencies
   - [`05-engine-reference.md`](./docs/05-engine-reference.md) — customizer math, pinned to the real `treatink` store code
   - [`06-testing-and-gates.md`](./docs/06-testing-and-gates.md) — every acceptance gate command + threshold
   - [`07-glossary.md`](./docs/07-glossary.md) — vocabulary
4. **[`phases/`](./phases)** — the executable plans:
   - [`00-overview.md`](./phases/00-overview.md) — roadmap, phase graph, dependencies
   - [`01-core.md`](./phases/01-core.md) → [`04-live-and-pilot.md`](./phases/04-live-and-pilot.md)

## Ground truth, in priority order

When two sources disagree, the higher one wins. This ordering is a **project decision** (owner:
Mark, 2026-07-20) and is the single most important rule in this blueprint:

| Priority | Source | Authoritative for |
|---|---|---|
| 1 | **The `treatink` store customizer code** (`../treatink/web/src/components/customizer/…`) | All customizer **math, rendering, and logic** — positioning, scale, pet-name placement, canvas/export |
| 2 | **`Treatink_SDK_Design_Brief_and_Charter_2.md`** (the Charter) | **Scope & product decisions** — which features ship in MVP, public API shape, upload-on-save, references-only storage, packaging |
| 3 | **The `treatink-api` repo** (`../treatink-api`, FastAPI/PostgreSQL) | The **currently-real backend wire contract** (asset-based, no sessions, no orders). Read from source; supersedes the public `api-docs.treatink.com` where they differ. Gaps and how they're filled are in [`GAP-PLAN.md`](./GAP-PLAN.md) |
| 4 | **Charter Appendix D** (Shopify prototype math) | Intent only. **Where it disagrees with (1), (1) wins.** |

See also **[`GAP-PLAN.md`](./GAP-PLAN.md)** — the gap-filling plan: bare-minimum backend additions
(order intake, storage CORS) plus all SDK-side work to reach a complete, buildable blueprint; and
[`docs/04`](./docs/04-api-reconciliation.md) for the field-by-field reconciliation.

> The Charter is a *brief*: excellent for intent and scope, but it idealizes some technical
> details (notably a zone-remapped cutout engine and a sessions-based save pipeline) that do not
> match either the real store code or the live API. Those divergences are catalogued, not guessed.

## The one principle behind everything here

> **Every task ends in an objective, machine-checkable gate. The loop advances only on green —
> never on the model's judgment.**

If a gate cannot be made to pass (e.g. it depends on a live endpoint that does not exist yet),
the loop **parks** on it and records a blocker, rather than declaring success. See `AGENTS.md`.
