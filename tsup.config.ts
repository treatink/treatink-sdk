import { defineConfig } from 'tsup';

/**
 * Two independent builds from one repo (docs/01 §2):
 *  - browser: the `Treatink` entry. NO secret-key code path (enforced by scripts/check-no-secret.mjs).
 *    The designer loads as a lazy chunk on first open (code-split), keeping the loader ≤ 15 KB gz.
 *  - server:  @treatink/sdk/server — the one secret-key op (order submit), Node only.
 */
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'es2020',
    platform: 'browser',
    dts: true,
    splitting: true, // enables the lazy designer/HEIC chunks
    treeshake: true,
    clean: true,
    sourcemap: true,
    // The browser bundle is self-contained (no third-party fetches, no bare imports on a partner
    // page — docs/11 §2). Runtime deps bundle in; the dynamic import keeps heic2any a lazy chunk.
    noExternal: ['heic2any', 'exifr'],
  },
  {
    entry: { 'server/index': 'server/index.ts' },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    dts: true,
    treeshake: true,
    sourcemap: true,
  },
]);
