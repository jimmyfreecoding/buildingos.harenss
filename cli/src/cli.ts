/**
 * @buildingos/cli — command dispatch.
 *
 *   buildingos init <dir>      first-boot wizard (language → engine → model → credentials → git)
 *   buildingos web             start the web console (the interaction surface)
 *   buildingos dev [root]      start the tenant dev environment (docker compose up)
 *
 * The interaction surface is the web console (`buildingos web`); the CLI keeps
 * the bootstrap commands (init/dev) and the web entry. Pipeline operations
 * (validate/compile/conformance) live in the web console's API.
 */
import { existsSync, realpathSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConsoleIO, runWizard, findToolDir } from '@buildingos/bootstrap';
import { resolveWorkspace } from './workspace.js';

function usage(): void {
  console.log(`BuildingOS CLI — the tool; a tenant workspace (a dir with .buildingos/) is the user's project.
  buildingos init [dir]       first-boot wizard (language → engine → model → credentials → git)
                              [dir] optional: default = current directory (git-init style)
  buildingos web [--port N]   start the web console — the interaction surface (workspace picker, docs, wizard, pipeline, dev env)
  buildingos dev [root]       start the tenant dev environment (docker compose up)
  Workspace resolution: --workspace <dir> | positional root | BUILDINGOS_WORKSPACE | upward .buildingos/ search
`);
}

/** Absolute path of this module (works in the ESM build and the CJS bundle). */
function moduleSelfPath(): string {
  return typeof __filename === 'string' ? __filename : fileURLToPath(import.meta.url);
}

/** Locate the tool repo for the dev environment: CLI location → BUILDINGOS_TOOL_DIR → upward search. */
export function toolDirFor(): string | undefined {
  const env = process.env.BUILDINGOS_TOOL_DIR;
  if (env) return path.resolve(env);
  // Running from the tool repo (dev / dogfooding): walk up from this file.
  const found = findToolDir(path.dirname(moduleSelfPath()));
  if (found) return found;
  // Fall back to the current working directory's upward search.
  return findToolDir(process.cwd());
}

/** `buildingos dev` — bring up the tenant's docker compose (M1.5 ②, dev-environment.md §4 D). */
export async function cmdDev(
  root: string,
  rest: string[],
  spawner: typeof spawn = spawn,
): Promise<number> {
  const composePath = path.join(root, 'docker-compose.yml');
  if (!existsSync(composePath)) {
    console.error(`dev: no docker-compose.yml in ${root} — run \`buildingos init\` first (it generates the dev environment).`);
    return 1;
  }
  const toolDir = toolDirFor();
  const extra = rest.filter((a) => a !== '--workspace' && a !== '-w');
  const args = ['compose', 'up', ...extra];
  console.log(`dev: docker compose up (workspace=${root})${toolDir ? `, BUILDINGOS_TOOL_DIR=${toolDir}` : ''}`);
  const child = spawner('docker', args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BUILDINGOS_TOOL_DIR: toolDir ?? '', BUILDINGOS_WORKSPACE: root },
  });
  return await new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      console.error(`dev: failed to start docker — ${err.message} (is Docker installed and running?)`);
      resolve(1);
    });
  });
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Resolve the tenant workspace root for a command. */
function resolveRoot(flag: string | undefined, positional: string | undefined): { root: string } | { error: string } {
  return resolveWorkspace({ flag: flag ?? positional, env: process.env.BUILDINGOS_WORKSPACE });
}

/** init target: with [dir] → ./<dir>; without → current directory (git-init style). */
export function initTarget(argv: string[]): string {
  return argv[0] ? path.resolve(argv[0]) : process.cwd();
}

/**
 * Locate the built web console server inside the tool repo. Returns the path
 * to web/dist/server/index.js when built, else undefined.
 */
export function webServerPath(): string | undefined {
  const env = process.env.BUILDINGOS_TOOL_DIR;
  const tool = env
    ? path.resolve(env)
    : findToolDir(path.dirname(moduleSelfPath())) ?? findToolDir(process.cwd());
  if (!tool) return undefined;
  const server = path.join(tool, 'web', 'dist', 'server', 'index.js');
  return existsSync(server) ? server : undefined;
}

/** `buildingos web` — start the web console (the interaction surface). */
export async function cmdWeb(rest: string[], spawner: typeof spawn = spawn): Promise<number> {
  const port = Number(arg(rest, '--port') ?? process.env.PORT ?? 4399);
  const host = arg(rest, '--host') ?? '127.0.0.1';
  const server = webServerPath();
  if (!server) {
    console.error('web: built console not found — build it first with `pnpm --filter @buildingos/web build` (run from the tool repo), or set BUILDINGOS_TOOL_DIR to the tool repo.');
    return 1;
  }
  const child = spawner(process.execPath, [server, String(port), host], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log(`buildingos web: http://${host}:${port}  (Ctrl+C to stop)`);
  return await new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      console.error(`web: failed to start — ${err.message}`);
      resolve(1);
    });
  });
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'init': {
      // Scaffold where the user is. The tool-repo guard in initTenant refuses
      // targets containing pnpm-workspace.yaml.
      const target = initTarget(rest);
      const toolDir = findToolDir(path.dirname(moduleSelfPath())) ?? findToolDir(process.cwd());
      const result = await runWizard(target, createConsoleIO(), { toolDir });
      return result.ok ? 0 : 1;
    }
    case 'web':
      return cmdWeb(rest);
    case 'dev': {
      // Positional root = first arg that is not a flag (dev passes rest through to docker compose).
      const wsFlag = arg(rest, '--workspace') ?? arg(rest, '-w');
      const positional = rest.find((a) => a !== wsFlag && !a.startsWith('-'));
      const resolved = resolveRoot(wsFlag, positional);
      if ('error' in resolved) {
        console.error(resolved.error);
        return 1;
      }
      return cmdDev(resolved.root, rest);
    }
    default:
      usage();
      return 2;
  }
}

// Run as the CLI entry when this module is the executed file — robust for the
// ESM tsc build (dist/cli.js, via import.meta.url), the CJS esbuild bundle
// (dist/cli.bundle.cjs, via __filename), and pnpm global installs where the
// global dir is a symlink/junction into the store (compare realpaths).
function isCliEntry(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return realpathSync(moduleSelfPath()) === realpathSync(arg);
  } catch {
    return path.resolve(moduleSelfPath()) === path.resolve(arg);
  }
}

if (isCliEntry()) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
