// Static server for the built SDK (playwright webServer + local demo). Serves:
//   /                       → test/e2e/harness/index.html (the e2e harness — always fixtures)
//   /demo/storefront.html   → demo/storefront.html        (the human-facing demo)
//   /dist/*                 → dist/*      (run `npm run build` first)
//   /fixtures/*             → fixtures/*  (catalog images + cutout masks)
// One origin (http://localhost:5199) serves both pages — that's the origin registered on the
// storage-bucket CORS allow-list, so the demo's live upload PUT is covered too (origin = host:port,
// path is irrelevant). Local dev/CI only — no external requests, no dependencies.
//
// Pass --dev (see `npm run dev`) to add: a `tsup --watch` child that rebuilds dist on every source
// change, plus browser auto-reload (an SSE stream + a tiny injected script). Everything dev-only is
// guarded by the DEV flag, so `npm run harness` / the e2e webServer behave exactly as before.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';

const DEV = process.argv.includes('--dev');
// 5199, not 5173 — the vite default clashes with other local dev servers/containers.
const PORT = 5199;
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.css': 'text/css',
  '.ttf': 'font/ttf',
};

// --- dev-only: live reload plumbing --------------------------------------------------------------
const reloadClients = new Set(); // open SSE responses
const RELOAD_SNIPPET = `\n<script>new EventSource('/__livereload').onmessage=()=>location.reload();</script>\n`;

function notifyReload() {
  for (const res of reloadClients) res.write('data: reload\n\n');
}

if (DEV) {
  // Rebuild dist on source change. tsup does its own initial build on start.
  // Run it in its own process group (detached) so we can tear the WHOLE tree down — tsup spawns
  // esbuild children that a plain child.kill() would orphan (they'd keep the build lock and wedge
  // the next `npm run harness`).
  const bin = join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsup.cmd' : 'tsup',
  );
  const tsup = spawn(bin, ['--watch'], { stdio: 'inherit', detached: true });
  const killTree = () => {
    try {
      process.kill(-tsup.pid); // negative pid = the whole process group
    } catch {
      /* already gone */
    }
  };
  process.on('exit', killTree);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(0));
  // When a rebuild lands in dist/, tell every open browser tab to reload (debounced).
  let timer;
  watch(join(ROOT, 'dist'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(notifyReload, 150);
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  // dev-only: the browser's reload channel.
  if (DEV && url.pathname === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 500\n\n');
    reloadClients.add(res);
    req.on('close', () => reloadClients.delete(res));
    return;
  }

  try {
    let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    if (path === '/' || path === '') path = '/test/e2e/harness/index.html';
    // /dist, /fixtures and /demo resolve from the repo root as-is; anything else
    // resolves inside the e2e harness dir (so specs can request bare filenames).
    else if (!/^\/(dist|fixtures|demo)\//.test(path)) {
      path = join('/test/e2e/harness', path);
    }
    const file = await readFile(join(ROOT, path));
    const type = MIME[extname(path)] ?? 'application/octet-stream';
    // dev-only: inject the auto-reload script into HTML. Non-dev responses are byte-identical.
    if (DEV && extname(path) === '.html') {
      const html = file.toString('utf8').replace('</body>', RELOAD_SNIPPET + '</body>');
      res.writeHead(200, { 'Content-Type': type });
      res.end(html);
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(
    `\n  Treatink SDK — local server on http://localhost:${PORT}${DEV ? '  (dev: watch + auto-reload)' : ''}\n`,
  );
  console.log(`  • demo storefront : http://localhost:${PORT}/demo/storefront.html`);
  console.log(`  • e2e harness     : http://localhost:${PORT}/            (fixtures only)\n`);
});
