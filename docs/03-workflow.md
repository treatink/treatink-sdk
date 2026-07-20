# 03 · Workflow — the execute-and-verify loop

This expands `AGENTS.md` with the mechanics, data structures, and rationale of the loop. `AGENTS.md`
is the contract you must obey; this is the manual that explains it.

## 1. Why this loop (and not runtime re-planning)

The planning is already done — it lives in `phases/`. A loop that re-plans each phase at runtime
would (a) burn tokens re-deriving decisions already made, (b) drift from the Charter's locked
decisions, and (c) make "done" a matter of judgment. Instead we make the loop a **deterministic
execute → verify → advance** cycle whose only advance condition is a **green gate**. That is what
makes unattended running safe.

## 2. The unit of work: a task

A task is the smallest independently-verifiable, independently-committable change. Each has:

| Field | Meaning |
|---|---|
| `id` | stable, e.g. `P1-T03` (`P<phase>-T<nn>`) |
| `title` | one line |
| `depends_on` | task IDs that must be `done` first |
| `does` | what to build (the phase file has full detail) |
| `dod` | Definition of Done — observable outcomes |
| `gate` | exact command(s) + pass threshold that prove `dod` |
| `refs` | docs / store-code citations to read before starting |
| `status` | `todo` \| `in_progress` \| `done` \| `blocked` (tracked in `STATE.md`) |

Tasks are defined in `phases/0X-*.md`. `STATE.md` mirrors `id`, `depends_on`, `status` for fast
loop scheduling. **Phase file = task content; STATE.md = task status.** They must stay consistent;
if they disagree, trust `STATE.md` for status and fix the mismatch.

## 3. Scheduling

```
runnable(T)  :=  T.status == todo
             AND every d in T.depends_on has status == done
             AND T.phase entry-gate passes
             AND T is not blocked
next         :=  first runnable task in (phase order, then file order)
```

If `next` is empty: stop and report — either all done, or the only remaining tasks are blocked or
gated on an unmet phase entry. Never guess past a gate.

## 4. Executing one task (detailed)

1. **Load context.** Read the phase file entry for `T` and every doc/citation in `T.refs`. For
   ported behavior, open the actual store file+lines — do not work from memory or the Charter.
2. **Set `in_progress`** in `STATE.md` (so a crash mid-task is visible on resume).
3. **Implement** the smallest change satisfying `T.dod`, following `docs/01` (layout) and `docs/02`
   (standards). Write the tests the task specifies.
4. **Gate.** Run `T.gate` exactly. Capture output.
   - **All green** → §5 commit path.
   - **Any red** → §6 retry path.

## 5. Commit path (gate green)

1. `git add` only the files this task changed.
2. Commit with the `AGENTS.md` §7 format (task ID prefix; name the ground-truth source followed).
3. Set `T.status = done` in `STATE.md`.
4. Append an **Iteration Log** line to `STATE.md`:
   `<TASK_ID> done — <gate summary> — <commit short-sha or "committed">`.
5. Continue the loop (`§3 next`).

## 6. Retry path (gate red)

- Form a hypothesis about the failure. Apply the smallest fix. Re-run the gate.
- Repeat up to `RETRY_BUDGET` (default **3**) attempts total for this task.
- **Thrash guard:** if two consecutive attempts fail the *same* way with no new hypothesis, treat
  the budget as exhausted now — stop retrying.
- Budget exhausted → §7 blocked path. Do **not** weaken the gate, skip a test, or fake success.

## 7. Blocked path (`AGENTS.md` §5)

1. `T.status = blocked` in `STATE.md`.
2. Add a structured entry to the **Blockers** section (template in `STATE.md`).
3. If other tasks are runnable and independent of `T`, continue with them. Else STOP and surface
   the blocker list to the human.

A blocker is a **clean, expected outcome** — especially for the known Phase-4 live-API gaps and the
absent Shopify prototype (`docs/04`). Parking beats faking, every time.

## 8. Phase transitions

- A phase is complete when all its tasks are `done` **and** its **exit gate**
  (`phases/00-overview.md`) passes (typically: full test suite + size budgets + a11y for UI phases).
- Before starting a phase, its **entry gate** must pass (e.g. Phase 2 requires the engine golden
  tests from Phase 1 green). Entry/exit gates are listed per phase in `phases/00-overview.md`.
- Record phase completion in `STATE.md` (phase status + Iteration Log).

## 9. Resumability

The loop can be killed and restarted at any point. On restart: read `STATE.md`, find the first
runnable task, continue. An `in_progress` task from a previous crashed run should be re-verified:
run its gate; if green, complete it; if not, treat it as a fresh attempt. Because commits are
atomic per task, the repo is always in a consistent, resumable state.

## 10. Definition of Done for the whole build (Charter §14)

The project is done when all phases are `done` and this holds:
- A developer with no prior context integrates designer-through-order **in fixtures mode in under a
  day** using only the public docs.
- The Riley's designer is reproduced as a **native modal, no iframe**.
- **Golden tests pass** within tolerance.
- **No secret key** can transit the browser bundle (build-time check green).
- **Bundle budgets hold.**
- (Phase 4, may be gated) the bundle is live at `sdk.treatink.com/v1/treatink.js` against staging.

## 11. Human touchpoints

The loop is autonomous but not unsupervised. A human should:
- Kick it off (`/loop` via the `sdk-build-loop` skill) and review the Iteration Log periodically.
- Resolve **Blockers** (decisions, assets, endpoints). Each blocker states exactly what would
  unblock it.
- Approve phase transitions if they prefer a checkpoint per milestone (optional — the loop can run
  straight through if entry/exit gates pass).
