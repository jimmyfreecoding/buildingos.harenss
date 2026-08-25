import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  findToolDir,
  randomPgPassword,
  renderDevCompose,
  renderDevEnv,
} from '../src/index.js';

describe('dev-environment artifacts (M1.5 ②, dev-environment.md)', () => {
  it('renderDevCompose embeds the tool dir when known', () => {
    const yml = renderDevCompose({ tenantDir: 'C:/t/tenant', toolDir: 'C:/t/buildingos' });
    expect(yml).toContain('context: C:/t/buildingos');
    expect(yml).toContain('dockerfile: deploy/Dockerfile');
    expect(yml).toContain('image: buildingos-runtime:dev');
    expect(yml).toContain('postgres:16-alpine');
    expect(yml).toContain('- .:/workspace');
    expect(yml).toContain('BUILDINGOS_WORKSPACE=/workspace');
    // compose must keep the ${MODEL_TOKEN:-} / ${PG_PASSWORD:?} interpolations literal
    expect(yml).toContain('${MODEL_TOKEN:-}');
    expect(yml).toContain('${PG_PASSWORD:?set PG_PASSWORD in .env}');
    // a platform path is normalized to forward slashes for the container
    expect(yml).not.toContain('\\');
  });

  it('renderDevCompose falls back to BUILDINGOS_TOOL_DIR when the tool dir is unknown', () => {
    const yml = renderDevCompose({ tenantDir: '/tmp/tenant' });
    expect(yml).toContain('${BUILDINGOS_TOOL_DIR:?set BUILDINGOS_TOOL_DIR to the buildingos tool repo}');
  });

  it('renderDevEnv keeps model/git tokens and adds a random PG password', () => {
    const env = renderDevEnv('tok-m', 'tok-g', 'abc123');
    expect(env).toContain('MODEL_TOKEN=tok-m');
    expect(env).toContain('GIT_TOKEN=tok-g');
    expect(env).toContain('PG_PASSWORD=abc123');
    const envSkipped = renderDevEnv('tok-m', undefined, 'xyz');
    expect(envSkipped).not.toContain('GIT_TOKEN=');
    expect(envSkipped).toContain('PG_PASSWORD=xyz');
  });

  it('randomPgPassword yields 24 hex chars and differs across calls', () => {
    const a = randomPgPassword();
    const b = randomPgPassword();
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(b).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toBe(b);
  });

  it('findToolDir walks up for pnpm-workspace.yaml and stops at the drive root', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'bos-tooldir-'));
    try {
      const tool = path.join(tmp, 'a', 'b', 'tool');
      await mkdir(tool, { recursive: true });
      await writeFile(path.join(tool, 'pnpm-workspace.yaml'), 'packages: []\n');
      const inside = path.join(tool, 'x', 'y');
      await mkdir(inside, { recursive: true });
      expect(findToolDir(inside)).toBe(tool);
      expect(findToolDir(tmp)).toBeUndefined();
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
