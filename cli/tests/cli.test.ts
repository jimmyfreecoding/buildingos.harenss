import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { runWizard } from '@buildingos/bootstrap';
import type { WizardIO } from '@buildingos/bootstrap';
import { cmdDev, initTarget, main } from '../src/cli.js';

function scriptedIO(): WizardIO {
  const script = [
    { value: '1' }, // language: 中文
    { value: '1' }, // engine: dsh
    { value: '3' }, // model: gpt-4o
    { value: 'model-tok' },
    { value: 'git-tok' },
  ];
  let i = 0;
  return {
    async choose(_q, options, defaultValue) {
      for (;;) {
        const step = script[i++];
        if (!step) throw new Error('no scripted answer');
        const idx = step.value === '' && defaultValue !== undefined
          ? options.findIndex((o) => o.value === defaultValue)
          : Number(step.value) - 1;
        if (idx >= 0 && idx < options.length) return options[idx].value;
      }
    },
    async secret() {
      const step = script[i++];
      if (!step) throw new Error('no scripted secret');
      return step.value;
    },
    note() {},
  };
}

describe('buildingos CLI', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bos-cli-'));
    const result = await runWizard(dir, scriptedIO());
    expect(result.ok).toBe(true);
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('wizard scaffolded a tenant repository', async () => {
    await expect(readFile(path.join(dir, '.buildingos', 'configs', 'runtime.yaml'), 'utf8')).resolves.toContain('engine: dsh');
  });

  it('init target: [dir] resolves to ./<dir>, no arg uses cwd (git-init style)', () => {
    expect(initTarget(['my-tenant'])).toBe(path.resolve('my-tenant'));
    expect(initTarget([])).toBe(process.cwd());
  });

  it('validate passes on the scaffolded tenant (positional root)', async () => {
    const code = await main(['validate', dir]);
    expect(code).toBe(0);
  });

  it('resolves the workspace via --workspace flag', async () => {
    const code = await main(['validate', '--workspace', dir]);
    expect(code).toBe(0);
  });

  it('reports a helpful error when no workspace resolves', async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), 'bos-no-ws-'));
    try {
      const code = await main(['validate', empty]);
      expect(code).toBe(1);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('compile renders the dsh engine view into the tenant', async () => {
    const code = await main(['compile', '--engine', 'dsh', dir]);
    expect(code).toBe(0);
    await expect(readFile(path.join(dir, 'engine-views', 'dsh', '.dsh', 'skills', 'hello', 'SKILL.md'), 'utf8')).resolves.toContain('name: hello');
  });

  it('compile rejects unknown engines', async () => {
    const code = await main(['compile', '--engine', 'unknown', dir]);
    expect(code).toBe(2);
  });

  it('conformance runs on the scaffolded tenant after a baseline exists', async () => {
    await main(['compile', '--engine', 'dsh', dir]);
    await main(['compile', '--engine', 'codex', dir]);
    const code = await main(['conformance', dir]);
    expect(code).toBe(0);
  });

  it('dev fails with guidance when the tenant has no docker-compose.yml', async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), 'bos-dev-nocmp-'));
    try {
      const code = await cmdDev(empty, []);
      expect(code).toBe(1);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('dev runs `docker compose up` in the tenant with BUILDINGOS_TOOL_DIR set', async () => {
    const calls: Array<{ cmd: string; args: string[]; opts: { cwd: string; env: Record<string, string | undefined> } }> = [];
    const fakeChild = new EventEmitter() as EventEmitter & { on: (e: string, l: (...a: unknown[]) => void) => EventEmitter };
    const fakeSpawn = ((cmd: string, args: string[], opts: { cwd: string; env: Record<string, string | undefined> }) => {
      calls.push({ cmd, args, opts });
      process.nextTick(() => fakeChild.emit('exit', 0));
      return fakeChild;
    }) as unknown as typeof import('node:child_process').spawn;
    const code = await cmdDev(dir, [], fakeSpawn);
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe('docker');
    expect(calls[0].args.slice(0, 2)).toEqual(['compose', 'up']);
    expect(calls[0].opts.cwd).toBe(dir);
    expect(calls[0].opts.env.BUILDINGOS_WORKSPACE).toBe(dir);
  });

  it('dev reports docker failures', async () => {
    const fakeChild = new EventEmitter() as EventEmitter & { on: (e: string, l: (...a: unknown[]) => void) => EventEmitter };
    const fakeSpawn = (() => {
      process.nextTick(() => fakeChild.emit('error', new Error('ENOENT: docker not found')));
      return fakeChild;
    }) as unknown as typeof import('node:child_process').spawn;
    const code = await cmdDev(dir, [], fakeSpawn);
    expect(code).toBe(1);
  });
});
