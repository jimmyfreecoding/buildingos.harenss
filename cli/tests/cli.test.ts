import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { runWizard } from '@buildingos/bootstrap';
import type { WizardIO } from '@buildingos/bootstrap';
import { cmdDev, cmdWeb, initTarget, main, webServerPath } from '../src/cli.js';

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

  it('unknown command prints usage and exits 2', async () => {
    const code = await main(['validate', dir]);
    expect(code).toBe(2);
    const code2 = await main(['compile', '--engine', 'dsh', dir]);
    expect(code2).toBe(2);
    const code3 = await main(['conformance', dir]);
    expect(code3).toBe(2);
  });

  it('webServerPath locates the built console inside the tool repo', () => {
    const server = webServerPath();
    // When running from the tool repo, the built web server should be found.
    if (server) {
      expect(server.endsWith(path.join('web', 'dist', 'server', 'index.js'))).toBe(true);
    }
  });

  it('web reports guidance when the console is not built', async () => {
    const fakeSpawn = (() => {
      throw new Error('should not spawn');
    }) as unknown as typeof import('node:child_process').spawn;
    // Point tool lookup away from the repo so the server is "not built".
    const orig = process.env.BUILDINGOS_TOOL_DIR;
    process.env.BUILDINGOS_TOOL_DIR = path.join(os.tmpdir(), 'no-such-tool-dir');
    try {
      const code = await cmdWeb([], fakeSpawn);
      expect(code).toBe(1);
    } finally {
      if (orig === undefined) delete process.env.BUILDINGOS_TOOL_DIR;
      else process.env.BUILDINGOS_TOOL_DIR = orig;
    }
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

  it('dev runs `docker compose up` in the tenant (image already present → no build)', async () => {
    const calls: Array<{ cmd: string; args: string[]; opts: { cwd: string; env: Record<string, string | undefined> } }> = [];
    const fakeChild = new EventEmitter() as EventEmitter & { on: (e: string, l: (...a: unknown[]) => void) => EventEmitter };
    const fakeSpawn = ((cmd: string, args: string[], opts: { cwd: string; env: Record<string, string | undefined> }) => {
      calls.push({ cmd, args, opts });
      // image inspect → exit 0 (image exists) → skip the build, only compose up.
      process.nextTick(() => fakeChild.emit('exit', 0));
      return fakeChild;
    }) as unknown as typeof import('node:child_process').spawn;
    const code = await cmdDev(dir, [], fakeSpawn);
    expect(code).toBe(0);
    // First call inspects the image; then compose up.
    expect(calls[0].args.slice(0, 3)).toEqual(['image', 'inspect', 'buildingos-runtime:dev']);
    const upCall = calls.find((c) => c.args.slice(0, 2).join(' ') === 'compose up');
    expect(upCall).toBeDefined();
    expect(upCall?.opts.cwd).toBe(dir);
    expect(upCall?.opts.env.BUILDINGOS_WORKSPACE).toBe(dir);
  });

  it('dev builds the runtime image when it is missing, then runs compose up', async () => {
    const calls: Array<{ cmd: string; args: string[]; opts: { cwd: string } }> = [];
    const fakeChild = new EventEmitter() as EventEmitter & { on: (e: string, l: (...a: unknown[]) => void) => EventEmitter };
    const fakeSpawn = ((cmd: string, args: string[], opts: { cwd: string }) => {
      calls.push({ cmd, args, opts });
      // image inspect → exit 1 (missing) so the build runs; then everything else succeeds.
      const isInspect = args[0] === 'image' && args[1] === 'inspect';
      process.nextTick(() => fakeChild.emit('exit', isInspect ? 1 : 0));
      return fakeChild;
    }) as unknown as typeof import('node:child_process').spawn;
    const code = await cmdDev(dir, [], fakeSpawn);
    expect(code).toBe(0);
    const buildCall = calls.find((c) => c.args[0] === 'build');
    expect(buildCall).toBeDefined();
    expect(buildCall?.args).toContain('-t');
    expect(buildCall?.args).toContain('buildingos-runtime:dev');
    const upCall = calls.find((c) => c.args.slice(0, 2).join(' ') === 'compose up');
    expect(upCall).toBeDefined();
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
