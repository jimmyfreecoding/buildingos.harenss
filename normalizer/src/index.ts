/**
 * @buildingos/normalizer — public entry point.
 * Compile pipeline stages 1–2: parse & validate → normalize → set-level lint → TenantDocs.
 * Engine-agnostic, pure functions, no side effects (stage 3 render belongs to the adapters).
 */
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { loadConfig, loadKnowledge, loadPrompts, loadRules, loadSkills } from './loaders/index.js';
import { lintAll, lintUnknownFields } from './lint.js';
import { normalize } from './normalize.js';
import type { Diagnostic, LoadResult, LoadTenantDocsOptions } from './types.js';
import { validateTenantDocs } from './validate.js';

// Allowed frontmatter keys per family (kebab-case surface); unknown keys are tolerated (import tolerance).
const ALLOWED_SKILL_KEYS = ['name', 'description', 'when-to-use', 'metadata', 'ui', 'invocation', 'products', 'dependencies', 'references', 'scripts', 'data'];
const ALLOWED_RULE_KEYS = ['id', 'title', 'description', 'scope', 'enforce', 'permission', 'order', 'applies-to', 'enabled', 'references'];
const ALLOWED_PROMPT_KEYS = ['id', 'title', 'description', 'language', 'tone', 'order', 'enabled', 'references'];

export async function loadTenantDocs(opts: LoadTenantDocsOptions): Promise<LoadResult> {
  const repoRoot = path.resolve(opts.repoRoot);
  const buildingosDir = path.resolve(opts.buildingosDir ?? path.join(repoRoot, '.buildingos'));
  const knowledgeDir = path.resolve(opts.knowledgeDir ?? path.join(repoRoot, 'knowledge'));

  const diagnostics: Diagnostic[] = [];

  const skillsRoot = path.join(buildingosDir, 'skills');
  const rulesRoot = path.join(buildingosDir, 'rules');
  const promptsRoot = path.join(buildingosDir, 'prompts');
  const configsRoot = path.join(buildingosDir, 'configs');

  // Stage 1a: parse
  const [skillRes, ruleRes, promptRes, configRes, knowledgeRes] = await Promise.all([
    loadSkills(skillsRoot),
    loadRules(rulesRoot),
    loadPrompts(promptsRoot),
    loadConfig(configsRoot),
    loadKnowledge(knowledgeDir, repoRoot),
  ]);
  diagnostics.push(...skillRes.diagnostics, ...ruleRes.diagnostics, ...promptRes.diagnostics, ...configRes.diagnostics, ...knowledgeRes.diagnostics);

  // Unknown-field warnings (import tolerance; kept in metadata)
  diagnostics.push(
    ...lintUnknownFields([
      { family: 'skills', id: '', keys: skillRes.skills.flatMap((s) => Object.keys(s.frontmatter)), allowed: ALLOWED_SKILL_KEYS },
      { family: 'rules', id: '', keys: ruleRes.rules.flatMap((r) => Object.keys(r.frontmatter)), allowed: ALLOWED_RULE_KEYS },
      { family: 'prompts', id: '', keys: promptRes.prompts.flatMap((p) => Object.keys(p.frontmatter)), allowed: ALLOWED_PROMPT_KEYS },
    ]),
  );

  // Stage 2: normalize + derive
  const { docs, permissions, diagnostics: normDiag } = normalize({
    skills: skillRes.skills,
    rules: ruleRes.rules,
    prompts: promptRes.prompts,
    config: configRes.config,
    knowledge: knowledgeRes.knowledge,
  });
  diagnostics.push(...normDiag);

  // Stage 2b: set-level lint
  diagnostics.push(...lintAll(docs, repoRoot, configRes.config?.data));

  // Output gate
  const gateErrors = validateTenantDocs(docs);
  for (const message of gateErrors) {
    diagnostics.push({ severity: 'error', code: 'CONTRACT_VIOLATION', message });
  }

  const errors = diagnostics.filter((d) => d.severity === 'error');
  return { docs, diagnostics, permissions, ok: errors.length === 0 };
}

export * from './types.js';
export { parseFrontmatter } from './frontmatter.js';
export { normalize, mergePersonas, derivePermissions } from './normalize.js';
export {
  lintAll,
  lintDependencies,
  lintOrderUniqueness,
  lintPaths,
  lintPermissionsHandWritten,
  lintPromptMerge,
  lintUnknownFields,
} from './lint.js';
export { validateTenantDocs } from './validate.js';
