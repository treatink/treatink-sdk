# Contributing

## Workflow
This repo is built under the execute-and-verify loop — read [`AGENTS.md`](./AGENTS.md) and
[`STATE.md`](./STATE.md). One task → one commit → advance only on a green gate.

## Commits — Conventional Commits, author = repo owner only
```
type(scope): imperative summary

optional body. Task: <TASK_ID>. Gate: <cmd> -> pass
```
- **type**: `feat | fix | docs | test | refactor | chore | build | ci | perf | style`
- **scope**: `core | transport | engine | designer | drafts | save | orders | server | fixtures | catalog | media | deploy | ci`
- Examples: `feat(transport): add FixtureTransport two-step asset flow` · `fix(engine): clamp zoom floor to 0.5`
- **Never** add `Co-Authored-By:` or any Claude/Anthropic attribution. Commits are authored solely
  by the repo owner (git-config identity). Hard rule.

## Local commands (gates)
```
npm run typecheck     # tsc --noEmit, strict
npm run lint          # eslint + prettier --check (engine DOM-purity + no-innerHTML enforced)
npm test              # vitest unit + golden
npm run test:golden   # engine golden images
npm run test:e2e      # playwright, fixtures mode
npm run test:a11y     # axe
npm run size          # bundle budgets (loader ≤15KB gz, designer ≤150KB gz)
npm run build && npm run check:no-secret   # no secret-key path in the browser bundle
npm run verify        # typecheck + lint + test + size
```

## Ground rules (see docs/)
- Store code > Charter scope > live API > Appendix D (`README.md` priority table).
- Fixtures-first; the cutout-engine stays DOM-free; no image bytes persisted; no third-party requests;
  no secret key in the browser build.
