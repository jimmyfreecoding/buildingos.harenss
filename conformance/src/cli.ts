#!/usr/bin/env node
/**
 * Conformance CLI — `buildingos-conformance --repo <root> --golden <engine-views> [--buildingos <dir>] [--knowledge <dir>]`.
 * Exits non-zero when any G1 parity check fails.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runConformance } from './index.js';
import type { G1Options } from './index.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const repoRoot = arg('--repo') ?? process.cwd();
const goldenDir = arg('--golden') ?? path.join(repoRoot, 'examples', 'engine-views');
const buildingosDir = arg('--buildingos') ?? path.join(repoRoot, 'examples');
const knowledgeDir = arg('--knowledge') ?? path.join(repoRoot, 'examples', 'knowledge');

const opts: G1Options = {
  repoRoot,
  buildingosDir,
  knowledgeDir,
  goldenDir,
  assets: (skill, rel) => readFile(path.join(repoRoot, 'examples', 'skills', skill, rel), 'utf8').catch(() => undefined),
};

const results = await runConformance(opts);
let failed = 0;
for (const r of results) {
  const isSkipped = 'skipped' in r && r.skipped;
  const status = isSkipped ? 'SKIP' : r.passed ? 'PASS' : 'FAIL';
  if (!isSkipped && !r.passed) failed += 1;
  console.log(`[${status}] ${r.task} (${'engine' in r ? r.engine : '—'})`);
  if ('details' in r) for (const d of r.details) console.log(`      ${d}`);
  if ('acceptanceCriteria' in r) for (const c of r.acceptanceCriteria) console.log(`      criterion: ${c}`);
}
console.log(failed === 0 ? 'conformance: OK (G2–G4 engine-gated, skipped)' : `conformance: FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
