/**
 * Bundle the CLI into a single self-contained CJS file (dist/cli.bundle.cjs):
 * all @buildingos/* workspace packages and runtime deps (yaml) are inlined,
 * so the installed `buildingos` binary needs no external dependencies —
 * this is what makes `pnpm install -g` work from the built package.
 * CJS output because runtime deps (yaml) use CJS require.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/cli.bundle.cjs',
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'info',
});
