/**
 * Prompts loader (pipeline stage 1a): flat prompts/*.md files.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import type { Diagnostic } from '../types.js';
import { readText, toPosix } from './fs.js';

export interface RawPrompt {
  id: string;
  frontmatter: Record<string, unknown>;
  body: string;
  file: string;
}

export async function loadPrompts(
  promptsRoot: string,
): Promise<{ prompts: RawPrompt[]; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = [];
  const prompts: RawPrompt[] = [];

  let entries;
  try {
    entries = await readdir(promptsRoot, { withFileTypes: true });
  } catch {
    return {
      prompts,
      diagnostics: [
        { severity: 'warning', code: 'PROMPTS_DIR_MISSING', file: promptsRoot, message: 'prompts directory not found' },
      ],
    };
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const file = toPosix(path.join(promptsRoot, entry.name));
    const content = await readText(path.join(promptsRoot, entry.name));
    const parsed = parseFrontmatter(file, content);
    prompts.push({
      id: (typeof parsed.frontmatter.id === 'string' ? parsed.frontmatter.id : entry.name.replace(/\.md$/, '')),
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      file,
    });
    diagnostics.push(...parsed.diagnostics);
  }

  return { prompts, diagnostics };
}
