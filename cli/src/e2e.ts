/**
 * E2E demo — the full CLI loop on a throwaway workspace:
 *   init (wizard, scripted answers) → validate → compile dsh → compile codex → conformance.
 * Run via: pnpm --filter @buildingos/cli demo   (or `pnpm verify` at the repo root)
 */
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from './cli.js';
import type { WizardIO } from './io.js';
import { runWizard } from './wizard.js';

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
    const steps: Array<[string, number]> = [
      ['init (first-boot wizard, language first)', wizard.ok ? 0 : 1],
      ['validate', await main(['validate', dir])],
      ['compile --engine dsh', await main(['compile', '--engine', 'dsh', dir])],
      ['compile --engine codex', await main(['compile', '--engine', 'codex', dir])],
      ['conformance (G1 both engines)', await main(['conformance', dir])],
    ];
    let failed = 0;
    for (const [name, code] of steps) {
      console.log(`${code === 0 ? '[PASS]' : '[FAIL]'} ${name}`);
      if (code !== 0) failed += 1;
    }
    console.log(failed === 0 ? 'e2e: OK' : `e2e: FAILED (${failed})`);
    return failed === 0 ? 0 : 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

e2e().then((code) => process.exit(code));
