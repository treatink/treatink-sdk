# STATE.md — Progress Ledger

**The loop's memory.** Source of truth for task **status**; phase files are the source of truth for
task **content**. Update this every iteration (`AGENTS.md` §5–§7, `docs/03` §5–§7).

Status: `todo` · `in_progress` · `done` · `blocked`.
Start with the first **runnable** task (`docs/03` §3): `todo`, all `depends_on` done, phase entry
gate passed, not blocked.

- **Project:** `@treatink/sdk` MVP (native modal + publishable-key client, fixtures-first)
- **Current phase:** **P5 · Visual Parity** (owner-directed 2026-07-21; spec `docs/13`, plan
  `phases/05-visual-parity.md`). P4 remains parked on backend/infra + human go-live as recorded
  below — P5 takes priority and is fully offline/machine-gated.
- **Next runnable:** `P5-T01` (theme tokens + copy surface).
- **RETRY_BUDGET:** 3 per task
- **Scaffold:** repo skeleton laid down (pinned toolchain + `src/` architecture + typed stubs +
  test/fixtures structure). P1-T01/T03 are now *verify* tasks, not *create* tasks. Stubs throw
  `NOT_IMPLEMENTED` until their task fills them.

---

## Phase status

| Phase | Status | Entry gate | Exit gate |
|---|---|---|---|
| P1 Core | **done** ✅ | blueprint present ✅ | exit gate green 2026-07-20 (130 tests) |
| P2 Designer | **done** ✅ | P1 exit green ✅ | exit gate green 2026-07-20 (135 e2e + 15 a11y; budgets hold) |
| P3 Save Path | **done** ✅ | P2 exit green ✅ | exit gate green 2026-07-21 (verify + 189 e2e + no-secret) |
| P4 Live & Pilot | todo | P3 exit green ✅ | live smoke green **or** blockers parked; published |
| P5 Visual Parity | todo | verify green on main ✅ | full sweep green + harness eyeball vs store (`phases/05`) |

## Task ledger

### P1 · Core
| ID | Status | depends_on | Title |
|---|---|---|---|
| P1-T01 | done | — | Toolchain & repo scaffold |
| P1-T02 | done | P1-T01 | Gate scripts & CI |
| P1-T03 | done | P1-T01 | Public types (the contract) |
| P1-T04 | done | P1-T03 | Config + key-prefix guard |
| P1-T05 | done | P1-T03 | Error model |
| P1-T06 | done | P1-T05 | Transport interface + FixtureTransport |
| P1-T07 | done | P1-T06 | Catalog fixtures + adapter |
| P1-T08 | done | P1-T06, P1-T07 | API namespaces (publishable, fixtures-backed) |
| P1-T09 | done | P1-T01 | Cutout engine — geometry & transform |
| P1-T10 | done | P1-T09 | Cutout engine — render, text, export |
| P1-T11 | done | P1-T10, P1-T02 | Golden-test harness + frozen goldens |
| P1-T12 | done | P1-T03 | Event bus (`tk.on`) |

### P2 · Designer
| ID | Status | depends_on | Title |
|---|---|---|---|
| P2-T01 | done | P1 exit | Modal shell + lifecycle |
| P2-T02 | done | P2-T01 | Lazy designer chunk + loader budget |
| P2-T03 | done | P2-T01 | Accessibility scaffold |
| P2-T04 | done | P2-T01 | Theming + copy overrides |
| P2-T05 | done | P2-T01 | Photo input (drag-drop + picker, EXIF) |
| P2-T06 | done | P2-T05 | HEIC lazy transcode |
| P2-T07 | done | P2-T01, P2-T05 | Positioning (drag + zoom controls) |
| P2-T08 | done | P2-T01, P1-T07 | Cutout browser (chips + row + Browse All) |
| P2-T09 | done | P2-T01, P2-T07 | Personalization text |
| P2-T10 | done | P2-T07 | Low-res warning |
| P2-T11 | done | P2-T07, P2-T09 | Save CTA (local composite → onComplete) |

### P3 · Save Path
| ID | Status | depends_on | Title |
|---|---|---|---|
| P3-T01 | done | P2 exit | Upload-on-save pipeline |
| P3-T02 | done | P3-T01 | Save failure UX (upload_failed + retry) |
| P3-T03 | done | P3-T01 | Drafts store (references only) |
| P3-T04 | done | P3-T03 | Draft re-open |
| P3-T05 | done | P3-T01 | orders.buildPayload (live order schema) |
| P3-T06 | done | P3-T05 | Server submit helper |
| P3-T07 | done | P3-T02, P3-T03, P3-T04, P3-T05, P3-T06 | Full happy-path e2e |
| P3-T08 | done | P3-T07 | Integration quickstart & API reference docs |

### P4 · Live & Pilot
| ID | Status | depends_on | Title | Note |
|---|---|---|---|---|
| P4-T01 | done | P3 exit | HttpTransport (catalog + orders) | real documented paths |
| P4-T02 | blocked | P4-T01 | Live assets upload (session/asset reconciliation) | **expected blocker** — storage-CORS/staging |
| P4-T03 | todo | P4-T01 | Live templates | **expected blocker** — endpoint missing |
| P4-T04 | todo | P4-T01 | CORS verification | **expected blocker** — API policy |
| P4-T05 | todo | P4-T01 | API-docs update pass | docs deliverable |
| P4-T06 | done | P4-T01 | SRI + CSP + privacy guidance | |
| P4-T07 | todo | P4-T01, P4-T06 | Publish + Riley's pilot | may run hybrid if T02–T04 parked |
| P4-T08 | done | P4-T06 | Release pipeline (GP-15) | dry-run gate; real publish is human go-live |

### P5 · Visual Parity (spec: `docs/13-visual-parity.md`)
| ID | Status | depends_on | Title |
|---|---|---|---|
| P5-T01 | done | — | Theme tokens + copy surface (store palette defaults) |
| P5-T02 | done | P5-T01 | Modal shell & layout (white card, 50/50, wave, 700px) |
| P5-T03 | done | P5-T02 | Canvas area + upload overlay (dropzone card removed) |
| P5-T04 | done | P5-T02 | Slider-only zoom + px tooltip (−/+ buttons removed) |
| P5-T05 | in_progress | P5-T03, P5-T04 | Image-controls card (rotate ±15° + delete + slider) |
| P5-T06 | todo | P5-T02 | Pet-name card (native checkbox + pill input) |
| P5-T07 | todo | P5-T02 | Cutout browser (chips, 3-up pager + dots, layered thumbs, auto-preselect) |
| P5-T08 | todo | P5-T07 | Browse-All modal + search |
| P5-T09 | todo | P5-T03, P5-T05, P5-T06, P5-T07, P5-T08 | Save row + full-parity sweep |

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

### P4-T02 — Live asset upload (two-step, against real storage)   (blocked)
- What I tried: HttpTransport ships for the live catalog paths (P4-T01). Its asset methods
  (`declareAsset`/`putAssetBytes`/`finalizeAsset`) are present but reject with a "wired in P4-T02"
  notice; the declare→PUT→finalize wiring itself is straightforward. The task's value, though, is
  validating the **browser PUT to real presigned object storage** — which a mock cannot prove.
- Why it's blocked: the gate is `npm run test:e2e -- http-assets` **(staging)** — deliberately
  staging-only (unlike P4-T01, whose gate allows a contract-mock). No staging `/v1/assets` endpoint
  and no storage-bucket CORS for channel origins exist in this environment (GP-02, backend/infra;
  phase `P4-T02` note; `docs/04` §2.3). Passing this against a mock would fake the one thing the gate
  exists to check, so per `AGENTS.md` §0.4/§5 it parks.
- What would unblock it: a staging `/v1/assets` (declare→PUT→finalize) reachable, **and**
  storage-bucket CORS deployed for registered channel origins (GP-02). Then wire the three calls in
  HttpTransport and validate the real browser PUT against staging.
- Safe to skip ahead? **yes** — `P4-T06` (SRI+CSP+privacy, machine-gated) and `P4-T05` (docs) are
  runnable and independent; the fixtures asset flow (declare→PUT→finalize → local object URL) covers
  the pipeline meanwhile (P3 e2e). `P4-T03`/`P4-T04` are also expected blockers; `P4-T07` may run
  hybrid/fixtures-backed while these are parked.

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
- P1-T01 done — typecheck+lint+build green — ba30226
- P1-T02 done — verify+size+check:no-secret green — 5ca28bb
- P1-T03 done — typecheck green; surface == docs/10 — 01e6d5d
- P1-T04 done — npm test -- config green (15 tests) — b165747
- P1-T05 done — npm test -- errors green (6 tests) — 4a3ae03
- P1-T06 done — npm test -- transport green (21 tests) — 01917a8
- P1-T07 done — npm test -- catalog green (10 tests); verify green — 07661ec
- P1-T08 done — npm test -- api green (8 tests); verify green — 9ba9d67
- P1-T12 done — npm test -- events green (7 tests); verify green — 4c189ae
- P1-T09 done — npm test -- cutout-engine/geometry green (16 tests) — eb9c192
- P1-T10 done — npm test -- cutout-engine && lint green (31 tests) — 2df95f6
- P1-T11 done — npm run test:golden green (38 tests; 0% pixel diff vs store baselines) — 01e0810
- Phase P1 complete — exit gate green (verify + test:golden + check:no-secret; 130 tests)
- P2-T01 done — test:e2e designer-shell green (15 tests, 3 browsers) — d152691
- P2-T02 done — size green (loader 7.76 KB, designer 1.79 KB, purity check) — 0f7b398
- P2-T03 done — test:a11y + designer-a11y e2e green (15 tests) — ab985fe
- P2-T04 done — test:e2e designer-theming green (9 tests) — 1ad30e8
- P2-T05 done — test:e2e designer-upload green (18 tests; full suite 57) — 6ec6ce5
- P2-T06 done — test:e2e designer-heic + size green (6 tests; fixed bare-import packaging bug) — 54c0a0e
- P2-T07 done — test:e2e designer-position green (18 tests) — 5edf98d
- P2-T08 done — test:e2e designer-cutouts green (18 tests) — 2357939
- P2-T09 done — test:e2e designer-text green (15 tests; Mitr bundled as lazy chunk) — 26ce15a
- P2-T10 done — test:e2e designer-lowres green (9 tests) — 2378bb4
- P2-T11 done — test:e2e designer-save-local green (12 tests; Chromium toBlob-stall fallback) — b4452b9
- Phase P2 complete — exit gate green (verify + 135 e2e + 15 a11y + budgets + no-secret)
- P3-T01 done — test:e2e save-pipeline green (9 tests) — 01ff2aa
- P3-T02 done — test:e2e save-failure green (15 tests) — 9e7fdce
- P3-T03 done — drafts unit+e2e green (18 tests) — 92b5187 + 9587393
- P3-T04 done — test:e2e draft-reopen green (12 tests) — 2c74ee1
- P3-T05 done — npm test -- orders green (3 tests) — b534512
- P3-T06 done — npm test -- server + check:no-secret green (4 tests) — 42eb180
- P3-T07 done — test:e2e happy-path green (3 browsers) — 99c2097 + aebeca0
- P3-T08 done — test:e2e quickstart green (6 tests, 3 browsers; doc↔harness lockstep) — edbda4a
- Phase P3 complete — exit gate green (verify + 189 e2e + check:no-secret; drafts references-only)
- P4-T01 done — test:e2e http-catalog-orders green (12 tests, 3 browsers) + 7 unit; full e2e 201 green — d3b5837
- P4-T02 blocked — live asset PUT needs staging + storage-bucket CORS (GP-02); parked per AGENTS §5
- P4-T06 done — test:e2e no-third-party green (3 browsers); CSP/SRI + Charter §9 privacy note shipped — 5e53278
- P4-T08 done — release:dry-run green (build+size+no-secret+pack+SRI); tags:v* CI gate; RELEASING.md — 3d6ce9c
- Phase P5 planned — visual-parity spec (`docs/13`) + plan (`phases/05`) authored from store source
  (PetCustomizer.jsx, API mode); owner decisions 2026-07-21: store palette = defaults, rotation IN,
  slider-only zoom, header kept, no pet-type
- P5-T01 done — typecheck + config(15)+theme(6) unit + lint green; full suite 159
- P5-T02 done — test:e2e designer-shell+designer-theming green (27 tests, 3 browsers) + size — 94a5e65
- P5-T03 done — test:e2e designer-upload+heic+lowres green (33 tests, 3 browsers) — 190e821
- P5-T04 done — test:e2e designer-position (21) + test:a11y (15) green, 3 browsers — a846da7
