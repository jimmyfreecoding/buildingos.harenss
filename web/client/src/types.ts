/** Shared API types for the web console client. */

export interface RecentEntry {
  path: string;
  lastUsed: number;
  name: string;
}

export interface TreeNode {
  path: string;
  isDir: boolean;
  size?: number;
}

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  file?: string;
  message: string;
}

export interface ValidateResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export interface CompileResult {
  engine: string;
  files: string[];
  outDir: string;
}

export interface ConformanceResultItem {
  task: string;
  engine?: string;
  passed?: boolean;
  skipped?: boolean;
  details?: string[];
}

export interface ConformanceResult {
  results: ConformanceResultItem[];
  baseline: boolean;
  note?: string;
}

export interface DevContainer {
  name: string;
  service: string;
  status: string;
  ports?: string;
}

export interface DevStatus {
  workspace: string;
  composeExists: boolean;
  containers: DevContainer[];
  error?: string;
}

export interface DevActionResult {
  ok: boolean;
  output: string;
  error?: string;
}

export interface WizardRequest {
  dir: string;
  language: 'zh' | 'en';
  engine: 'dsh' | 'codex';
  model: string;
  customModel?: string;
  modelToken: string;
  gitToken?: string;
}

export interface WizardResult {
  ok: boolean;
  language: 'zh' | 'en';
  engine: 'dsh' | 'codex';
  model: string;
}

export interface ApiError {
  error: string;
}
