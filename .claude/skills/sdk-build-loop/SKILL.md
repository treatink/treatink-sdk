---
name: sdk-build-loop
description: Drive the Treatink SDK execute-and-verify build loop — pick the next runnable task from STATE.md, implement it, run its acceptance gate, commit on green, park a blocker on red. Use when building this SDK from the blueprint (phases/ + docs/), whether running one task, one phase, or the whole build via /loop.
---

# sdk-build-loop

You are executing the Treatink SDK build under the **execute-and-verify loop**. The full contract is
[`AGENTS.md`](../../../AGENTS.md); the mechanics are [`docs/03-workflow.md`](../../../docs/03-workflow.md).
This skill is the operational checklist for **one iteration**. Run it repeatedly (via `/loop`, or
once per invocation) until a stop condition.

## Before anything

1. Read [`AGENTS.md`](../../../AGENTS.md) — the rules. Re-read every iteration; do not cache from memory.
2. Read [`STATE.md`](../../../STATE.md) — current phase, statuses, blockers, next runnable.
3. Honor the **ground-truth priority** (`README.md`): store code > Charter scope > live API >
   Appendix D. Cite the source you follow.

## One iteration

1. **Select** the next runnable task `T` (`docs/03` §3): `status: todo`, all `depends_on` `done`,
   phase entry gate passed, not blocked. First in (phase order, then file order).
   - None runnable? → **Stop conditions** below.
2. **Claim it:** set `T.status = in_progress` in `STATE.md`.
3. **Load context:** read the task block in its `phases/0X-*.md` and every doc/citation in `refs`.
   For ported behavior, open the actual `../treatink/...` file+lines — never paraphrase the Charter.
4. **Implement** the smallest change satisfying `T.dod`, following `docs/01` (layout) + `docs/02`
   (standards). Write the tests the task specifies.
5. **Gate:** run `T.gate` exactly (commands from the task / `docs/06`). Capture output.
   - **Green** → commit (`AGENTS.md` §7 — **Conventional Commits** `type(scope): summary`, **no
     Claude co-author ever**, task id in body) → set `T.status = done` → append an Iteration Log line
     in `STATE.md` → go to 1.
   - **Red** → fix with a real hypothesis, re-run; up to **RETRY_BUDGET (3)** attempts. Thrashing
     (same failure twice, no new idea) = budget spent. Still red → **park** (below).

## Parking a blocker (a clean, expected outcome)

Never fake a gate, weaken a threshold, skip a test, or invent a live endpoint to escape (`AGENTS.md`
§0, §8). Instead:
1. `T.status = blocked` in `STATE.md`.
2. Add a **Blockers** entry (template in `STATE.md`): what you tried, why blocked (cite doc/section
   or missing dep), what would unblock it, whether it's safe to skip ahead.
3. If other tasks are runnable and independent of `T`, continue with them; else **stop** and surface
   the blocker list to the human.

Expected blockers (not failures — `docs/04` §3): **P4-T02** (sessions↔assets mapping decision),
**P4-T03** (missing live templates endpoint), **P4-T04** (per-channel CORS). Park these; the SDK
stays shippable in fixtures mode.

## Phase transitions

- Phase done = all its tasks `done` **and** its exit gate (`phases/00-overview.md`) green. Record it
  in `STATE.md` (phase status + Iteration Log), then start the next phase only if its entry gate
  passes; otherwise stop and report.

## Stop conditions (report to the human)

- **Blocked, nothing runnable:** list the blockers and their exact unblock needs.
- **Phase checkpoint:** if the human asked for one phase, stop at its exit gate.
- **Project done:** all phases `done` + MVP DoD (`phases/00` / Charter §14) verified — report the
  summary.

## Non-negotiables (from `AGENTS.md`)

- Gates decide "done," never judgment. One task → one commit. Never commit red/skipped gates.
- No secret-key path in the browser build; no third-party requests; no image bytes stored locally.
- Build against **fixtures**; `HttpTransport` is Phase 4. Don't assume live endpoints `docs/04` §1
  doesn't list.
- Don't re-plan phases. If a plan is wrong, that's a blocker with `unblock: corrected plan`.

## Resuming

The loop is resumable: on restart, read `STATE.md`, re-verify any `in_progress` task (run its gate),
and continue from the first runnable task. Atomic per-task commits keep the repo consistent.
