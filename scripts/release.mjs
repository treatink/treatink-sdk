// Dry-run release pipeline (P4-T08 / GP-15). Charter §4/§13, docs/06 §2/§6, docs/11 §5.
//
// Proves a release is publishable WITHOUT publishing: build → pre-publish gates (size budgets +
// no-secret) → `npm pack` contents validation → SRI hashes + the CDN `integrity` snippet. The gates
// BLOCK a bad publish: a blown budget or a leaked secret-key path exits non-zero here, before any
// upload. Nothing is published — the package is `private` and no credentials are used; the real dual
// publish (CDN `sdk.treatink.com/v1/` + npm) is the guarded go-live step (P4-T07 / RELEASING.md).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Run a command, streaming its output; throw (non-zero exit) on failure. */
function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}
/** Run a command and capture stdout. */
function capture(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' });
}
function fail(message) {
  console.error(`\n✗ release: ${message}`);
  process.exit(1);
}

// 1 · Fresh build (tsup clean) — the artifact every downstream check measures.
console.log('▸ build');
run('npm', ['run', 'build']);

// 2 · Pre-publish gates. These are the release's guardrails (DoD: "budgets + no-secret gates block
//     a bad publish"). Either exiting non-zero aborts the release.
console.log('\n▸ pre-publish gates (size · no-secret)');
run('node', ['scripts/size.mjs']);
run('node', ['scripts/check-no-secret.mjs']);

// 3 · Package contents — what `npm publish` would ship. Validate the dual entry + types are present.
console.log('\n▸ npm pack --dry-run');
let pack;
try {
  const raw = capture('npm', ['pack', '--dry-run', '--json']);
  const start = raw.indexOf('[');
  pack = JSON.parse(start >= 0 ? raw.slice(start) : raw)[0];
} catch (error) {
  fail(`could not parse \`npm pack\` output: ${String(error)}`);
}
const packed = (pack.files ?? []).map((f) => f.path);
const required = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/server/index.js',
  'dist/server/index.d.ts',
];
const missing = required.filter((r) => !packed.includes(r));
if (missing.length) fail(`package is missing required entries: ${missing.join(', ')}`);

// 4 · SRI (sha384) for every published JS file — the CDN `integrity` values (docs/11 §5).
const sri = {};
for (const dir of ['dist', 'dist/server']) {
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    const hash = createHash('sha384')
      .update(readFileSync(join(dir, file)))
      .digest('base64');
    sri[join(dir, file).replace(/^dist\//, '')] = `sha384-${hash}`;
  }
}

// 5 · Documented manifest (the gate's "documented result").
const kb = (n) => (typeof n === 'number' ? `${(n / 1024).toFixed(1)} KB` : 'n/a');
console.log('\n=== dry-run release manifest ===');
console.log(`package:  ${pack.name}@${pack.version}  (${packed.length} files)`);
console.log(
  `tarball:  ${pack.filename ?? 'n/a'} — ${kb(pack.size)} packed, ${kb(pack.unpackedSize)} unpacked`,
);
console.log(`entries:  . -> dist/index.js  ·  ./server -> dist/server/index.js  (+ .d.ts)`);
console.log('\nCDN integrity (entry — https://sdk.treatink.com/v1/index.js):');
console.log(
  `  <script type="module" src="…/v1/index.js" integrity="${sri['index.js']}" crossorigin="anonymous"></script>`,
);
console.log('\nSRI — all published JS (pin lazy chunks via import-map integrity if desired):');
for (const [name, digest] of Object.entries(sri)) console.log(`  ${digest}  ${name}`);
console.log(
  '\n✓ dry-run release OK — gates green, package contents valid. NOT published (private).',
);
