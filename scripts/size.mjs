// Bundle-budget gate (docs/06 §2): loader ≤ 15 KB gz, designer chunk ≤ 150 KB gz.
// Wraps size-limit because the designer chunk does not exist until P2 — size-limit hard-fails on a
// missing path. The designer budget activates automatically the moment the chunk is built; until
// then this logs loudly that it is pending (never a silent cap). Budgets live HERE, one place.
import { readdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const BUDGETS = [
  { name: 'loader', path: 'dist/index.js', limit: '15 KB', gzip: true },
  { name: 'designer chunk', path: 'dist/designer-*.js', limit: '150 KB', gzip: true },
];

let dist = [];
try {
  dist = readdirSync('dist');
} catch {
  console.error('size: dist/ not found — run `npm run build` first.');
  process.exit(2);
}

const hasDesigner = dist.some((f) => /^designer-.*\.js$/.test(f));
const entries = BUDGETS.filter((b) => b.name !== 'designer chunk' || hasDesigner);
if (!hasDesigner) {
  console.log(
    'size: designer chunk not built yet (arrives in P2) — its 150 KB budget is NOT evaluated this run.',
  );
}

// size-limit reads package.json before rc files, so config must not live there; we generate the rc.
writeFileSync('.size-limit.json', JSON.stringify(entries, null, 2) + '\n');
const r = spawnSync('npx', ['size-limit'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
rmSync('.size-limit.json', { force: true });
process.exit(r.status ?? 1);
