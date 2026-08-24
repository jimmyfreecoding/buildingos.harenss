import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTenantDocs } from '@buildingos/normalizer';
import { dshAdapter } from '../src/index.js';

const EXAMPLES = fileURLToPath(new URL('../../../examples', import.meta.url));
const GOLDEN = fileURLToPath(new URL('../../../examples/engine-views/dsh', import.meta.url));

async function loadExamples() {
  return loadTenantDocs({
    repoRoot: EXAMPLES,
    buildingosDir: EXAMPLES,
    knowledgeDir: path.join(EXAMPLES, 'knowledge'),
  });
}

/** Asset resolver reading reference/script files from the example tenant. */
function assets(skill: string, rel: string) {
  const abs = path.join(EXAMPLES, 'skills', skill, rel);
  try {
    return readFile(abs, 'utf8');
  } catch {
    return undefined;
  }
}

describe('DshAdapter.compile — golden-output parity (conformance G1, DSH side)', () => {
  it('produces the expected file set', async () => {
    const { docs } = await loadExamples();
    const view = dshAdapter.compile(docs, { assets });
    const paths = view.files.map((f) => f.path).sort();
    expect(paths).toContain('.dsh/skills/network-diagnose/SKILL.md');
    expect(paths).toContain('.dsh/skills/network-diagnose/references/thresholds.md');
    expect(paths).toContain('.dsh/skills/network-diagnose/scripts/telemetry-snapshot.py');
    expect(paths).toContain('generated/system-prompt-sections.md');
    expect(view.engine).toBe('dsh');
  });

  it('renders the DSH SKILL.md matching the golden output (frontmatter semantics + body)', async () => {
    const { docs } = await loadExamples();
    const view = dshAdapter.compile(docs, { assets });
    const file = view.files.find((f) => f.path === '.dsh/skills/network-diagnose/SKILL.md');
    expect(file).toBeDefined();
    const golden = await readFile(path.join(GOLDEN, '.dsh/skills/network-diagnose/SKILL.md'), 'utf8');
    // Body parity (after the frontmatter fence)
    const bodyOf = (s: string) => s.slice(s.indexOf('---', s.indexOf('---') + 3) + 3).trimEnd();
    expect(bodyOf(file!.content)).toBe(bodyOf(golden));
    // Frontmatter parity (semantic: parse both, deep-equal; lossless-carry namespace included)
    const fmOf = (s: string) => s.slice(4, s.indexOf('\n---', 4));
    const { parse } = await import('yaml');
    expect(parse(fmOf(file!.content))).toEqual(parse(fmOf(golden)));
  });

  it('carries invocation.implicit=false and ui in metadata.x-buildingos (D2/D4)', async () => {
    const { docs } = await loadExamples();
    const view = dshAdapter.compile(docs);
    const file = view.files.find((f) => f.path === '.dsh/skills/network-diagnose/SKILL.md');
    const { parse } = await import('yaml');
    const fm = parse(file!.content.slice(4, file!.content.indexOf('\n---', 4))) as Record<string, any>;
    const x = fm.metadata['x-buildingos'] as Record<string, any>;
    expect(x['invocation-implicit']).toBe(false);
    expect(x.ui['display-name']).toBe('网络诊断');
    expect(fm['disable-model-invocation']).toBeUndefined(); // invocation.model=true → omitted
    expect(fm['user-invocable']).toBeUndefined(); // invocation.user=true → omitted
  });

  it('renders system-prompt sections with rules and persona by order (D20)', async () => {
    const { docs } = await loadExamples();
    const view = dshAdapter.compile(docs);
    const file = view.files.find((f) => f.path === 'generated/system-prompt-sections.md');
    expect(file!.content).toContain('## persona:ops-engineer (order 30');
    expect(file!.content).toContain('## rules:no-data-exfiltration (order 10, hard)');
    expect(file!.content).toContain('## rules:read-only-by-default (order 20, hard)');
  });

  it('reports selfcheck with honest pending-run status', () => {
    const reports = dshAdapter.selfcheck();
    expect(reports[0].dimension).toBe('interface');
    expect(reports.some((r) => r.passed === false)).toBe(true); // run() bridge pending
  });

  it('run() is a documented pending bridge', () => {
    expect(() => dshAdapter.run({ sessionId: 's', tenantId: 't', intent: 'x', skills: [], permissions: {} }, {})).toThrow(/not implemented/);
  });
});
