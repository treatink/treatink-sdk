# STATE.md — Progress Ledger

**The loop's memory.** Source of truth for task **status**; phase files are the source of truth for
task **content**. Update this every iteration (`AGENTS.md` §5–§7, `docs/03` §5–§7).

Status: `todo` · `in_progress` · `done` · `blocked`.
Start with the first **runnable** task (`docs/03` §3): `todo`, all `depends_on` done, phase entry
gate passed, not blocked.

- **Project:** `@treatink/sdk` MVP (native modal + publishable-key client, fixtures-first)
- **Current phase:** P1 · Core (entry gate: blueprint present → ✅)
- **Next runnable:** `P1-T01` (skeleton provided — `npm install` + make gates green)
- **RETRY_BUDGET:** 3 per task
- **Scaffold:** repo skeleton laid down (pinned toolchain + `src/` architecture + typed stubs +
  test/fixtures structure). P1-T01/T03 are now *verify* tasks, not *create* tasks. Stubs throw
  `NOT_IMPLEMENTED` until their task fills them.

---

## Phase status

| Phase | Status | Entry gate | Exit gate |
|---|---|---|---|
| P1 Core | todo | blueprint present ✅ | `verify` + `test:golden` + `check:no-secret` green |
| P2 Designer | todo | P1 exit green | `verify` + `test:e2e` + `test:a11y` + budgets |
| P3 Save Path | todo | P2 exit green | full `test:e2e` happy path + persistence + no-secret |
| P4 Live & Pilot | todo | P3 exit green | live smoke green **or** blockers parked; published |

## Task ledger

### P1 · Core
| ID | Status | depends_on | Title |
|---|---|---|---|
| P1-T01 | todo | — | Toolchain & repo scaffold |
| P1-T02 | todo | P1-T01 | Gate scripts & CI |
| P1-T03 | todo | P1-T01 | Public types (the contract) |
| P1-T04 | todo | P1-T03 | Config + key-prefix guard |
| P1-T05 | todo | P1-T03 | Error model |
| P1-T06 | todo | P1-T05 | Transport interface + FixtureTransport |
| P1-T07 | todo | P1-T06 | Catalog fixtures + adapter |
| P1-T08 | todo | P1-T06, P1-T07 | API namespaces (publishable, fixtures-backed) |
| P1-T09 | todo | P1-T01 | Cutout engine — geometry & transform |
| P1-T10 | todo | P1-T09 | Cutout engine — render, text, export |
| P1-T11 | todo | P1-T10, P1-T02 | Golden-test harness + frozen goldens |
| P1-T12 | todo | P1-T03 | Event bus (`tk.on`) |

### P2 · Designer
| ID | Status | depends_on | Title |
|---|---|---|---|
| P2-T01 | todo | P1 exit | Modal shell + lifecycle |
| P2-T02 | todo | P2-T01 | Lazy designer chunk + loader budget |
| P2-T03 | todo | P2-T01 | Accessibility scaffold |
| P2-T04 | todo | P2-T01 | Theming + copy overrides |
| P2-T05 | todo | P2-T01 | Photo input (drag-drop + picker, EXIF) |
| P2-T06 | todo | P2-T05 | HEIC lazy transcode |
| P2-T07 | todo | P2-T01, P2-T05 | Positioning (drag + zoom controls) |
| P2-T08 | todo | P2-T01, P1-T07 | Cutout browser (chips + row + Browse All) |
| P2-T09 | todo | P2-T01, P2-T07 | Personalization text |
| P2-T10 | todo | P2-T07 | Low-res warning |
| P2-T11 | todo | P2-T07, P2-T09 | Save CTA (local composite → onComplete) |

### P3 · Save Path
| ID | Status | depends_on | Title |
|---|---|---|---|
| P3-T01 | todo | P2 exit | Upload-on-save pipeline |
| P3-T02 | todo | P3-T01 | Save failure UX (upload_failed + retry) |
| P3-T03 | todo | P3-T01 | Drafts store (references only) |
| P3-T04 | todo | P3-T03 | Draft re-open |
| P3-T05 | todo | P3-T01 | orders.buildPayload (live order schema) |
| P3-T06 | todo | P3-T05 | Server submit helper |
| P3-T07 | todo | P3-T02, P3-T03, P3-T04, P3-T05, P3-T06 | Full happy-path e2e |
| P3-T08 | todo | P3-T07 | Integration quickstart & API reference docs |

### P4 · Live & Pilot
| ID | Status | depends_on | Title | Note |
|---|---|---|---|---|
| P4-T01 | todo | P3 exit | HttpTransport (catalog + orders) | real documented paths |
| P4-T02 | todo | P4-T01 | Live assets upload (session/asset reconciliation) | **expected blocker** — API decision |
| P4-T03 | todo | P4-T01 | Live templates | **expected blocker** — endpoint missing |
| P4-T04 | todo | P4-T01 | CORS verification | **expected blocker** — API policy |
| P4-T05 | todo | P4-T01 | API-docs update pass | docs deliverable |
| P4-T06 | todo | P4-T01 | SRI + CSP + privacy guidance | |
| P4-T07 | todo | P4-T01, P4-T06 | Publish + Riley's pilot | may run hybrid if T02–T04 parked |

---

## Blockers

_None yet._ When a task blocks, add an entry here (template — `AGENTS.md` §5):

```
### <TASK_ID> — <one-line title>   (blocked)
- What I tried:
- Why it's blocked:            (cite doc/section or missing dependency)
- What would unblock it:
- Safe to skip ahead? yes/no — which tasks remain runnable meanwhile
```

Pre-identified blockers to expect (not failures). Confirmed against the real `treatink-api` repo —
see **`GAP-PLAN.md`** for the fixes and owners:
- **P4 order submit** — `POST /v1/orders` **does not exist** (GAP-PLAN GP-01). Go-live prerequisite (partner-server), not an SDK-build blocker.
- **P4-T02 assets** — real backend is asset-based (`/v1/assets` declare→PUT→finalize, roles source/rendered). SDK realigns to this (GP-03/04/05/07); preview handled locally (GP-08), so no backend preview endpoint needed.
- **P4-T03 templates** — NOT a blocker: cutout-labels ship via `GET /v1/catalog/cutout-labels` with precomputed alpha geometry. Re-point at the catalog endpoint.
- **P4-T04 CORS** — API CORS is wildcard `*` (works, keep — GP-19); confirm storage-bucket CORS for browser PUT (GP-02).

**Gap-filling plan in progress — see `GAP-PLAN.md` for GP-01..GP-20 status.**

## Parking lot (non-blocking debt / ideas noticed mid-build)

_Empty._ Note unrelated debt here instead of fixing it inline (`docs/02` §10).

## Iteration log

_Newest last. One line per completed task or phase transition:_
`<TASK_ID> done — <gate summary> — <commit>` / `Phase Pn complete — exit gate green`.

- (blueprint authored — planning complete; build not started)
