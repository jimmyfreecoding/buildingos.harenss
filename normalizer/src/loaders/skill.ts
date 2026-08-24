/**
 * Skill loader (pipeline stage 1a): scans skill bundles and flat files.
 * Canonical shape is the directory bundle (D1); flat <name>.md is accepted
 * and treated as a single-file bundle (import-only compatibility).
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import type { Diagnostic } from '../types.js';
import { listFiles, readText, toPosix } from './fs.js';

export interface RawSkill {
  name: string;
  frontmatter: Record<string, unknown>;
  body: string;
  /** Skill-relative paths under references/ (forward slashes). */
  references: string[];
  /** Skill-relative paths under scripts/ (forward slashes). */
  scripts: string[];
  /** Path to the SKILL.md (or flat .md) file. */
  file: string;
}

export async function loadSkills(
  skillsRoot: string,
): Promise<{ skills: RawSkill[]; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = [];
  const skills: RawSkill[] = [];

  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return {
      skills,
      diagnostics: [
        { severity: 'warning', code: 'SKILLS_DIR_MISSING', file: skillsRoot, message: 'skills directory not found' },
      ],
    };
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const dir = path.join(skillsRoot, entry.name);
      const skillFile = path.join(dir, 'SKILL.md');
      let content: string;
      try {
        content = await readText(skillFile);
      } catch {
        continue; // directory without SKILL.md is not a skill bundle
      }
      const parsed = parseFrontmatter(toPosix(skillFile), content);
      const references = (await listFiles(path.join(dir, 'references'))).map((p) => `references/${p}`);
      const scripts = (await listFiles(path.join(dir, 'scripts'))).map((p) => `scripts/${p}`);
      skills.push({
        name: entry.name,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        references,
        scripts,
        file: toPosix(skillFile),
      });
      diagnostics.push(...parsed.diagnostics);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const file = path.join(skillsRoot, entry.name);
      const content = await readText(file);
      const parsed = parseFrontmatter(toPosix(file), content);
      // Flat form is import-only compatible (D1): treat a flat .md as a skill only
      // when it carries a skill frontmatter (name); anything else is documentation
      // living in the skills directory and is skipped.
      const fmName = typeof parsed.frontmatter.name === 'string' ? parsed.frontmatter.name : '';
      if (!fmName) {
        diagnostics.push({
          severity: 'info',
          code: 'SKIP_NON_SKILL',
          file: toPosix(file),
          message: 'flat .md without a skill frontmatter (name) — skipped as non-skill',
        });
        continue;
      }
      skills.push({
        name: fmName,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        references: [],
        scripts: [],
        file: toPosix(file),
      });
      diagnostics.push(...parsed.diagnostics);
    }
  }

  return { skills, diagnostics };
}
