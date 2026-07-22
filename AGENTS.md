# AGENTS.md — The Loop Contract

**You are an autonomous build agent working inside an execute-and-verify loop. Read this file at
the start of every iteration.** It defines how you pick work, do it, prove it, commit it, and —
critically — when to stop.

This project was fully planned before any code was written. Your job is **execution, not
re-planning.** The plan lives in [`phases/`](./phases); the truth lives in [`docs/`](./docs); the
progress lives in [`STATE.md`](./STATE.md).

---

## 0. Golden rules (violating any of these fails the iteration)

1. **Gates decide "done," not you.** A task is complete only when its acceptance-gate command
   exits 0 and meets its stated threshold. Never mark a task done because the code "looks right."
2. **Respect the ground-truth priority order** (see [`BLUEPRINT.md`](./BLUEPRINT.md)). Store code >
   Charter scope > live API > Appendix D. When in doubt, cite the source you followed in the commit.
3. **One task, one commit.** Small, atomic, reversible. The commit message names the task ID.
4. **Never fake a gate.** Do not weaken a threshold, skip a test, `xit`/`.skip`, or stub an
   assertion to get green. If a gate is wrong, that is a blocker (see §5), not a code change.
5. **Never invent backend behavior.** If a task needs an endpoint or contract that is not in
   `docs/04-api-reconciliation.md` as *available*, it is blocked. Build against **fixtures**, which
   are the contract, not against imagined live endpoints.
6. **Photos are sensitive.** No image bytes in `localStorage`/IndexedDB, no third-party requests,
   no logging of image data, TLS only. This is a hard constraint, checked in review (see
   `docs/02-conventions.md`).
7. **Stay in budget.** Bundle-size budgets are gates too (`docs/06-testing-and-gates.md`). A
   feature that blows the budget is not done.

---

## 1. The loop, in one screen

```
loop:
  read STATE.md
  pick the next task T:
      - status: todo
      - all of T.depends_on are done
      - not blocked
  if no such task:
      if any task blocked      -> STOP, report blockers (see §5)
      elif all tasks done      -> STOP, phase/project complete (see §6)
      else                     -> STOP, report (nothing runnable)
  mark T in_progress in STATE.md
  read the phase file + every doc T references
  implement T  (smallest change that satisfies its Definition of Done)
  run T's acceptance gate(s)   (exact commands from the task / docs/06)
      green -> commit, mark T done in STATE.md, append to Iteration Log, continue loop
      red   -> retry, bounded:
                  fix and re-run, up to RETRY_BUDGET (default 3) attempts
                  still red -> mark T blocked, write blocker, STOP (see §5)
```

`RETRY_BUDGET` is per task and resets when the task next becomes runnable. "Attempt" = one
implement+gate cycle. Thrashing (same failure twice with no new hypothesis) counts as exhausting
the budget early — stop and report rather than spin.

---

## 2. Picking the next task

- Tasks live in the phase files (`phases/0X-*.md`), each with a stable ID like `P1-T03`.
- `STATE.md` mirrors every task's status and `depends_on`. **`STATE.md` is the source of truth for
  status; the phase file is the source of truth for the task's content.**
- Work phases in order (P1 → P4). Within a phase, honor `depends_on`; otherwise top-to-bottom.
- Do **not** start a task whose dependencies are unmet or whose phase's entry gate is unmet
  (`phases/00-overview.md` lists per-phase entry gates).

## 3. Doing the task

- Make the **smallest** change that satisfies the task's Definition of Done. No speculative
  extras, no adjacent refactors "while you're there."
- Follow `docs/02-conventions.md` (naming, TS strictness, error model, file layout from
  `docs/01-architecture.md`).
- If the task ports store behavior, open the cited file+lines in `../treatink/...` and reproduce
  the logic — do not paraphrase from the Charter. `docs/05-engine-reference.md` pins the citations.
- Write the task's tests **as specified by the task**, not fewer. Tests are part of the task, not
  optional follow-up.

## 4. Proving the task (the gate)

- Every task lists one or more **acceptance gates** — exact shell commands with a pass condition.
- Run them exactly as written. The task is done only if all pass.
- Common gates (full catalogue in `docs/06-testing-and-gates.md`):
  - `npm run typecheck` — `tsc --noEmit`, zero errors
  - `npm test -- <scope>` — unit/golden tests for the task's area
  - `npm run lint`
  - `npm run size` — bundle budgets (loader ≤ 15 KB gz, designer chunk ≤ 150 KB gz)
  - `npm run test:e2e -- <spec>` — Playwright, fixtures mode
  - `npm run test:a11y` — axe checks
- If a gate command does not exist yet, the task that establishes it is a **dependency** — it will
  be an early task in Phase 1. Do not invent gates; use the ones the phase defines.

## 5. When you get stuck — the BLOCKED protocol

Stopping cleanly is a **success condition of the loop**, not a failure. A parked blocker is far
better than a faked gate or an invented endpoint.

Mark a task `blocked` and STOP the loop when:
- A gate cannot pass after `RETRY_BUDGET` honest attempts, **or**
- The task depends on something outside this repo that is not yet available (a live endpoint that
  doesn't exist, the optional Shopify prototype, a design asset, an owner decision).

To park a blocker:
1. Set the task's status to `blocked` in `STATE.md`.
2. Append an entry to the **Blockers** section of `STATE.md`:
   ```
   ### <TASK_ID> — <one-line title>   (blocked <ISO-ish note, no invented dates>)
   - What I tried: …
   - Why it's blocked: … (cite the doc/section or the missing dependency)
   - What would unblock it: … (a decision, an asset, an endpoint, a corrected gate)
   - Safe to skip ahead? yes/no — which tasks remain runnable meanwhile
   ```
3. If other tasks remain runnable and do **not** depend on the blocked one, you may continue with
   them. If nothing is runnable, STOP and surface the blocker list to the human.

**Known, expected blockers** (do not treat as failures — see `docs/04-api-reconciliation.md`):
- Live-mode wiring against endpoints the Charter assumes but the live API lacks (sessions,
  `/v1/artwork`, `/v1/products`, `/v1/templates`). These are **Phase 4** and gated on backend work.
- Golden-test *pixel-parity against the Shopify prototype* — the prototype is not in this repo.
  Our golden tests are generated from the **ported engine's own snapshots against the store
  code's behavior** (see `docs/06`), which is the correct contract given priority order.

## 6. Finishing

- **Task done:** gate green → `git commit` → status `done` in `STATE.md` → Iteration Log entry.
- **Phase done:** all its tasks `done` **and** the phase's exit gate (`phases/00-overview.md`)
  passes. Update the phase's status in `STATE.md`, note it in the Iteration Log, continue to the
  next phase (if its entry gate passes) or STOP and report.
- **Project done:** all phases `done`, MVP Definition of Done (Charter §14 / `phases/00`) verified.
  STOP and report the full summary.

## 7. Commit format — Conventional Commits, author = repo owner ONLY

```
<type>(<scope>): <imperative summary>

<what changed, and which ground-truth source it followed>
Task: <TASK_ID>. Gate: <command(s) run> -> pass
```

- **type** ∈ `feat | fix | docs | test | refactor | chore | build | ci | perf | style`
- **scope** = the area touched: `core | transport | engine | designer | drafts | save | orders |
  server | fixtures | catalog | media | deploy | ci | …`
- Examples: `feat(transport): add FixtureTransport two-step asset flow` ·
  `fix(engine): clamp zoom floor to 0.5 to match store` · `test(drafts): assert no image bytes persist`
- **HARD RULE — no AI attribution.** Never add a `Co-Authored-By:` trailer, "Generated with Claude",
  or any Claude/Anthropic mention. Commits are authored solely by the repo owner (the git-config
  identity). This applies to every commit and every PR body in this repo.

Commit only when the gate is green. Never commit a red or skipped gate. Do not commit
`node_modules`, build output, or secrets.

## 8. What you must never do

- Never put a `tk_live_`/`sk_live_`/`sk_test_` secret key path in browser code (Charter §10.1).
- Never add analytics, external fonts, trackers, or any third-party network request.
- Never store image bytes locally.
- Never mark done, weaken a gate, or invent an endpoint to escape a blocker. Park it (§5).
- Never re-plan a phase from scratch — the plan is in `phases/`. If the plan is *wrong*, that's a
  blocker with `What would unblock it: corrected plan`, surfaced to the human.

## 9. Running the loop

This contract is executed by the [`sdk-build-loop`](./.claude/skills/sdk-build-loop/SKILL.md)
skill. A human starts it with `/loop` (self-paced) or drives one phase at a time. Either way, the
rules above are the same. The loop is **resumable**: on restart, read `STATE.md` and continue from
the first runnable task.
