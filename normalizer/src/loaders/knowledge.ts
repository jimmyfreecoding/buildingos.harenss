/**
 * Knowledge loader (pipeline stage 1a): free-form world-knowledge documents (D19, t3).
 * Collects path + content only; no structural validation.
 */
import path from 'node:path';
import { listFiles, readText, toPosix } from './fs.js';
import type { Diagnostic, KnowledgeDoc } from '../types.js';

export async function loadKnowledge(
  knowledgeRoot: string,
  repoRoot: string,
): Promise<{ knowledge: KnowledgeDoc[]; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = [];
  const knowledge: KnowledgeDoc[] = [];

  const files = await listFiles(knowledgeRoot);
  const repoPosix = toPosix(path.resolve(repoRoot));
  for (const rel of files) {
    if (!/\.(md|yaml|yml)$/.test(rel)) continue;
    const content = await readText(path.join(knowledgeRoot, rel));
    // Store repo-root relative path (e.g., knowledge/topology.yaml) so that
    // skills' data: declarations resolve against repoRoot.
    const fullPosix = toPosix(path.join(knowledgeRoot, rel));
    const relPath = fullPosix.startsWith(`${repoPosix}/`) ? fullPosix.slice(repoPosix.length + 1) : fullPosix;
    knowledge.push({ path: relPath, content });
  }

  if (files.length === 0) {
    diagnostics.push({
      severity: 'info',
      code: 'KNOWLEDGE_EMPTY',
      file: knowledgeRoot,
      message: 'knowledge directory is empty or missing',
    });
  }

  return { knowledge, diagnostics };
}
