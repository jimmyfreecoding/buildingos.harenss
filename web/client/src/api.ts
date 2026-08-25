/** Thin fetch wrapper for the console API. */
import type {
  CompileResult,
  ConformanceResult,
  DevActionResult,
  DevStatus,
  Diagnostic,
  RecentEntry,
  TreeNode,
  WizardRequest,
  WizardResult,
} from './types';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  health: () => req<{ ok: boolean; version: string }>('GET', '/api/health'),

  recents: () => req<{ recents: RecentEntry[] }>('GET', '/api/workspaces/recents'),
  selectWorkspace: (path: string) =>
    req<{ path: string; name: string }>('POST', '/api/workspaces/select', { path }),
  scanWorkspaces: (baseDir: string, depth = 1) =>
    req<{ baseDir: string; workspaces: string[] }>('POST', '/api/workspaces/scan', { baseDir, depth }),

  tree: (path: string) => req<{ workspace: string; tree: TreeNode[] }>('GET', `/api/workspace/tree?path=${encodeURIComponent(path)}`),
  readFile: (path: string, file: string) =>
    req<{ file: string; content: string }>('GET', `/api/workspace/file?path=${encodeURIComponent(path)}&file=${encodeURIComponent(file)}`),
  writeFile: (workspace: string, file: string, content: string) =>
    req<{ ok: boolean; file: string }>('POST', '/api/workspace/file', { workspace, file, content }),

  wizard: (w: WizardRequest) => req<WizardResult>('POST', '/api/wizard', w),

  validate: (workspace: string) => req<{ ok: boolean; diagnostics: Diagnostic[] }>('POST', '/api/validate', { workspace }),
  compile: (workspace: string, engine: 'dsh' | 'codex') =>
    req<CompileResult>('POST', '/api/compile', { workspace, engine }),
  conformance: (workspace: string) => req<ConformanceResult>('POST', '/api/conformance', { workspace }),

  devStatus: (workspace: string) => req<DevStatus>('GET', `/api/dev/status?workspace=${encodeURIComponent(workspace)}`),
  devUp: (workspace: string, pgPort?: string) => req<DevActionResult>('POST', '/api/dev/up', { workspace, pgPort }),
  devDown: (workspace: string, volumes = false) => req<DevActionResult>('POST', '/api/dev/down', { workspace, volumes }),
};
