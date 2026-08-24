/**
 * Normalizer (pipeline stage 2): kebab-case frontmatter → camelCase TenantDocs model,
 * with defaults, structural transforms, persona merge (D10), and permission derivation (D6/D14).
 */
import type {
  Diagnostic,
  KnowledgeDoc,
  PermissionFragment,
  PromptDoc,
  RuleDoc,
  RuleSection,
  RuntimeConfig,
  SkillDoc,
  SkillInvocation,
  SkillUi,
  TenantDocs,
  ToolRef,
} from './types.js';
import type { RawConfig } from './loaders/configs.js';
import type { RawPrompt } from './loaders/prompts.js';
import type { RawRule } from './loaders/rules.js';
import type { RawSkill } from './loaders/skill.js';

// ---- helpers -------------------------------------------------------------

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

function num(v: unknown, def: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : def;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

// ---- skill ---------------------------------------------------------------

const SKILL_UI_KEYS: Record<string, keyof SkillUi> = {
  'display-name': 'displayName',
  'short-description': 'shortDescription',
  'icon-small': 'iconSmall',
  'icon-large': 'iconLarge',
  'brand-color': 'brandColor',
  'default-prompt': 'defaultPrompt',
};

export function normalizeSkill(raw: RawSkill): SkillDoc {
  const fm = raw.frontmatter;
  const meta = asRecord(fm['metadata']);
  const uiRaw = asRecord(fm['ui']);
  const ui: SkillUi | undefined =
    Object.keys(uiRaw).length > 0
      ? Object.fromEntries(
          Object.entries(uiRaw)
            .map(([k, v]) => [SKILL_UI_KEYS[k] ?? k, str(v) ?? v]),
        )
      : undefined;
  const invRaw = asRecord(fm['invocation']);
  const invocation: SkillInvocation = {
    model: bool(invRaw['model'], true),
    user: bool(invRaw['user'], true),
    implicit: bool(invRaw['implicit'], true),
  };
  const depsRaw = asRecord(fm['dependencies']);
  const toolsRaw = Array.isArray(depsRaw['tools']) ? depsRaw['tools'] : [];
  const dependencies: ToolRef[] = toolsRaw
    .map((t) => asRecord(t))
    .filter((t) => str(t['type']) !== undefined && str(t['value']) !== undefined)
    .map((t) => ({ type: str(t['type']) as string, value: str(t['value']) as string }));

  return {
    name: str(fm['name']) ?? raw.name,
    description: str(fm['description']) ?? '',
    whenToUse: str(fm['when-to-use']),
    metadata: meta,
    ui,
    invocation,
    products: strArr(fm['products']),
    dependencies,
    // references/scripts from bundle scan + frontmatter declarations
    references: [...new Set([...strArr(fm['references']), ...raw.references])],
    scripts: [...new Set([...strArr(fm['scripts']), ...raw.scripts])],
    data: strArr(fm['data']),
    body: raw.body,
  };
}

// ---- rules ---------------------------------------------------------------

const SCOPE_VALUES = ['all', 'tools', 'session', 'surface'] as const;
const ENFORCE_VALUES = ['hard', 'soft'] as const;

/** Split a rule body into sections by ## headings (D7). The leading H1 becomes the default heading. */
export function splitRuleSections(body: string): RuleSection[] {
  const lines = body.split(/\r?\n/);
  const sections: RuleSection[] = [];
  let current: RuleSection | null = null;
  for (const line of lines) {
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      if (current) sections.push(current);
      current = { heading: h2[1].trim(), body: '' };
      continue;
    }
    if (!current) {
      const h1 = /^#\s+(.*)$/.exec(line);
      current = { heading: h1 ? h1[1].trim() : '', body: '' };
      if (h1) continue;
    }
    current.body += (current.body ? '\n' : '') + line;
  }
  if (current) sections.push(current);
  if (sections.length === 0) sections.push({ heading: '', body });
  return sections.map((s) => ({ heading: s.heading, body: s.body.trim() }));
}

export function normalizeRule(raw: RawRule): RuleDoc {
  const fm = raw.frontmatter;
  const permRaw = asRecord(fm['permission']);
  const scope = SCOPE_VALUES.find((s) => s === fm['scope']) ?? 'all';
  const enforce = ENFORCE_VALUES.find((e) => e === fm['enforce']) ?? 'soft';
  return {
    id: str(fm['id']) ?? raw.id,
    title: str(fm['title']),
    description: str(fm['description']),
    scope,
    enforce,
    permission:
      str(permRaw['effect']) !== undefined && str(permRaw['resource']) !== undefined
        ? { effect: permRaw['effect'] as 'allow' | 'deny', resource: str(permRaw['resource']) as string }
        : undefined,
    order: num(fm['order'], 100),
    appliesTo: str(fm['applies-to']),
    enabled: bool(fm['enabled'], true),
    sections: splitRuleSections(raw.body),
  };
}

// ---- prompts -------------------------------------------------------------

export function normalizePrompt(raw: RawPrompt): PromptDoc {
  const fm = raw.frontmatter;
  return {
    id: str(fm['id']) ?? raw.id,
    language: str(fm['language']) ?? 'zh-CN',
    tone: str(fm['tone']),
    order: num(fm['order'], 100),
    enabled: bool(fm['enabled'], true),
    body: raw.body.trim(),
  };
}

/** Merge enabled personas by order into one persona (D10). */
export function mergePersonas(prompts: PromptDoc[]): PromptDoc[] {
  const enabled = prompts.filter((p) => p.enabled).sort((a, b) => a.order - b.order);
  if (enabled.length <= 1) return prompts;
  const mergedBody = enabled
    .map((p) => `<!-- persona:${p.id} (order ${p.order}) -->\n\n${p.body}`)
    .join('\n\n---\n\n');
  const merged: PromptDoc = {
    id: enabled.map((p) => p.id).join('+'),
    language: enabled[0].language,
    order: enabled[0].order,
    enabled: true,
    body: mergedBody,
  };
  return [merged];
}

// ---- configs -------------------------------------------------------------

const SANDBOX_VALUES = ['read-only', 'workspace-write', 'danger-full-access'] as const;
const APPROVAL_VALUES = ['never', 'on-request', 'unless-trusted'] as const;
const ENGINE_VALUES = ['dsh', 'codex'] as const;

export function normalizeConfig(raw: RawConfig): RuntimeConfig {
  const d = raw.data;
  const mcpRaw = Array.isArray(d['mcp_servers']) ? d['mcp_servers'] : [];
  const mcpServers = mcpRaw
    .map((s) => asRecord(s))
    .filter((s) => str(s['name']) !== undefined && (s['transport'] === 'stdio' || s['transport'] === 'http'))
    .map((s) => ({
      name: str(s['name']) as string,
      transport: s['transport'] as 'stdio' | 'http',
      command: str(s['command']),
      url: str(s['url']),
      env: typeof s['env'] === 'object' && s['env'] !== null ? (s['env'] as Record<string, string>) : undefined,
    }));
  const uiRaw = asRecord(d['ui']);
  const surfacesRaw = Array.isArray(uiRaw['surfaces']) ? uiRaw['surfaces'] : [];
  const memoryRaw = asRecord(d['memory']);
  return {
    version: str(d['version']) ?? '0.0',
    engine: (ENGINE_VALUES.find((e) => e === d['engine']) ?? 'dsh') as RuntimeConfig['engine'],
    model: str(d['model']),
    mcpServers,
    sandbox: (SANDBOX_VALUES.find((s) => s === d['sandbox']) ?? 'read-only') as RuntimeConfig['sandbox'],
    approval: (APPROVAL_VALUES.find((a) => a === d['approval']) ?? 'on-request') as RuntimeConfig['approval'],
    ui:
      Object.keys(uiRaw).length > 0
        ? { theme: str(uiRaw['theme']), surfaces: surfacesRaw.filter((s): s is 'web' | 'mobile' | 'voice' => ['web', 'mobile', 'voice'].includes(s as string)) }
        : undefined,
    memory: str(memoryRaw['provider']) !== undefined
      ? { provider: memoryRaw['provider'] as 'mcp-memory' | 'codex-native' }
      : undefined,
  };
}

// ---- knowledge -----------------------------------------------------------

export function normalizeKnowledge(knowledge: KnowledgeDoc[]): KnowledgeDoc[] {
  return knowledge;
}

// ---- derivation ----------------------------------------------------------

/** Derive the PermissionSet from enabled hard rules (D6/D14). */
export function derivePermissions(rules: RuleDoc[]): PermissionFragment[] {
  return rules
    .filter((r) => r.enabled && r.enforce === 'hard' && r.permission)
    .map((r) => r.permission as PermissionFragment);
}

// ---- assemble ------------------------------------------------------------

export interface NormalizeInput {
  skills: RawSkill[];
  rules: RawRule[];
  prompts: RawPrompt[];
  config?: RawConfig;
  knowledge: KnowledgeDoc[];
}

export function normalize(input: NormalizeInput): {
  docs: TenantDocs;
  permissions: PermissionFragment[];
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];

  let skills = input.skills.map(normalizeSkill);
  // Same-name resolution within the tenant layer (D17 nearest-wins; template layers land in M4).
  const byName = new Map<string, SkillDoc>();
  for (const s of skills) {
    const existing = byName.get(s.name);
    if (existing) {
      diagnostics.push({
        severity: 'warning',
        code: 'SKILL_DUPLICATE',
        file: s.name,
        message: `duplicate skill name "${s.name}" — keeping the first occurrence (template layering lands in M4)`,
      });
      continue;
    }
    byName.set(s.name, s);
  }
  skills = [...byName.values()];

  const rules = input.rules.map(normalizeRule);
  const prompts = mergePersonas(input.prompts.map(normalizePrompt));
  const config = input.config ? normalizeConfig(input.config) : undefined;
  const knowledge = normalizeKnowledge(input.knowledge);

  if (!config) {
    diagnostics.push({
      severity: 'error',
      code: 'CONFIG_REQUIRED',
      message: 'configs/runtime.yaml is required to assemble TenantDocs',
    });
  }

  return {
    docs: {
      skills,
      rules,
      prompts,
      config: config ?? {
        version: '0.0',
        engine: 'dsh',
        mcpServers: [],
        sandbox: 'read-only',
        approval: 'on-request',
      },
      knowledge,
    },
    permissions: derivePermissions(rules),
    diagnostics,
  };
}
