# Phase 00 · Overview & Roadmap

The build is four phases mirroring the Charter's milestones (§15). Each phase is a set of tasks
(`phases/0X-*.md`); each task ends in a gate (`docs/06`); the loop advances only on green
(`AGENTS.md`). Phases run in order; each has an **entry gate** (must pass before it starts) and an
**exit gate** (must pass to complete it).

## Phase graph

```
P1 Core ──▶ P2 Designer ──▶ P3 Save Path ──▶ P4 Live & Pilot
  │             │                │                 │
  scaffold      modal UI         upload-on-save    HttpTransport vs staging
  key guard     Riley parity     drafts (refs)     CORS, api-docs update
  transport     a11y             buildPayload      ship @ sdk.treatink.com
  +fixtures     theming          server submit     (expected LIVE-GAP blockers)
  engine port
  golden tests
```

Everything in P1–P3 is buildable and gate-able **offline against fixtures**. P4 wires the live
backend; a couple of P4 tasks depend on backend/infra the SDK doesn't own (the order endpoint,
storage-bucket CORS — GAP-PLAN "Out of scope") and **park** until the backend dev ships them.

## Phases at a glance

| Phase | Charter | Goal | Entry gate | Exit gate |
|---|---|---|---|---|
| **P1 Core** | M1 | Package skeleton, `init` + key guard, `Transport` + fixtures, pure cutout engine ported with golden tests | repo has blueprint (this) | `npm run verify` + `npm run test:golden` green; `check:no-secret` green |
| **P2 Designer** | M2 | Modal at Riley's parity, light-DOM theming, a11y essentials | P1 exit green | `npm run verify` + `test:e2e` (designer open/upload/position/text) + `test:a11y` green; size budgets hold |
| **P3 Save Path** | M3 | Upload-on-save pipeline w/ failure UX, reference drafts + re-open, `orders.buildPayload`, `@treatink/sdk/server` submit | P2 exit green | full `test:e2e` happy path (Charter §14) green; persistence + no-secret gates green |
| **P4 Live & Pilot** | M4 | `HttpTransport` vs staging behind `mode`, CORS verified, api-docs updated, deploy on Riley's, publish bundle | P3 exit green | live smoke against staging green **or** documented blockers parked; bundle published; MVP DoD (Charter §14) checked |

## Cross-cutting rules (all phases)

- **Ground-truth priority** (`BLUEPRINT.md`): store code > Charter scope > live API > Appendix D.
- **Fixtures-first**: build against `FixtureTransport`; `HttpTransport` is P4.
- **Every task carries its gate**; no advance without green; blockers get parked (`AGENTS.md` §5).
- **Budgets & security are gates**, not aspirations (`docs/06` §2, §6).
- **Photos are sensitive**: references-only storage, no third-party requests, TLS.

## MVP Definition of Done (Charter §14 — the project exit)

- [ ] Cold developer integrates designer→order in **fixtures mode in < 1 day** from public docs.
      *(Operationalized by P3-T08: the quickstart's code sample runs green as `quickstart.spec`.)*
- [ ] Riley's designer reproduced as a **native modal, no iframe**.
- [ ] **Golden tests pass** within tolerance.
- [ ] **No secret key** can transit the browser bundle (build-time check green).
- [ ] **Bundle budgets hold** (loader ≤ 15 KB gz, designer ≤ 150 KB gz).
- [ ] Bundle live at `sdk.treatink.com/v1/treatink.js` against staging (P4; may be gated).

## Deferred beyond MVP (do NOT build — Charter §2, §17)

Inline `mount()` target; subject/"Choose Your Pet" + template facets; `sessions.update`/in-place
re-edit; Shadow DOM + `::part()` theming; touch pinch-zoom & keyboard nudging as MVP inputs;
i18n beyond copy map; framework wrappers; multiple concurrent modals; worker/OffscreenCanvas
offloading; telemetry; shipments/webhooks client. If a task seems to need one of these, it's
mis-scoped — park it.

## How to read a phase file

Each task block:

```
### P1-T03 · <title>
- depends_on: [P1-T01, P1-T02]
- does: <what to build>
- dod: <observable outcomes>
- gate: <exact command(s) + threshold>
- refs: <docs / store-code citations to read first>
```

`STATE.md` mirrors `id / depends_on / status`. Start with the first runnable task (`docs/03` §3).
