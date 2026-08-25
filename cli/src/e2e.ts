/**
 * E2E demo — the full tenant loop on a throwaway workspace:
 *   init (wizard, scripted answers) → validate → compile dsh → compile codex → conformance.
 * The pipeline steps use the libraries directly (the CLI no longer ships
 * validate/compile/conformance — they live in the web console's API).
 * Run via: pnpm --filter @buildingos/cli demo   (or `pnpm verify` at the repo root)
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runWizard } from '@buildingos/bootstrap';
import type { WizardIO } from '@buildingos/bootstrap';
import { loadTenantDocs } from '@buildingos/normalizer';
import { dshAdapter } from '@buildingos/adapter-dsh';
import { codexAdapter } from '@buildingos/adapter-codex';
import { runConformance } from '@buildingos/conformance';

function assetsFor(buildingosDir: string) {
  return (skill: string, rel: string) => {
    try {
      return readFileSync(path.join(buildingosDir, 'skills', skill, rel), 'utf8');
    } catch {
      return undefined;
    }
  };
}

async function e2e(): Promise<number> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bos-e2e-'));
  // zh, engine=dsh, model=gpt-4o, tokens
  const script = ['1', '1', '3', 'e2e-model-token', 'e2e-git-token'];
  let i = 0;
  const io: WizardIO = {
    async choose(_q, options) {
      const idx = Number(script[i++]) - 1;
      if (idx < 0 || idx >= options.length) throw new Error(`bad scripted choice ${idx}`);
      return options[idx].value;
    },
    async secret() {
      return script[i++];
    },
    note() {},
  };

  try {
    const wizard = await runWizard(dir, io);

    const buildingosDir = path.join(dir, '.buildingos');
    const assets = assetsFor(buildingosDir);

    const validate = await loadTenantDocs({ repoRoot: dir });
    const compileDsh = dshAdapter.compile(validate.docs, { assets });
    const compileCodex = codexAdapter.compile(validate.docs, { assets });
    for (const f of compileDsh.files) {
      const full = path.join(dir, 'engine-views', 'dsh', ...f.path.split('/'));
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, f.content, 'utf8');
    }
    for (const f of compileCodex.files) {
      const full = path.join(dir, 'engine-views', 'codex', ...f.path.split('/'));
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, f.content, 'utf8');
    }
    const conformance = await runConformance({
      repoRoot: dir,
      buildingosDir,
      knowledgeDir: path.join(dir, 'knowledge'),
      goldenDir: path.join(dir, 'engine-views'),
      assets,
    });

    const steps: Array<[string, boolean]> = [
      ['init (first-boot wizard, language first)', wizard.ok],
      ['dev env artifacts (docker-compose.yml + .env + PG_PASSWORD)', devEnvArtifactsOk(dir)],
      ['validate (normalizer)', validate.ok],
      ['compile --engine dsh', compileDsh.files.length > 0],
      ['compile --engine codex', compileCodex.files.length > 0],
      ['conformance (G1 both engines)', conformance.length > 0 && conformance.every((r) => 'skipped' in r && r.skipped ? true : r.passed)],
    ];
    let failed = 0;
    for (const [name, ok] of steps) {
      console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}`);
      if (!ok) failed += 1;
    }
    console.log(failed === 0 ? 'e2e: OK' : `e2e: FAILED (${failed})`);
    return failed === 0 ? 0 : 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** M1.5 ②: init must write the dev-environment artifacts (compose + .env secrets). */
function devEnvArtifactsOk(dir: string): boolean {
  try {
    const compose = existsSync(path.join(dir, 'docker-compose.yml'));
    const env = readFileSync(path.join(dir, '.env'), 'utf8');
    return compose && /PG_PASSWORD=[0-9a-f]{24}/.test(env);
  } catch {
    return false;
  }
}

e2e().then((code) => process.exit(code));
