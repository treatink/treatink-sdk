# CLAUDE.md

This repository is `@treatink/sdk`, built phase-by-phase from a **build blueprint** under an
automated execute-and-verify loop.

**Before doing anything, read [`AGENTS.md`](./AGENTS.md) — the loop contract — then
[`STATE.md`](./STATE.md).** Everything you need is linked from [`BLUEPRINT.md`](./BLUEPRINT.md).
(`README.md` is the partner/developer-facing SDK readme, not the build entry point.)

## The rules that matter most

1. **Ground-truth priority** (`BLUEPRINT.md`): the real `treatink` store customizer code wins on all
   math/logic; the Charter wins on scope; the live API is the real wire contract; Appendix D is
   intent only.
2. **Gates decide "done."** Advance only when a task's acceptance-gate command passes. Never fake,
   weaken, or skip a gate. If stuck, follow the **BLOCKED protocol** in `AGENTS.md` §5.
3. **Fixtures-first.** Build and test against bundled fixtures (the contract). Do not build against
   live endpoints that don't exist yet — see `docs/04-api-reconciliation.md`.
4. **Photos are sensitive.** No image bytes stored locally, no third-party requests, TLS only.

## Where things are

- `BLUEPRINT.md` — the build blueprint: reading order + ground-truth priority table
- `AGENTS.md` — how the automated loop works (read every iteration)
- `STATE.md` — progress ledger (the loop's memory)
- `docs/` — architecture, conventions, workflow, API reconciliation, engine reference, gates, glossary
- `phases/` — the executable phase plans (P1 Core → P4 Live & Pilot)
- `.claude/skills/sdk-build-loop/` — the driver skill
- `Treatink_SDK_Design_Brief_and_Charter_2.md` — the Charter (scope/product source of truth)

## Reference codebase (not in this repo)

The current store lives at `../treatink/`. Its customizer
(`web/src/components/customizer/…` + `web/src/hooks/useFileHandlers.js`) is the **authoritative
reference for all customizer math**. `docs/05-engine-reference.md` pins the exact files and lines.
