/**
 * TenantDocs contract types — mirror of schemas/contract/adapter-contract.schema.json.
 * camelCase normalized model (distinct from tenant-document frontmatter's kebab-case;
 * normalization completes in pipeline stage 2). Hand-written until codegen lands (M1.5).
 */

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  code: string;
  file?: string;
  message: string;
}

// ---- Skill ---------------------------------------------------------------

export interface ToolRef {
  type: string;
  value: string;
}

export interface PermissionFragment {
  effect: 'allow' | 'deny';
  resource: string;
}

export interface SkillUi {
  displayName?: string;
  shortDescription?: string;
  iconSmall?: string;
  iconLarge?: string;
  brandColor?: string;
  defaultPrompt?: string;
}

export interface SkillInvocation {
  model: boolean;
  user: boolean;
  implicit: boolean;
}

export interface SkillDoc {
  name: string;
  description: string;
  whenToUse?: string;
  /** Open object; x-buildingos reserved for cross-engine lossless carry (D2/D4/D19). */
  metadata: Record<string, unknown>;
  ui?: SkillUi;
  invocation: SkillInvocation;
  products: string[];
  dependencies: ToolRef[];
  /** Bundle-internal resources (skill-relative paths). */
  references: string[];
  /** scripts/ paths (N1: Codex implicit invocation; DSH ignores but preserves). */
  scripts: string[];
  /** Tenant data paths, repo-root relative (D5, D19). */
  data: string[];
  body: string;
}

// ---- Rules ---------------------------------------------------------------

export interface RuleSection {
  heading: string;
  body: string;
}

export interface RuleDoc {
  id: string;
  title?: string;
  description?: string;
  scope: 'all' | 'tools' | 'session' | 'surface';
  enforce: 'hard' | 'soft';
  /** Required when enforce=hard (D6 generative). */
  permission?: PermissionFragment;
  order: number;
  /** Reserved in M0; compile ignores (D8). */
  appliesTo?: string;
  enabled: boolean;
  sections: RuleSection[];
}

// ---- Prompts -------------------------------------------------------------

export interface PromptDoc {
  id: string;
  language: string;
  tone?: string;
  order: number;
  enabled: boolean;
  body: string;
}

// ---- Configs -------------------------------------------------------------

export interface McpServerReg {
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  url?: string;
  env?: Record<string, string>;
}

export interface RuntimeConfig {
  version: string;
  engine: 'dsh' | 'codex';
  model?: string;
  mcpServers: McpServerReg[];
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  approval: 'never' | 'on-request' | 'unless-trusted';
  ui?: { theme?: string; surfaces?: ('web' | 'mobile' | 'voice')[] };
  /** Placeholder declaration (D15); concrete fields after M1 research. */
  memory?: { provider: 'mcp-memory' | 'codex-native' };
}

// ---- Knowledge (free-form, D19/t3) ---------------------------------------

export interface KnowledgeDoc {
  /** Repo-root relative path (e.g., knowledge/topology.yaml). */
  path: string;
  content: string;
}

// ---- TenantDocs ----------------------------------------------------------

export interface TenantDocs {
  skills: SkillDoc[];
  rules: RuleDoc[];
  prompts: PromptDoc[];
  config: RuntimeConfig;
  knowledge: KnowledgeDoc[];
}

// ---- Loader API ----------------------------------------------------------

export interface LoadTenantDocsOptions {
  /** Tenant repository root; used to resolve data: paths and repo-relative knowledge paths. */
  repoRoot: string;
  /** Directory that holds the family subdirectories (rules/, skills/, prompts/, configs/). Defaults to <repoRoot>/.buildingos. */
  buildingosDir?: string;
  /** World-knowledge directory (D19). Defaults to <repoRoot>/knowledge. */
  knowledgeDir?: string;
  /** D17 skill layers (platform-bundled / industry templates); used from M4. */
  skillLayers?: unknown[];
}

export interface LoadResult {
  docs: TenantDocs;
  diagnostics: Diagnostic[];
  /** PermissionSet derived from hard rules (D6/D14), for rendering and run. */
  permissions: PermissionFragment[];
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Adapter contract (mirror of schemas/contract/adapter-contract.schema.json §3/§5/§6)
// ---------------------------------------------------------------------------

export interface GeneratedFile {
  path: string;
  content: string;
  kind: 'skill' | 'rule' | 'prompt' | 'config' | 'knowledge';
}

export interface EngineView {
  engine: 'dsh' | 'codex';
  files: GeneratedFile[];
  /** In-memory mode (headless direct config, no files written). */
  runtimeConfig?: Record<string, unknown>;
}

/** Engine-native config derived from RuntimeConfig; opaque, adapter-specific. */
export type EngineConfig = Record<string, unknown>;

export interface ContextSlice {
  [key: string]: unknown;
}

export interface PermissionSet {
  [key: string]: unknown;
}

export interface RunRequest {
  sessionId: string;
  tenantId: string;
  intent: string;
  skills: string[];
  context?: ContextSlice;
  permissions: PermissionSet;
}

export type AsyncStream<T> = AsyncIterable<T> | Iterable<T>;

export type AgentEvent =
  | { type: 'thought'; ts: string; payload: { text: string } }
  | { type: 'tool.call'; ts: string; payload: { tool: string; args: unknown } }
  | { type: 'tool.result'; ts: string; payload: { tool: string; ok: boolean; result?: unknown } }
  | { type: 'step'; ts: string; payload: { step: string; summary?: string } }
  | { type: 'message'; ts: string; payload: { text: string } }
  | { type: 'artifact'; ts: string; payload: { type: string; data: unknown } }
  | { type: 'error'; ts: string; payload: { code: string; message: string } }
  | { type: 'approval.request'; ts: string; payload: { id: string; description: string; options?: string[] } }
  | { type: 'user.input.request'; ts: string; payload: { id: string; question: string; options?: string[] } };

export interface ToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface AdapterStatus {
  engine: string;
  version?: string;
  healthy: boolean;
  capabilities?: string[];
}

export interface ConformanceReport {
  dimension: 'interface' | 'behavior' | 'policy' | 'update-gate';
  passed: boolean;
  details?: string;
}

/** Asset resolver used by compile() to materialize reference/script files (injected; keeps compile pure). */
export type AssetResolver = (skill: string, rel: string) => string | undefined;

export interface CompileOptions {
  assets?: AssetResolver;
}

export interface HarnessAdapter {
  engine: 'dsh' | 'codex';
  compile(docs: TenantDocs, opts?: CompileOptions): EngineView;
  run(req: RunRequest, cfg: EngineConfig): AsyncStream<AgentEvent>;
  tools(): ToolDescriptor[];
  status(): AdapterStatus;
  selfcheck(): ConformanceReport[];
}
