import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findWorkspace, resolveWorkspace } from '../src/workspace.js';

function makeTree(): string {
  const base = mkdtempSync(path.join(os.tmpdir(), 'bos-ws-'));
  // a/.buildingos + a/b/c (deep) — marker at a
  mkdirSync(path.join(base, 'a', '.buildingos'), { recursive: true });
  mkdirSync(path.join(base, 'a', 'b', 'c'), { recursive: true });
  // d — no marker
  mkdirSync(path.join(base, 'd'), { recursive: true });
  return base;
}

describe('workspace resolution (tool vs. tenant separation)', () => {
  const base = makeTree();

  it('finds the .buildingos marker by upward search (like git)', () => {
    expect(findWorkspace(path.join(base, 'a', 'b', 'c'))).toBe(path.join(base, 'a'));
    expect(findWorkspace(path.join(base, 'a'))).toBe(path.join(base, 'a'));
  });

  it('returns undefined when no marker exists above', () => {
    expect(findWorkspace(path.join(base, 'd'))).toBeUndefined();
  });

  it('explicit --workspace flag wins over the search', () => {
    const r = resolveWorkspace({ flag: path.join(base, 'a'), cwd: path.join(base, 'd') });
    expect(r).toEqual({ root: path.join(base, 'a'), method: 'flag' });
  });

  it('BUILDINGOS_WORKSPACE env wins over the search', () => {
    const r = resolveWorkspace({ env: path.join(base, 'a'), cwd: path.join(base, 'd') });
    expect(r).toEqual({ root: path.join(base, 'a'), method: 'env' });
  });

  it('flag beats env', () => {
    const r = resolveWorkspace({ flag: path.join(base, 'a'), env: path.join(base, 'd') });
    expect(r.method).toBe('flag');
  });

  it('errors with guidance when nothing resolves', () => {
    const r = resolveWorkspace({ cwd: path.join(base, 'd') });
    expect('error' in r).toBe(true);
    expect((r as { error: string }).error).toContain('buildingos init');
  });

  it('cleans up', () => {
    rmSync(base, { recursive: true, force: true });
  });
});
