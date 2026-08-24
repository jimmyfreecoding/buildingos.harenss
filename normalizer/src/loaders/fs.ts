/**
 * Shared filesystem helpers for the loaders.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/** Normalize a path to forward slashes for stable comparisons (Windows-safe). */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Recursively list files under root as paths relative to root (forward slashes).
 * Returns [] when the directory does not exist.
 */
export async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  let st;
  try {
    st = await stat(root);
  } catch {
    return out;
  }
  if (!st.isDirectory()) return out;
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        out.push(toPosix(path.relative(root, full)));
      }
    }
  };
  await walk(root);
  return out.sort();
}

/** Read a file's UTF-8 content, or throw with the path in the message. */
export async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${file}: ${(err as Error).message}`);
  }
}
