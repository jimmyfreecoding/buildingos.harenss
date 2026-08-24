import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runConformance, runG1 } from '../src/index.js';

const REPO = fileURLToPath(new URL('../../', import.meta.url)); // buildingos.harenss root
const EXAMPLES = path.join(REPO, 'examples');
const GOLDEN = path.join(EXAMPLES, 'engine-views');

const opts = {
  repoRoot: EXAMPLES,
  buildingosDir: EXAMPLES,
  knowledgeDir: path.join(EXAMPLES, 'knowledge'),
  goldenDir: GOLDEN,
  assets: (skill: string, rel: string) => readFile(path.join(EXAMPLES, 'skills', skill, rel), 'utf8').catch(() => undefined),
};

describe('conformance G1 — compile parity against golden engine-views', () => {
  it('passes on both engines (dsh + codex)', async () => {
    const results = await runG1(opts);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.passed, `${r.engine}: ${r.details.join('; ')}`).toBe(true);
    }
  });

  it('reports tenant-level errors when they occur', async () => {
    // Break the fixture by pointing at an empty dir → tenant load fails and G1 must surface it
    const empty = path.join(REPO, 'conformance');
    const results = await runG1({ ...opts, repoRoot: empty, buildingosDir: path.join(empty, 'nonexistent') });
    for (const r of results) {
      expect(r.passed).toBe(false);
      expect(r.details.some((d) => d.startsWith('tenant error'))).toBe(true);
    }
  });
});

describe('conformance G2–G4 — engine-gated skeletons', () => {
  it('reports all three as skipped with documented criteria', async () => {
    const results = await runConformance(opts);
    const gated = results.filter((r) => 'skipped' in r);
    expect(gated).toHaveLength(3);
    for (const g of gated) {
      expect(g.skipped).toBe(true);
      expect(g.acceptanceCriteria.length).toBeGreaterThan(0);
    }
  });
});
