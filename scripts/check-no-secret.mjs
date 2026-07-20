// Build-time security gate (docs/06 §6, docs/11 §1): prove the BROWSER bundle contains no
// secret-key code path. Fails the build if a secret-key prefix, bearer-with-sk, or an import of the
// server entry appears in dist/index.js (or its chunks). Runs after `npm run build`.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';
// Patterns that must NEVER appear in the browser bundle.
const FORBIDDEN = [
  /sk_(test|live)_/, // a secret key literal
  /@treatink\/sdk\/server/, // importing the server entry into the browser build
  /['"`]sk_['"`]/, // secret-prefix handling
];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'server') continue; // the server build is allowed to use secrets
      out.push(...(await walk(p)));
    } else if (e.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

let failed = false;
try {
  for (const file of await walk(DIST)) {
    const src = await readFile(file, 'utf8');
    for (const rx of FORBIDDEN) {
      if (rx.test(src)) {
        console.error(`✗ secret-key path found in ${file}: ${rx}`);
        failed = true;
      }
    }
  }
} catch (err) {
  console.error('check:no-secret could not read dist/ — run `npm run build` first.', err.message);
  process.exit(2);
}

if (failed) {
  console.error('\ncheck:no-secret FAILED — the browser bundle must not contain any secret-key path.');
  process.exit(1);
}
console.log('✓ check:no-secret: browser bundle is clean.');
