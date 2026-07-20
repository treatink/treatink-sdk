// Static e2e harness server (playwright webServer). Serves:
//   /            → test/e2e/harness/index.html (mounts the built SDK)
//   /dist/*      → dist/*      (run `npm run build` first)
//   /fixtures/*  → fixtures/*  (catalog images + cutout masks)
// Local dev/CI only — no external requests, no dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

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

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    if (path === '/' || path === '') path = '/test/e2e/harness/index.html';
    else if (!path.startsWith('/dist/') && !path.startsWith('/fixtures/')) {
      path = join('/test/e2e/harness', path);
    }
    const file = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, () => console.log(`harness: http://localhost:${PORT}`));
