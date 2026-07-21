# Releasing `@treatink/sdk`

The dual release (GP-15): the browser loader + lazy chunks go to the CDN at
`sdk.treatink.com/v1/` (immutable per release; `/v1/` is the non-breaking compatibility channel),
and the package (`.` browser + `./server` + types) goes to npm. Both are guarded by the same
pre-publish gates so a blown budget or a leaked secret-key path blocks the release.

## Dry-run (safe, no credentials, runs anywhere)

```sh
npm run release:dry-run
```

This builds, runs the **pre-publish gates** (`size` budgets + `check:no-secret`), validates the
`npm pack` contents (both entries + types present), and prints the **SRI** hashes + the CDN
`integrity` snippet. It publishes nothing. Bitbucket runs exactly this on every `v*` tag
(`bitbucket-pipelines.yml` → `tags: v*`), so a release cannot proceed with a red gate.

## Go-live (maintainer, credentialed — not automated)

Real publishing is intentionally **not** wired into CI, so no tag can trigger an unreviewed publish.
To ship a version:

1. Bump `version` in `package.json` (semver) and set `"private": false`.
2. Confirm `npm run release:dry-run` is green; capture its manifest (SRI + integrity) for the
   release notes and update the `integrity="…"` value in `docs/12-integration-quickstart.md` §5.
3. **npm:** `npm publish --access restricted` with `NPM_TOKEN` configured.
4. **CDN:** upload `dist/index.js` + its chunks to `sdk.treatink.com/v1/` (immutable path per
   release) and publish the SRI snippet.
5. Tag: `git tag vX.Y.Z && git push --tags` (fires the CI release gate as a final check).

The pilot deployment on rileyspets.com (replacing the iframe) is **P4-T07**; it may run in a
hybrid/fixtures-backed mode while the live asset/template/CORS gaps (P4-T02/T03/T04) are parked.
