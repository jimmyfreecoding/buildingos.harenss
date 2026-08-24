/**
 * Set-level lint (pipeline stage 2b): cross-document rules that single-instance
 * JSON Schema cannot express. Severities are hard-coded in M1, configurable in M2 (N3).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Diagnostic, RuleDoc, PromptDoc, SkillDoc, TenantDocs } from './types.js';

export function lintOrderUniqueness(rules: RuleDoc[], prompts: PromptDoc[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Map<number, string>();
  for (const r of rules) {
    if (!r.enabled) continue;
    const prev = seen.get(r.order);
    if (prev) {
      out.push({
        severity: 'error',
        code: 'ORDER_DUPLICATE',
        file: r.id,
        message: `order ${r.order} is already used by ${prev} — order is one global numbering space (D20)`,
      });
    } else {
      seen.set(r.order, `rule:${r.id}`);
    }
  }
  for (const p of prompts) {
    if (!p.enabled) continue;
    const prev = seen.get(p.order);
    if (prev) {
      out.push({
        severity: 'error',
        code: 'ORDER_DUPLICATE',
        file: p.id,
        message: `order ${p.order} is already used by ${prev} — order is one global numbering space (D20)`,
      });
    } else {
      seen.set(p.order, `prompt:${p.id}`);
    }
  }
  return out;
}

export function lintDependencies(docs: TenantDocs): Diagnostic[] {
  const out: Diagnostic[] = [];
  const registered = new Set(docs.config.mcpServers.map((m) => m.name));
  for (const skill of docs.skills) {
    for (const dep of skill.dependencies) {
      if (!registered.has(dep.value)) {
        out.push({
          severity: 'error',
          code: 'DEP_UNRESOLVED',
          file: skill.name,
          message: `dependency "${dep.value}" (${dep.type}) is not registered in configs/runtime.yaml mcp_servers (D3 layering)`,
        });
      }
    }
  }
  return out;
}

export function lintPermissionsHandWritten(configRaw: Record<string, unknown> | undefined): Diagnostic[] {
  if (configRaw && 'permissions' in configRaw) {
    return [
      {
        severity: 'error',
        code: 'PERMISSIONS_HAND_WRITTEN',
        file: 'configs/runtime.yaml',
        message: 'permissions are derived from hard rules (D6/D14); hand-writing is forbidden',
      },
    ];
  }
  return [];
}

export function lintPaths(docs: TenantDocs, repoRoot: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const skill of docs.skills) {
    for (const ref of skill.references) {
      // references are skill-relative; resolve against the skill bundle directory when available
      if (ref.startsWith('references/') || ref.startsWith('scripts/')) continue; // collected from the bundle scan
      const candidate = path.join(repoRoot, 'skills', skill.name, ref);
      if (!existsSync(candidate)) {
        out.push({
          severity: 'warning',
          code: 'REF_MISSING',
          file: skill.name,
          message: `reference "${ref}" not found under skills/${skill.name}/ (D5)`,
        });
      }
    }
    for (const d of skill.data) {
      if (!existsSync(path.join(repoRoot, d))) {
        out.push({
          severity: 'warning',
          code: 'DATA_MISSING',
          file: skill.name,
          message: `data path "${d}" not found in the tenant repository (D5/D19)`,
        });
      }
    }
  }
  return out;
}

export function lintPromptMerge(prompts: PromptDoc[]): Diagnostic[] {
  const enabled = prompts.filter((p) => p.enabled);
  if (enabled.length > 1) {
    return [
      {
        severity: 'info',
        code: 'PROMPT_MERGE',
        message: `${enabled.length} enabled personas will merge into one by order (D10); role-based selection lands in M5`,
      },
    ];
  }
  return [];
}

export function lintUnknownFields(rawFrontmatters: { family: string; id: string; keys: string[]; allowed: string[] }[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const f of rawFrontmatters) {
    for (const key of f.keys) {
      if (!f.allowed.includes(key)) {
        out.push({
          severity: 'warning',
          code: 'UNKNOWN_FIELD',
          file: `${f.family}/${f.id}`,
          message: `unknown frontmatter field "${key}" — kept in the open metadata, flagged for review (import tolerance)`,
        });
      }
    }
  }
  return out;
}

export function lintAll(docs: TenantDocs, repoRoot: string, configRaw: Record<string, unknown> | undefined): Diagnostic[] {
  return [
    ...lintOrderUniqueness(docs.rules, docs.prompts),
    ...lintDependencies(docs),
    ...lintPermissionsHandWritten(configRaw),
    ...lintPaths(docs, repoRoot),
    ...lintPromptMerge(docs.prompts),
  ];
}
