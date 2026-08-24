import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTenantDocs } from '@buildingos/normalizer';
import { codexAdapter } from '../src/index.js';

const EXAMPLES = fileURLToPath(new URL('../../../examples', import.meta.url));
const GOLDEN = fileURLToPath(new URL('../../../examples/engine-views/codex', import.meta.url));

async function loadExamples() {
  return loadTenantDocs({
    repoRoot: EXAMPLES,
    buildingosDir: EXAMPLES,
    knowledgeDir: path.join(EXAMPLES, 'knowledge'),
  });
}

function assets(skill: string, rel: string) {
  const abs = path.join(EXAMPLES, 'skills', skill, rel);
  try {
    return readFile(abs, 'utf8');
  } catch {
    return undefined;
  }
}

describe('CodexAdapter.compile — golden-output parity (conformance G1, Codex side)', () => {
  it('produces the expected file set', async () => {
    const { docs } = await loadExamples();
    const view = codexAdapter.compile(docs, { assets });
    const paths = view.files.map((f) => f.path).sort();
    expect(paths).toContain('.codex/skills/network-diagnose/SKILL.md');
    expect(paths).toContain('.codex/skills/network-diagnose/openai.yaml');
    expect(paths).toContain('.codex/skills/network-diagnose/references/thresholds.md');
    expect(paths).toContain('.codex/skills/network-diagnose/scripts/telemetry-snapshot.py');
    expect(paths).toContain('.codex/AGENTS.md');
    expect(paths).toContain('.codex/config.toml');
    expect(view.engine).toBe('codex');
  });

  it('renders SKILL.md with parser-consumed frontmatter only (name/description/metadata.short-description)', async () => {
    const { docs } = await loadExamples();
    const view = codexAdapter.compile(docs);
    const file = view.files.find((f) => f.path === '.codex/skills/network-diagnose/SKILL.md');
    const { parse } = await import('yaml');
    const fm = parse(file!.content.slice(4, file!.content.indexOf('\n---', 4))) as Record<string, any>;
    expect(Object.keys(fm).sort()).toEqual(['description', 'metadata', 'name']);
    expect(fm.metadata).toEqual({ 'short-description': '网络健康诊断' });
  });

  it('renders openai.yaml matching the golden output (semantic)', async () => {
    const { docs } = await loadExamples();
    const view = codexAdapter.compile(docs, { assets });
    const file = view.files.find((f) => f.path === '.codex/skills/network-diagnose/openai.yaml');
    const golden = await readFile(path.join(GOLDEN, '.codex/skills/network-diagnose/openai.yaml'), 'utf8');
    const { parse } = await import('yaml');
    expect(parse(file!.content)).toEqual(parse(golden));
  });

  it('derives dependencies transport/command from config (Q3 layering)', async () => {
    const { docs } = await loadExamples();
    const view = codexAdapter.compile(docs);
    const file = view.files.find((f) => f.path === '.codex/skills/network-diagnose/openai.yaml');
    const { parse } = await import('yaml');
    const y = parse(file!.content) as { dependencies: { tools: any[] } };
    expect(y.dependencies.tools[0]).toEqual({ type: 'mcp', value: 'telemetry', transport: 'stdio', command: 'npx telemetry-mcp' });
  });

  it('renders AGENTS.md matching the golden output (rules by order + persona)', async () => {
    const { docs } = await loadExamples();
    const view = codexAdapter.compile(docs);
    const file = view.files.find((f) => f.path === '.codex/AGENTS.md');
    const golden = await readFile(path.join(GOLDEN, '.codex/AGENTS.md'), 'utf8');
    expect(file!.content.trimEnd()).toBe(golden.trimEnd());
    const order = file!.content.indexOf('数据不出租户边界');
    const persona = file!.content.indexOf('运维工程师');
    expect(order).toBeGreaterThan(-1);
    expect(persona).toBeGreaterThan(order);
  });

  it('renders config.toml with unified sandbox/approval vocabulary (D13)', async () => {
    const { docs } = await loadExamples();
    const view = codexAdapter.compile(docs);
    const file = view.files.find((f) => f.path === '.codex/config.toml');
    expect(file!.content).toContain('model = "gpt-4o"');
    expect(file!.content).toContain('sandbox_mode = "read-only"');
    expect(file!.content).toContain('approval_policy = "on-request"');
    expect(file!.content).toContain('[mcp_servers.telemetry]');
  });
});
