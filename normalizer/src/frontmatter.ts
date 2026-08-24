/**
 * Frontmatter extractor (pipeline stage 1a).
 * Tolerance semantics follow DSH skill-filesystem: bad files warn-and-skip,
 * never block the whole load.
 */
import { parse } from 'yaml';
import type { Diagnostic } from './types.js';

export interface RawDocument {
  /** File path as given (repo-relative where applicable). */
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
  diagnostics: Diagnostic[];
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(path: string, content: string): RawDocument {
  const match = FM_RE.exec(content);
  if (!match) {
    return {
      path,
      frontmatter: {},
      body: content,
      diagnostics: [
        { severity: 'warning', code: 'FRONTMATTER_MISSING', file: path, message: 'no YAML frontmatter block found' },
      ],
    };
  }
  const yamlText = match[1];
  const body = content.slice(match[0].length);
  try {
    const frontmatter = parse(yamlText) ?? {};
    if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
      throw new Error('frontmatter must be a YAML mapping');
    }
    return { path, frontmatter: frontmatter as Record<string, unknown>, body, diagnostics: [] };
  } catch (err) {
    return {
      path,
      frontmatter: {},
      body: content,
      diagnostics: [
        { severity: 'warning', code: 'FRONTMATTER_INVALID', file: path, message: `invalid YAML frontmatter: ${(err as Error).message}` },
      ],
    };
  }
}
