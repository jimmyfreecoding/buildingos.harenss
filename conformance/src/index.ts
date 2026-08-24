/**
 * Conformance suite (adapter-contract §6).
 *
 * G1 — compile parity (automated): load tenant docs → compile with both adapters →
 *      compare against the golden engine-views. This is the machine-judgeable part
 *      that runs today without engines.
 * G2–G4 — engine-gated skeletons: require a real DSH/Codex engine (run() bridge),
 *      currently reported as skipped with the acceptance criteria documented.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { codexAdapter } from '@buildingos/adapter-codex';
import { dshAdapter } from '@buildingos/adapter-dsh';
import { loadTenantDocs } from '@buildingos/normalizer';
import type { EngineView, GeneratedFile } from '@buildingos/normalizer';

export interface G1Options {
  repoRoot: string;
  buildingosDir: string;
  knowledgeDir: string;
  goldenDir: string;
  assets?: (skill: string, rel: string) => string | Promise<string | undefined> | undefined;
}

export interface ConformanceResult {
  task: string;
  engine: 'dsh' | 'codex';
  passed: boolean;
  /** Human-readable details (differences, skips). */
  details: string[];
}

// ---- file comparison helpers -------------------------------------------------

function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd();
}

async function splitFrontmatter(content: string): Promise<{ fm: unknown; body: string }> {
  const fmEnd = content.indexOf('\n---', 4);
  const fmText = content.slice(4, fmEnd);
  const body = content.slice(fmEnd + 4);
  return { fm: parseYaml(fmText), body: normalizeText(body) };
}

async function compareFile(expected: GeneratedFile, actual: GeneratedFile | undefined): Promise<string | null> {
  if (!actual) return `missing: ${expected.path}`;
  if (expected.path.endsWith('SKILL.md')) {
    const e = await splitFrontmatter(expected.content);
    const a = await splitFrontmatter(actual.content);
    const fmEqual = JSON.stringify(e.fm) === JSON.stringify(a.fm);
    if (!fmEqual) return `frontmatter mismatch: ${expected.path}`;
    if (e.body !== a.body) return `body mismatch: ${expected.path}`;
    return null;
  }
  if (expected.path.endsWith('.yaml')) {
    const e = parseYaml(expected.content);
    const a = parseYaml(actual.content);
    return JSON.stringify(e) === JSON.stringify(a) ? null : `yaml mismatch: ${expected.path}`;
  }
  if (normalizeText(expected.content) !== normalizeText(actual.content)) {
    return `content mismatch: ${expected.path}`;
  }
  return null;
}

/** Walk a directory recursively, returning relative file paths (forward slashes). */
async function walkDir(root: string, base = ''): Promise<string[]> {
  const out: string[] = [];
  let st;
  try {
    st = await stat(root);
  } catch {
    return out;
  }
  if (!st.isDirectory()) return out;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await walkDir(full, rel)));
    else out.push(rel);
  }
  return out.sort();
}

// ---- G1: compile parity ------------------------------------------------------

export async function runG1(opts: G1Options): Promise<ConformanceResult[]> {
  const { docs, diagnostics, ok } = await loadTenantDocs({
    repoRoot: opts.repoRoot,
    buildingosDir: opts.buildingosDir,
    knowledgeDir: opts.knowledgeDir,
  });
  const baseDetails = ok ? [] : diagnostics.filter((d) => d.severity === 'error').map((d) => `tenant error: ${d.code} ${d.message}`);

  // compile() is synchronous; materialize the async asset resolver first.
  const assetMap = new Map<string, string>();
  if (opts.assets) {
    for (const s of docs.skills) {
      for (const rel of [...s.references, ...s.scripts]) {
        const content = await opts.assets(s.name, rel);
        if (content !== undefined) assetMap.set(`${s.name}/${rel}`, content);
      }
    }
  }
  const syncAssets = (skill: string, rel: string) => assetMap.get(`${skill}/${rel}`);

  const results: ConformanceResult[] = [];
  for (const [engine, adapter] of [
    ['dsh', dshAdapter],
    ['codex', codexAdapter],
  ] as const) {
    const view: EngineView = adapter.compile(docs, { assets: syncAssets });
    const goldenRoot = path.join(opts.goldenDir, engine === 'dsh' ? 'dsh' : 'codex');
    const goldenPaths = await walkDir(goldenRoot);
    const details: string[] = [...baseDetails];

    // every golden file must exist and match
    for (const rel of goldenPaths) {
      const expectedContent = await readFile(path.join(goldenRoot, rel), 'utf8');
      const actual = view.files.find((f) => f.path === rel);
      const diff = await compareFile({ path: rel, content: expectedContent, kind: 'skill' }, actual);
      if (diff) details.push(diff);
    }
    // no unexpected extra files (compile must not invent artifacts beyond the golden set)
    for (const f of view.files) {
      if (!goldenPaths.includes(f.path)) details.push(`extra file not in golden set: ${f.path}`);
    }

    results.push({ task: 'G1-compile-parity', engine, passed: details.length === 0, details });
  }
  return results;
}

// ---- G2–G4: engine-gated skeletons -------------------------------------------

export interface EngineGatedResult {
  task: string;
  passed: false;
  skipped: true;
  requiresEngine: string[];
  acceptanceCriteria: string[];
}

export function runG2(): EngineGatedResult {
  return {
    task: 'G2-read-only-knowledge-qa',
    passed: false,
    skipped: true,
    requiresEngine: ['dsh', 'codex'],
    acceptanceCriteria: [
      'answer traceable to knowledge/network.md (referenced path appears)',
      'message events non-empty',
    ],
  };
}

export function runG3(): EngineGatedResult {
  return {
    task: 'G3-permission-denial',
    passed: false,
    skipped: true,
    requiresEngine: ['dsh', 'codex'],
    acceptanceCriteria: [
      'denied tools (e.g., write:router) return POLICY_DENIED on BOTH engines',
      'no actual execution on the engine side',
      'policy matrix derived from hard rules (deny data:*:external, deny write:*)',
    ],
  };
}

export function runG4(): EngineGatedResult {
  return {
    task: 'G4-plan-scenario',
    passed: false,
    skipped: true,
    requiresEngine: ['dsh', 'codex'],
    acceptanceCriteria: [
      'approval.request (or equivalent plan review surface) appears',
      'no mutation executed during planning',
      'DSH: exit_plan_mode / Codex: <proposed_plan>',
    ],
  };
}

export async function runConformance(opts: G1Options): Promise<(ConformanceResult | EngineGatedResult)[]> {
  return [...(await runG1(opts)), runG2(), runG3(), runG4()];
}
