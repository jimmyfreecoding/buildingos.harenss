/**
 * Workspace discovery & recents — the "first choose a workspace" step.
 *
 * A workspace is any directory carrying a `.buildingos/` marker (the tool is
 * never the project). We keep a recents list in the user's config dir
 * (~/.config/buildingos/config.json — deliberately NOT ~/.buildingos, which
 * would collide with the tenant workspace marker), so the picker offers
 * "recent" plus manual path.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findToolDir } from '@buildingos/bootstrap';

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'buildingos');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface RecentEntry {
  path: string;
  lastUsed: number;
  name: string;
}

export interface ConfigFile {
  recents: RecentEntry[];
}

function loadConfig(): ConfigFile {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ConfigFile>;
    return { recents: Array.isArray(parsed.recents) ? parsed.recents : [] };
  } catch {
    return { recents: [] };
  }
}

function saveConfig(cfg: ConfigFile): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {
    // non-fatal: recents persistence is best-effort
  }
}

export function isWorkspace(dir: string): boolean {
  return existsSync(path.join(dir, '.buildingos'));
}

export function workspaceName(dir: string): string {
  return path.basename(dir) || dir;
}

/** A folder the picker can browse into, tagged with whether it is already a tenant. */
export interface FsDir {
  name: string;
  path: string;
  isWorkspace: boolean;
}

/**
 * List the immediate subdirectories of a dir for the picker's folder browser.
 * Returns the current dir, its parent, and each child folder (dirs only, no
 * dotfiles, no node_modules). Empty result when the dir has no browsable
 * children.
 */
export function listDirs(dir: string): { path: string; parent: string | null; dirs: FsDir[]; isWorkspace: boolean } {
  const resolved = path.resolve(dir);
  let parent: string | null = path.dirname(resolved);
  if (parent === resolved) parent = null; // drive root on Windows
  const dirs: FsDir[] = [];
  try {
    for (const entry of readdirSync(resolved, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(resolved, entry.name);
      dirs.push({
        name: entry.name,
        path: full,
        isWorkspace: isWorkspace(full),
      });
    }
  } catch {
    // unreadable dir → empty list
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  return { path: resolved, parent, dirs, isWorkspace: isWorkspace(resolved) };
}

/** Root folders to start the browser at (drive roots on Windows, / elsewhere). */
export function fsRoots(): string[] {
  const roots: string[] = [];
  if (process.platform === 'win32') {
    for (let c = 65; c <= 90; c++) {
      const drive = `${String.fromCharCode(c)}:\\`;
      if (existsSync(drive)) roots.push(drive);
    }
  } else {
    roots.push('/');
  }
  return roots;
}

/** Recents, newest first, each checked to still be a workspace. */
export function listRecents(): RecentEntry[] {
  return loadConfig()
    .recents
    .filter((r) => isWorkspace(r.path))
    .sort((a, b) => b.lastUsed - a.lastUsed);
}

export function rememberWorkspace(dir: string): void {
  const cfg = loadConfig();
  const rest = cfg.recents.filter((r) => r.path !== dir);
  cfg.recents = [{ path: dir, lastUsed: Date.now(), name: workspaceName(dir) }, ...rest].slice(0, 20);
  saveConfig(cfg);
}

export async function touchWorkspace(dir: string): Promise<void> {
  rememberWorkspace(dir);
}

/**
 * Scan a base directory (one level deep) for workspaces: entries that contain
 * a `.buildingos/` marker. Used by the picker's "scan this folder" action.
 */
export function scanForWorkspaces(baseDir: string, depth = 1): string[] {
  if (!existsSync(baseDir)) return [];
  const found: string[] = [];
  let level: string[] = [baseDir];
  for (let d = 0; d < depth && level.length; d++) {
    const next: string[] = [];
    for (const dir of level) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (isWorkspace(full)) {
          found.push(full);
        } else {
          next.push(full);
        }
      }
    }
    level = next;
  }
  return found.sort();
}

/**
 * The candidate roots for the picker: the tool repo's parent, the user home,
 * and any dirs the user has explicitly scanned. Also always include the tool
 * repo itself if it carries a .buildingos marker (dogfooding).
 */
export function defaultScanRoots(): string[] {
  const roots = new Set<string>();
  const tool = findToolDir(path.dirname(fileURLToPath(import.meta.url))) ?? findToolDir(process.cwd());
  if (tool) {
    roots.add(path.dirname(tool));
    if (isWorkspace(tool)) roots.add(tool);
  }
  roots.add(os.homedir());
  return [...roots].filter((r) => existsSync(r));
}

export async function readConfig(): Promise<ConfigFile> {
  return loadConfig();
}

export async function writeConfig(cfg: ConfigFile): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

export async function readFileSafe(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
}
