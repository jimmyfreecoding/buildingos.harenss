/**
 * Workspace resolution — the tenant workspace is the unit the CLI/runtime operates on.
 *
 * The BuildingOS repository is the TOOL; a tenant workspace is the USER'S PROJECT:
 * a directory that carries the `.buildingos/` marker (the AI application's brain)
 * plus `knowledge/`. Resolution order (git-like, tool/tenant separation):
 *
 *   1. explicit `--workspace <dir>` flag / positional root
 *   2. `BUILDINGOS_WORKSPACE` environment variable
 *   3. upward search from the current directory for a `.buildingos/` marker
 *   4. error with guidance (never silently guess)
 *
 * The pointer is bootstrap configuration (local state, never Git — runtime-bootstrap §2);
 * a persistent default (`~/.buildingos/config.json`) is deferred to M2 if needed.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Upward search (like git finding .git): nearest ancestor of `start` carrying `.buildingos/`. */
export function findWorkspace(start: string): string | undefined {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, '.buildingos'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export type WorkspaceResolution =
  | { root: string; method: 'flag' | 'env' | 'upward-search' }
  | { error: string };

export function resolveWorkspace(opts: { flag?: string; env?: string; cwd?: string }): WorkspaceResolution {
  if (opts.flag) return { root: path.resolve(opts.flag), method: 'flag' };
  if (opts.env) return { root: path.resolve(opts.env), method: 'env' };
  const found = findWorkspace(opts.cwd ?? process.cwd());
  if (found) return { root: found, method: 'upward-search' };
  return {
    error:
      'no workspace found: no .buildingos/ marker from the current directory upward. ' +
      'Run `buildingos init <dir>` to scaffold one, or point at it with --workspace <dir> / BUILDINGOS_WORKSPACE.',
  };
}
