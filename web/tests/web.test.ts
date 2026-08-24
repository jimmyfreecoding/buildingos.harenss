import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../src/server.js';

let server: Server;
let base: string;
let tenant: string;

beforeAll(async () => {
  tenant = await mkdtemp(path.join(os.tmpdir(), 'bos-web-t-'));
  server = await startServer({ port: 0 });
  const addr = server.address();
  if (addr && typeof addr === 'object') base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await rm(tenant, { recursive: true, force: true });
  await new Promise<void>((r) => server.close(() => r()));
});

async function post(p: string, body: unknown) {
  const res = await fetch(`${base}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json() as Promise<any>;
}

describe('BuildingOS web console API', () => {
  it('serves the SPA at /', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('BuildingOS Console');
  });

  it('wizard API scaffolds a tenant (answers-as-values path)', async () => {
    const r = await post('/api/wizard', {
      dir: tenant, language: 'zh', engine: 'dsh', model: 'gpt-4o',
      modelToken: 'web-token', gitToken: 'web-git',
    });
    expect(r.ok).toBe(true);
    expect(r.transcript.some((l: string) => l.includes('租户仓库已就绪'))).toBe(true);
  });

  it('validate API reports OK on the scaffolded tenant', async () => {
    const r = await post('/api/validate', { workspace: tenant });
    expect(r.ok).toBe(true);
    expect(r.diagnostics.filter((d: any) => d.severity === 'error')).toHaveLength(0);
  });

  it('compile API returns the engine view files', async () => {
    const r = await post('/api/compile', { workspace: tenant, engine: 'codex' });
    expect(r.ok).toBe(true);
    const paths = r.files.map((f: any) => f.path);
    expect(paths).toContain('.codex/skills/hello/SKILL.md');
    expect(paths).toContain('.codex/AGENTS.md');
    expect(paths).toContain('.codex/config.toml');
  });

  it('conformance API passes G1 after both engines are compiled', async () => {
    await post('/api/compile', { workspace: tenant, engine: 'dsh' });
    await post('/api/compile', { workspace: tenant, engine: 'codex' });
    const r = await post('/api/conformance', { workspace: tenant });
    expect(r.ok).toBe(true);
    const g1 = r.results.filter((x: any) => x.task === 'G1-compile-parity');
    expect(g1).toHaveLength(2);
    for (const g of g1) expect(g.passed).toBe(true);
  });

  it('conformance API reports missing baseline clearly', async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), 'bos-web-e-'));
    try {
      const r = await post('/api/conformance', { workspace: empty });
      expect(r.ok).toBe(false);
      expect(r.error).toContain('golden baseline');
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});
