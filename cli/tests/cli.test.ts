import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli.js';

describe('buildingos CLI', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bos-cli-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('init scaffolds a tenant repository', async () => {
    const code = await main(['init', dir]);
    expect(code).toBe(0);
    await expect(readFile(path.join(dir, '.buildingos', 'configs', 'runtime.yaml'), 'utf8')).resolves.toContain('engine: dsh');
  });

  it('validate passes on the scaffolded tenant', async () => {
    const code = await main(['validate', dir]);
    expect(code).toBe(0);
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
});
