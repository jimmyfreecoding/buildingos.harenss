/**
 * Configs loader (pipeline stage 1a): configs/runtime.yaml is pure YAML (no frontmatter).
 * A `permissions` key is surfaced here; lint flags it as hand-written (D14).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Diagnostic } from '../types.js';

export interface RawConfig {
  data: Record<string, unknown>;
  file: string;
}

export async function loadConfig(
  configsRoot: string,
): Promise<{ config?: RawConfig; diagnostics: Diagnostic[] }> {
  const file = path.join(configsRoot, 'runtime.yaml');
  let content: string;
  try {
    content = await readFile(file, 'utf8');
  } catch {
    return {
      diagnostics: [
        { severity: 'warning', code: 'CONFIG_MISSING', file: file, message: 'configs/runtime.yaml not found' },
      ],
    };
  }

  try {
    const data = parseYaml(content) ?? {};
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('runtime.yaml must be a YAML mapping');
    }
    return {
      config: { data: data as Record<string, unknown>, file },
      diagnostics: [],
    };
  } catch (err) {
    return {
      diagnostics: [
        { severity: 'error', code: 'CONFIG_INVALID', file: file, message: `invalid runtime.yaml: ${(err as Error).message}` },
      ],
    };
  }
}
