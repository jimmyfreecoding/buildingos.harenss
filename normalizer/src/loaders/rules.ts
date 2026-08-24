/**
 * Rules loader (pipeline stage 1a): flat rules/*.md files (D7 allows multiple ## sections).
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import type { Diagnostic } from '../types.js';
import { readText, toPosix } from './fs.js';

export interface RawRule {
  id: string;
  frontmatter: Record<string, unknown>;
  body: string;
  file: string;
}

export async function loadRules(
  rulesRoot: string,
): Promise<{ rules: RawRule[]; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = [];
  const rules: RawRule[] = [];

  let entries;
  try {
    entries = await readdir(rulesRoot, { withFileTypes: true });
  } catch {
    return {
      rules,
      diagnostics: [
        { severity: 'warning', code: 'RULES_DIR_MISSING', file: rulesRoot, message: 'rules directory not found' },
      ],
    };
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const file = toPosix(path.join(rulesRoot, entry.name));
    const content = await readText(path.join(rulesRoot, entry.name));
    const parsed = parseFrontmatter(file, content);
    rules.push({
      id: (typeof parsed.frontmatter.id === 'string' ? parsed.frontmatter.id : entry.name.replace(/\.md$/, '')),
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      file,
    });
    diagnostics.push(...parsed.diagnostics);
  }

  return { rules, diagnostics };
}
