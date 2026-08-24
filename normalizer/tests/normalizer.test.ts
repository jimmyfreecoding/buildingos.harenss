import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  derivePermissions,
  lintOrderUniqueness,
  loadTenantDocs,
  mergePersonas,
  parseFrontmatter,
} from '../src/index.js';
import type { PromptDoc, RuleDoc } from '../src/types.js';

const EXAMPLES = fileURLToPath(new URL('../../examples', import.meta.url));

async function loadExamples() {
  return loadTenantDocs({
    repoRoot: EXAMPLES,
    buildingosDir: EXAMPLES,
    knowledgeDir: path.join(EXAMPLES, 'knowledge'),
  });
}

// ---------------------------------------------------------------------------

describe('frontmatter extractor (stage 1a)', () => {
  it('parses a valid frontmatter block', () => {
    const r = parseFrontmatter('x.md', '---\nname: foo\ndescription: bar\n---\n# body');
    expect(r.frontmatter.name).toBe('foo');
    expect(r.body).toContain('# body');
    expect(r.diagnostics).toHaveLength(0);
  });

  it('warns on missing frontmatter', () => {
    const r = parseFrontmatter('x.md', '# no frontmatter');
    expect(r.diagnostics[0].code).toBe('FRONTMATTER_MISSING');
    expect(r.frontmatter).toEqual({});
  });

  it('warns and falls back on invalid YAML', () => {
    const r = parseFrontmatter('x.md', '---\nname: [unclosed\n---\nbody');
    expect(r.diagnostics[0].code).toBe('FRONTMATTER_INVALID');
    expect(r.frontmatter).toEqual({});
    expect(r.body).toContain('body');
  });
});

// ---------------------------------------------------------------------------

describe('loadTenantDocs on examples/ (acceptance case)', () => {
  it('loads the example tenant successfully', async () => {
    const res = await loadExamples();
    expect(res.ok).toBe(true);
    expect(res.docs.skills).toHaveLength(1);
    expect(res.docs.rules).toHaveLength(2);
    expect(res.docs.prompts).toHaveLength(1);
    expect(res.docs.knowledge.length).toBeGreaterThan(0);
    expect(res.docs.config.engine).toBe('dsh');
    expect(res.docs.config.mcpServers).toEqual([{ name: 'telemetry', transport: 'stdio', command: 'npx telemetry-mcp' }]);
  });

  it('normalizes network-diagnose per the skill mapping', async () => {
    const { docs } = await loadExamples();
    const s = docs.skills[0];
    expect(s.name).toBe('network-diagnose');
    expect(s.description.length).toBeGreaterThan(0);
    expect(s.whenToUse).toBeTruthy(); // when-to-use → whenToUse
    expect(s.invocation).toEqual({ model: true, user: true, implicit: false });
    expect(s.ui?.displayName).toBe('网络诊断'); // ui.display-name → ui.displayName
    expect(s.ui?.brandColor).toBe('#2563EB');
    expect(s.dependencies).toEqual([{ type: 'mcp', value: 'telemetry' }]); // references only (D3)
    expect(s.data).toContain('knowledge/topology.yaml'); // tenant data (D5/D19)
    expect(s.scripts).toContain('scripts/telemetry-snapshot.py'); // N1
    expect(s.references).toContain('references/thresholds.md');
    expect(s.metadata['x-buildingos']).toBeUndefined(); // carry namespace is added at compile, not normalize
  });

  it('normalizes rules with sections and generative permission (D6)', async () => {
    const { docs } = await loadExamples();
    const hard = docs.rules.filter((r) => r.enforce === 'hard');
    expect(hard).toHaveLength(2);
    for (const r of hard) {
      expect(r.permission).toBeTruthy();
      expect(r.sections.length).toBeGreaterThan(0);
    }
    const exfil = docs.rules.find((r) => r.id === 'no-data-exfiltration');
    expect(exfil?.permission).toEqual({ effect: 'deny', resource: 'data:*:external' });
  });

  it('derives the PermissionSet from hard rules (D6/D14)', async () => {
    const { permissions } = await loadExamples();
    const effects = permissions.map((p) => `${p.effect}:${p.resource}`);
    expect(effects).toContain('deny:data:*:external');
    expect(effects).toContain('deny:write:*');
  });

  it('finds no ORDER_DUPLICATE in the example (orders 10/20/30, D20)', async () => {
    const { diagnostics } = await loadExamples();
    expect(diagnostics.filter((d) => d.code === 'ORDER_DUPLICATE')).toHaveLength(0);
  });

  it('resolves all dependencies against mcp_servers (D3)', async () => {
    const { diagnostics } = await loadExamples();
    expect(diagnostics.filter((d) => d.code === 'DEP_UNRESOLVED')).toHaveLength(0);
  });

  it('keeps a single persona intact (D10 merge is a no-op)', async () => {
    const { docs, diagnostics } = await loadExamples();
    expect(docs.prompts[0].id).toBe('ops-engineer');
    expect(docs.prompts[0].language).toBe('zh-CN');
    expect(diagnostics.filter((d) => d.code === 'PROMPT_MERGE')).toHaveLength(0);
  });

  it('outputs TenantDocs that pass the contract gate', async () => {
    const { ok, diagnostics } = await loadExamples();
    expect(ok).toBe(true);
    expect(diagnostics.filter((d) => d.code === 'CONTRACT_VIOLATION')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('negative cases (crafted temp tenant)', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bos-norm-'));
    const b = path.join(dir, '.buildingos');
    await mkdir(path.join(b, 'skills', 'need-tool'), { recursive: true });
    await mkdir(path.join(b, 'rules'), { recursive: true });
    await mkdir(path.join(b, 'prompts'), { recursive: true });
    await mkdir(path.join(b, 'configs'), { recursive: true });
    await writeFile(
      path.join(b, 'skills', 'need-tool', 'SKILL.md'),
      '---\nname: need-tool\ndescription: x\ndependencies:\n  tools:\n    - type: mcp\n      value: missing\n---\nbody',
    );
    await writeFile(path.join(b, 'rules', 'dup-a.md'), '---\nid: dup-a\norder: 20\n---\n# A');
    await writeFile(path.join(b, 'prompts', 'dup-b.md'), '---\nid: dup-b\norder: 20\n---\n# B');
    await writeFile(
      path.join(b, 'configs', 'runtime.yaml'),
      'version: "0.1"\nengine: dsh\npermissions:\n  deny: [write:*]\n',
    );
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('flags ORDER_DUPLICATE, DEP_UNRESOLVED, PERMISSIONS_HAND_WRITTEN and fails the gate', async () => {
    const res = await loadTenantDocs({ repoRoot: dir });
    const codes = res.diagnostics.map((d) => d.code);
    expect(codes).toContain('ORDER_DUPLICATE'); // D20
    expect(codes).toContain('DEP_UNRESOLVED'); // D3
    expect(codes).toContain('PERMISSIONS_HAND_WRITTEN'); // D14
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('pure functions', () => {
  it('mergePersonas merges multiple personas by order (D10)', () => {
    const a: PromptDoc = { id: 'a', language: 'zh-CN', order: 20, enabled: true, body: 'A body' };
    const b: PromptDoc = { id: 'b', language: 'zh-CN', order: 10, enabled: true, body: 'B body' };
    const merged = mergePersonas([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].body).toContain('persona:b');
    expect(merged[0].body).toContain('persona:a');
    expect(merged[0].body.indexOf('persona:b')).toBeLessThan(merged[0].body.indexOf('persona:a'));
  });

  it('derivePermissions collects enabled hard-rule fragments only (D6)', () => {
    const rules: RuleDoc[] = [
      { id: 'r1', scope: 'all', enforce: 'hard', permission: { effect: 'deny', resource: 'data:*:external' }, order: 10, enabled: true, sections: [{ heading: '', body: '' }] },
      { id: 'r2', scope: 'tools', enforce: 'soft', order: 20, enabled: true, sections: [{ heading: '', body: '' }] },
      { id: 'r3', scope: 'all', enforce: 'hard', permission: { effect: 'deny', resource: 'write:*' }, order: 30, enabled: false, sections: [{ heading: '', body: '' }] },
    ];
    expect(derivePermissions(rules)).toEqual([{ effect: 'deny', resource: 'data:*:external' }]);
  });

  it('lintOrderUniqueness reports cross-family duplicates (D20)', () => {
    const rules: RuleDoc[] = [{ id: 'r1', scope: 'all', enforce: 'soft', order: 20, enabled: true, sections: [] }];
    const prompts: PromptDoc[] = [{ id: 'p1', language: 'zh-CN', order: 20, enabled: true, body: '' }];
    const ds = lintOrderUniqueness(rules, prompts);
    expect(ds.some((d) => d.code === 'ORDER_DUPLICATE')).toBe(true);
  });
});
