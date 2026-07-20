// Bundle-budget gate (docs/06 §2): loader ≤ 15 KB gz, designer chunk ≤ 150 KB gz.
// Measures the FILES tsup emitted (no re-bundling): re-bundling would follow dynamic imports and
// wrongly charge lazy chunks (fixture dataset, HEIC decoder) to the loader — Charter §13 says lazy
// chunks are "not counted in the two above". Loader = the entry + its STATIC chunk deps.
// The designer budget activates automatically once its chunk exists (P2); until then this logs
// loudly that it is pending (never a silent cap). Budgets live HERE, one place.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMITS = { loader: 15 * 1024, 'designer chunk': 150 * 1024 };

let dist = [];
try {
  dist = readdirSync('dist');
} catch {
  console.error('size: dist/ not found — run `npm run build` first.');
  process.exit(2);
}

/** Entry file + every file it (transitively) STATICALLY imports. Dynamic imports excluded. */
function staticClosure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file) || !dist.includes(file)) continue;
    seen.add(file);
    const src = readFileSync(join('dist', file), 'utf8');
    // tsup emits ESM: static imports are top-level `import|export … from './x.js'`.
    for (const m of src.matchAll(/^(?:import|export)[^;]*?from\s*['"]\.\/([^'"]+)['"]/gm)) {
      queue.push(m[1]);
    }
  }
  return [...seen];
}

function gzSize(files) {
  return files.reduce(
    (sum, f) => sum + gzipSync(readFileSync(join('dist', f)), { level: 9 }).length,
    0,
  );
}

const kb = (n) => `${(n / 1024).toFixed(2)} KB`;
const checks = [{ name: 'loader', files: staticClosure('index.js') }];

const designerEntry = dist.find((f) => /^designer-.*\.js$/.test(f));
if (designerEntry) {
  checks.push({ name: 'designer chunk', files: staticClosure(designerEntry) });
} else {
  console.log(
    'size: designer chunk not built yet (arrives in P2) — its 150 KB budget is NOT evaluated this run.',
  );
}

let failed = false;
for (const { name, files } of checks) {
  const size = gzSize(files);
  const limit = LIMITS[name];
  const ok = size <= limit;
  failed ||= !ok;
  console.log(
    `${ok ? '✓' : '✗'} ${name}: ${kb(size)} gz (limit ${kb(limit)}) — ${files.join(', ')}`,
  );
}

// P2-T02: designer code must ship ONLY in its lazy chunk — a stray static import would inline it
// into the loader (still possibly under 15 KB, so the budget alone would not catch it).
const DESIGNER_MARKER = 'tk-overlay';
for (const file of checks[0].files) {
  if (readFileSync(join('dist', file), 'utf8').includes(DESIGNER_MARKER)) {
    console.log(`✗ loader purity: designer code (marker '${DESIGNER_MARKER}') found in ${file}`);
    failed = true;
  }
}
if (!failed) console.log('✓ loader purity: no designer code in the loader closure');
process.exit(failed ? 1 : 0);
