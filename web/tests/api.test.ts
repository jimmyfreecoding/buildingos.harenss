import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWizardFromAnswers } from '@buildingos/bootstrap';
import { isWorkspace, scanForWorkspaces, rememberWorkspace, listRecents, CONFIG_FILE, CONFIG_DIR } from '../server/workspaces.js';

describe('web console workspace discovery', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bos-web-ws-'));
    await runWizardFromAnswers(dir, {
      language: 'zh',
      engine: 'dsh',
      model: 'gpt-4o',
      modelToken: 'tok',
    });
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('detects a workspace by the .buildingos marker', () => {
    expect(isWorkspace(dir)).toBe(true);
    expect(isWorkspace(os.tmpdir())).toBe(false);
  });

  it('scans a base dir one level deep for workspaces', async () => {
    const parent = path.dirname(dir);
    const found = scanForWorkspaces(parent, 0);
    expect(Array.isArray(found)).toBe(true);
    const deeper = scanForWorkspaces(parent, 1);
    expect(deeper).toContain(dir);
  });

  it('remembers workspaces in the recents list (persisted to home config)', async () => {
    rememberWorkspace(dir);
    const recents = listRecents();
    expect(recents.some((r) => r.path === dir)).toBe(true);
    expect(recents[0]?.path).toBe(dir); // most recent first
    expect(CONFIG_DIR.length).toBeGreaterThan(0);
    expect(CONFIG_FILE.endsWith('config.json')).toBe(true);
  });
});
