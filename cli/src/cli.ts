/**
 * @buildingos/cli — command dispatch.
 *
 *   buildingos init <dir>                 scaffold a tenant repository
 *   buildingos validate [root]            load + lint a tenant (normalizer diagnostics)
 *   buildingos compile --engine <dsh|codex> [root] [--out <dir>]   render the engine view
 *   buildingos conformance [root]         G1 compile-parity report (G2–G4 engine-gated)
 *
 * The full first-boot wizard (engine/model/credentials/git, docs/runtime-bootstrap.md §2)
 * lands with the runtime CLI (M1.5); these four commands exercise everything that runs today.
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexAdapter } from '@buildingos/adapter-codex';
import { dshAdapter } from '@buildingos/adapter-dsh';
import { runConformance } from '@buildingos/conformance';
import { createConsoleIO, runWizard } from '@buildingos/bootstrap';
import { loadTenantDocs } from '@buildingos/normalizer';
import { resolveWorkspace } from './workspace.js';

function usage(): void {
  console.log(`BuildingOS CLI — the tool; a tenant workspace (a dir with .buildingos/) is the user's project.
  buildingos init [dir]                              first-boot wizard (language → engine → model → credentials → git)
                                                     [dir] optional: default = current directory (git-init style)
  buildingos validate [root]                         load + lint a tenant (normalizer)
  buildingos compile --engine <dsh|codex> [root]     render the engine view (--out <dir>)
  buildingos conformance [root]                      conformance G1 report (needs a golden baseline)
  Workspace resolution: --workspace <dir> | positional root | BUILDINGOS_WORKSPACE | upward .buildingos/ search
`);
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Resolve the tenant workspace root for a command. */
function resolveRoot(flag: string | undefined, positional: string | undefined): { root: string } | { error: string } {
  return resolveWorkspace({ flag: flag ?? positional, env: process.env.BUILDINGOS_WORKSPACE });
}

/** Sync asset resolver (compile() is synchronous); reads reference/script files from the tenant. */
function assetsFor(buildingosDir: string) {
  return (skill: string, rel: string) => {
    try {
      return readFileSync(path.join(buildingosDir, 'skills', skill, rel), 'utf8');
    } catch {
      return undefined;
    }
  };
}

async function cmdValidate(root: string): Promise<number> {
  const { diagnostics, ok } = await loadTenantDocs({ repoRoot: root });
  for (const d of diagnostics) console.log(`[${d.severity.toUpperCase()}] ${d.code} ${d.file ? `(${d.file})` : ''} ${d.message}`);
  console.log(ok ? `validate: OK (${diagnostics.filter((d) => d.severity === 'warning' || d.severity === 'info').length} warnings/info)` : `validate: FAILED (${diagnostics.filter((d) => d.severity === 'error').length} errors)`);
  return ok ? 0 : 1;
}

async function cmdCompile(root: string, engine: string | undefined, out: string | undefined): Promise<number> {
  if (engine !== 'dsh' && engine !== 'codex') {
    console.error('compile: --engine must be dsh|codex');
    return 2;
  }
  const buildingosDir = path.join(root, '.buildingos');
  const { docs, ok } = await loadTenantDocs({ repoRoot: root, buildingosDir });
  if (!ok) {
    console.error('compile: tenant failed validation; run `buildingos validate` first');
    return 1;
  }
  const adapter = engine === 'dsh' ? dshAdapter : codexAdapter;
  const view = adapter.compile(docs, { assets: await assetsFor(buildingosDir) });
  const outDir = out ?? path.join(root, 'engine-views', engine);
  for (const f of view.files) {
    const full = path.join(outDir, ...f.path.split('/'));
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, f.content, 'utf8');
  }
  console.log(`compile: ${view.files.length} files → ${outDir} (engine=${engine})`);
  return 0;
}

async function cmdConformance(root: string, argv: string[]): Promise<number> {
  const repoRoot = path.resolve(root);
  const goldenDir = path.join(repoRoot, 'engine-views');
  let baseline = false;
  try {
    baseline = (await stat(goldenDir)).isDirectory();
  } catch {
    baseline = false;
  }
  if (!baseline) {
    console.log('conformance: no golden baseline (engine-views/ missing) — run `buildingos compile --engine dsh` and `buildingos compile --engine codex` first');
    return 1;
  }
  const results = await runConformance({
    repoRoot,
    buildingosDir: path.join(repoRoot, '.buildingos'),
    knowledgeDir: path.join(repoRoot, 'knowledge'),
    goldenDir,
    assets: await assetsFor(path.join(repoRoot, '.buildingos')),
  });
  let failed = 0;
  for (const r of results) {
    const isSkipped = 'skipped' in r && r.skipped;
    const status = isSkipped ? 'SKIP' : r.passed ? 'PASS' : 'FAIL';
    if (!isSkipped && !r.passed) failed += 1;
    console.log(`[${status}] ${r.task} (${'engine' in r ? r.engine : '—'})`);
    if ('details' in r) for (const d of r.details) console.log(`      ${d}`);
  }
  return failed === 0 ? 0 : 1;
}

/** init target: with [dir] → ./<dir>; without → current directory (git-init style). */
export function initTarget(argv: string[]): string {
  return argv[0] ? path.resolve(argv[0]) : process.cwd();
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'init': {
      // Scaffold where the user is. The tool-repo guard in initTenant refuses
      // targets containing pnpm-workspace.yaml.
      const result = await runWizard(initTarget(rest), createConsoleIO());
      return result.ok ? 0 : 1;
    }
    case 'web': {
      // Removed (product decision): the interaction surface is the CLI; no web console.
      console.error('web console removed — use the CLI commands (init/validate/compile/conformance)');
      return 2;
    }
    case 'validate': {
      const resolved = resolveRoot(arg(rest, '--workspace') ?? arg(rest, '-w'), rest[0]);
      if ('error' in resolved) {
        console.error(resolved.error);
        return 1;
      }
      return cmdValidate(resolved.root);
    }
    case 'compile': {
      const engine = arg(rest, '--engine');
      const out = arg(rest, '--out');
      const wsFlag = arg(rest, '--workspace') ?? arg(rest, '-w');
      // Positional root = the first arg that is neither a flag name nor a flag value.
      const flagTokens = new Set(['--engine', engine, '--out', out, '--workspace', wsFlag, '-w', wsFlag]);
      const positional = rest.find((a) => !flagTokens.has(a) && !a.startsWith('-'));
      const resolved = resolveRoot(wsFlag, positional);
      if ('error' in resolved) {
        console.error(resolved.error);
        return 1;
      }
      return cmdCompile(resolved.root, engine, out);
    }
    case 'conformance': {
      const resolved = resolveRoot(arg(rest, '--workspace') ?? arg(rest, '-w'), rest[0]);
      if ('error' in resolved) {
        console.error(resolved.error);
        return 1;
      }
      return cmdConformance(resolved.root, rest);
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
  const self =
    typeof __filename === 'string' ? __filename : fileURLToPath(import.meta.url);
  try {
    return realpathSync(self) === realpathSync(arg);
  } catch {
    return path.resolve(self) === path.resolve(arg);
  }
}

if (isCliEntry()) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
