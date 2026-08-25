import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadTenantDocs } from '@buildingos/normalizer';
import { runWizard, runWizardFromAnswers, initTenant } from '../src/index.js';
import type { WizardIO } from '../src/index.js';

/** Scripted I/O driving the wizard deterministically (zh answers by default). */
function scriptedIO(script: Array<{ q: string; value: string }>): WizardIO {
  let i = 0;
  return {
    async choose(question, options, defaultValue) {
      for (;;) {
        const step = script[i++];
        if (!step) throw new Error(`no scripted answer for: ${question}`);
        const idx = step.value === '' && defaultValue !== undefined
          ? options.findIndex((o) => o.value === defaultValue)
          : Number(step.value) - 1;
        if (idx >= 0 && idx < options.length) return options[idx].value;
      }
    },
    async secret(question) {
      const step = script[i++];
      if (!step) throw new Error(`no scripted secret for: ${question}`);
      return step.value;
    },
    note() {},
  };
}

describe('first-boot wizard (runtime-bootstrap §2)', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bos-wiz-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('language comes first (step 0), then engine → model → credentials → git', async () => {
    const io = scriptedIO([
      { q: 'lang', value: '1' }, // 中文
      { q: 'engine', value: '1' }, // dsh
      { q: 'model', value: '1' }, // deepseek-chat
      { q: 'model-token', value: 'model-tok' },
      { q: 'git-token', value: 'git-tok' },
    ]);
    const result = await runWizard(dir, io);
    expect(result.language).toBe('zh');
    expect(result.engine).toBe('dsh');
    expect(result.model).toBe('deepseek-chat');
    expect(result.ok).toBe(true);
  });

  it('persists choices into runtime.yaml (document config, Git) and .env (secrets, never Git)', async () => {
    const cfg = await readFile(path.join(dir, '.buildingos', 'configs', 'runtime.yaml'), 'utf8');
    expect(cfg).toContain('engine: dsh');
    expect(cfg).toContain('model: deepseek-chat');
    const env = await readFile(path.join(dir, '.env'), 'utf8');
    expect(env).toContain('MODEL_TOKEN=model-tok');
    expect(env).toContain('GIT_TOKEN=git-tok');
    expect(env).toMatch(/PG_PASSWORD=[0-9a-f]{24}/);
    const example = await readFile(path.join(dir, '.env.example'), 'utf8');
    expect(example).toContain('MODEL_TOKEN=');
    expect(example).toContain('PG_PASSWORD=');
    const gitignore = await readFile(path.join(dir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('!.env.example');
  });

  it('scaffolds the dev environment compose (M1.5 ②) and embeds the tool dir when provided', async () => {
    const dir4 = await mkdtemp(path.join(os.tmpdir(), 'bos-wiz-dev-'));
    try {
      const io = scriptedIO([
        { q: 'lang', value: '1' },
        { q: 'engine', value: '1' },
        { q: 'model', value: '1' },
        { q: 'model-token', value: 'tok-dev' },
        { q: 'git-token', value: '' },
      ]);
      await runWizard(dir4, io, { toolDir: 'C:/tool/buildingos.harenss' });
      const yml = await readFile(path.join(dir4, 'docker-compose.yml'), 'utf8');
      expect(yml).toContain('context: C:/tool/buildingos.harenss');
      expect(yml).toContain('buildingos-runtime');
      expect(yml).toContain('postgres:16-alpine');
    } finally {
      await rm(dir4, { recursive: true, force: true });
    }
  });

  it('validates the scaffolded tenant (step 6)', async () => {
    const { ok, diagnostics } = await loadTenantDocs({ repoRoot: dir });
    expect(ok).toBe(true);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('runs in English and supports custom model + skipped git token', async () => {
    const dir2 = await mkdtemp(path.join(os.tmpdir(), 'bos-wiz-en-'));
    try {
      const io = scriptedIO([
        { q: 'lang', value: '2' }, // English
        { q: 'engine', value: '2' }, // codex
        { q: 'model', value: '4' }, // custom
        { q: 'custom-model', value: 'my-model' },
        { q: 'model-token', value: 'tok2' },
        { q: 'git-token', value: '' }, // skip
      ]);
      const result = await runWizard(dir2, io);
      expect(result.language).toBe('en');
      expect(result.engine).toBe('codex');
      expect(result.model).toBe('my-model');
      const env = await readFile(path.join(dir2, '.env'), 'utf8');
      expect(env).toContain('MODEL_TOKEN=tok2');
      expect(env).not.toContain('GIT_TOKEN=');
    } finally {
      await rm(dir2, { recursive: true, force: true });
    }
  });

  it('runWizardFromAnswers drives the same wizard non-interactively (web console path)', async () => {
    const dir3 = await mkdtemp(path.join(os.tmpdir(), 'bos-wiz-ans-'));
    try {
      const result = await runWizardFromAnswers(dir3, {
        language: 'zh',
        engine: 'codex',
        model: 'gpt-4o',
        modelToken: 'tok-web',
        gitToken: 'git-web',
      });
      expect(result.ok).toBe(true);
      expect(result.engine).toBe('codex');
      expect(result.model).toBe('gpt-4o');
      expect(result.transcript.some((l) => l.includes('codex'))).toBe(true);
      const cfg = await readFile(path.join(dir3, '.buildingos', 'configs', 'runtime.yaml'), 'utf8');
      expect(cfg).toContain('engine: codex');
      const env = await readFile(path.join(dir3, '.env'), 'utf8');
      expect(env).toContain('MODEL_TOKEN=tok-web');
    } finally {
      await rm(dir3, { recursive: true, force: true });
    }
  });

  it('refuses to scaffold inside the BuildingOS tool repository (guard)', async () => {
    const tool = await mkdtemp(path.join(os.tmpdir(), 'bos-tool-'));
    try {
      await writeFile(path.join(tool, 'pnpm-workspace.yaml'), 'packages:\n  - cli\n');
      await expect(initTenant(tool)).rejects.toThrow(/refusing to scaffold into the BuildingOS tool repository/);
    } finally {
      await rm(tool, { recursive: true, force: true });
    }
  });
});
