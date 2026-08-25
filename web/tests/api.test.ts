import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWizardFromAnswers } from '@buildingos/bootstrap';
import { isWorkspace, scanForWorkspaces, rememberWorkspace, listRecents, listDirs, CONFIG_FILE, CONFIG_DIR } from '../server/workspaces.js';

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

  it('listDirs browses a folder, marks the tenant child, and finds the parent', async () => {
    const parent = path.dirname(dir);
    const listing = listDirs(parent);
    expect(listing.path).toBe(parent);
    // The tenant dir is a child and is flagged as a workspace.
    const child = listing.dirs.find((d) => d.path === dir);
    expect(child).toBeDefined();
    expect(child?.isWorkspace).toBe(true);
    // A non-tenant child is present (the temp dir's other entries), and parent resolves.
    expect(listing.parent).not.toBeNull();
  });

  it('listDirs on a drive root has no parent', () => {
    const listing = listDirs('C:\\');
    expect(listing.path).toBe('C:\\');
    expect(listing.parent).toBeNull();
  });
});
