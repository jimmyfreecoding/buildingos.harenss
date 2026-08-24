/**
 * The first-boot wizard (docs/runtime-bootstrap.md §2, M1.5):
 *
 *   step 0  select the wizard language (中文 / English)         ← the first question
 *   step 1  select the engine (dsh / codex)                     → runtime.yaml engine
 *   step 2  select the model (engine starter catalog or custom) → runtime.yaml model
 *   step 3  model credentials (MODEL_TOKEN)                     → .env (never Git, D21)
 *   step 4  git credentials (GIT_TOKEN, may skip)               → .env
 *   step 5  scaffold the tenant repository                      → .buildingos/ + knowledge/ + .gitignore
 *   step 6  validate (normalizer)                               → diagnostics
 *   step 7  summary + next steps
 *
 * Shared by the CLI (console IO) and the web console (request-driven IO):
 * single source of truth for the bootstrap experience.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { codexAdapter } from '@buildingos/adapter-codex';
import { dshAdapter } from '@buildingos/adapter-dsh';
import { loadTenantDocs } from '@buildingos/normalizer';
import { initTenant } from './init.js';
import type { Choice, WizardIO } from './io.js';

export type WizardLanguage = 'zh' | 'en';
export type EngineName = 'dsh' | 'codex';

export const ENGINE_CHOICES: Choice<EngineName>[] = [
  { value: 'dsh', label: 'DeepSeek Harness (DSH)' },
  { value: 'codex', label: 'OpenAI Codex harness' },
];

/** Starter model catalogs; engine-native catalogs (codex model/list) land with the run() bridge (R1). */
export const MODEL_CATALOG: Record<EngineName, Choice<string>[]> = {
  dsh: [
    { value: 'deepseek-chat', label: 'deepseek-chat' },
    { value: 'deepseek-reasoner', label: 'deepseek-reasoner' },
    { value: 'gpt-4o', label: 'gpt-4o' },
  ],
  codex: [
    { value: 'gpt-5.2-codex', label: 'gpt-5.2-codex' },
    { value: 'gpt-5.1-codex-max', label: 'gpt-5.1-codex-max' },
    { value: 'gpt-4o', label: 'gpt-4o' },
  ],
};

export interface L10n {
  step0: string;
  langZh: string;
  langEn: string;
  step1: string;
  engineQ: string;
  engineInfo: string;
  step2: string;
  modelQ: string;
  modelCustom: string;
  modelOther: string;
  step3: string;
  modelToken: string;
  step4: string;
  gitToken: string;
  gitSkipped: string;
  step5: string;
  scaffoldDone: string;
  step6: string;
  validateOk: string;
  validateFail: string;
  step7: string;
  nextSteps: string[];
  secretNote: string;
}

export const ZH: L10n = {
  step0: '请选择语言 / Select language:',
  langZh: '中文',
  langEn: 'English',
  step1: '第 1 步 / 4：选择引擎（可插拔，adapter 可用性见提示）',
  engineQ: '选择引擎：',
  engineInfo: '引擎适配器状态：',
  step2: '第 2 步 / 4：选择模型（内置起始目录，引擎原生目录待 run() 桥接入）',
  modelQ: '选择模型：',
  modelCustom: '其他（手动输入）',
  modelOther: '输入模型句柄：',
  step3: '第 3 步 / 4：配置模型凭证',
  modelToken: '模型 API token（写入 .env，绝不进 Git，D21）：',
  step4: '第 4 步 / 4：配置 Git 凭证',
  gitToken: 'Git token（写入 .env；留空跳过，可复用系统凭据）：',
  gitSkipped: 'Git 凭证：跳过（稍后可写入 .env 的 GIT_TOKEN）',
  step5: '第 5 步：脚手架租户仓库',
  scaffoldDone: '租户仓库已就绪：',
  step6: '第 6 步：校验（normalizer）',
  validateOk: '校验通过（OK）。',
  validateFail: '校验失败（存在 error，请先修复）。',
  step7: '第 7 步：进入 runtime（dev 模式）——runtime CLI 待 M1.5 交付；当前可用命令：',
  nextSteps: ['buildingos validate <dir>', 'buildingos compile --engine dsh|codex <dir>', 'buildingos conformance <dir>'],
  secretNote: '提示：token 仅写入租户目录下的 .env（已被 .gitignore 排除）；请妥善保管。',
};

export const EN: L10n = {
  step0: 'Select language:',
  langZh: 'Chinese',
  langEn: 'English',
  step1: 'Step 1 / 4: select the engine (pluggable; adapter availability below)',
  engineQ: 'Select the engine: ',
  engineInfo: 'Engine adapter status:',
  step2: 'Step 2 / 4: select the model (starter catalog; engine-native catalog lands with the run() bridge)',
  modelQ: 'Select the model: ',
  modelCustom: 'Other (enter manually)',
  modelOther: 'Model handle: ',
  step3: 'Step 3 / 4: model credentials',
  modelToken: 'Model API token (written to .env, never Git, D21): ',
  step4: 'Step 4 / 4: git credentials',
  gitToken: 'Git token (written to .env; leave empty to skip and reuse system credentials): ',
  gitSkipped: 'Git credentials: skipped (set GIT_TOKEN in .env later)',
  step5: 'Step 5: scaffold the tenant repository',
  scaffoldDone: 'Tenant repository ready:',
  step6: 'Step 6: validate (normalizer)',
  validateOk: 'Validation passed (OK).',
  validateFail: 'Validation failed (errors present; fix before proceeding).',
  step7: 'Step 7: enter runtime (dev mode) — the runtime CLI ships with M1.5; available commands now:',
  nextSteps: ['buildingos validate <dir>', 'buildingos compile --engine dsh|codex <dir>', 'buildingos conformance <dir>'],
  secretNote: 'Note: tokens are written only to .env in the tenant directory (gitignored); keep them safe.',
};

export interface WizardResult {
  ok: boolean;
  language: WizardLanguage;
  engine: EngineName;
  model: string;
  transcript: string[];
}

export async function runWizard(dir: string, io: WizardIO): Promise<Omit<WizardResult, 'transcript'>> {
  // step 0 — language first (per product decision: the very first question)
  const language = await io.choose<WizardLanguage>(ZH.step0, [
    { value: 'zh', label: ZH.langZh },
    { value: 'en', label: ZH.langEn },
  ], 'zh');
  const t = language === 'zh' ? ZH : EN;

  // step 1 — engine
  io.note(`\n${t.step1}`);
  const engine = await io.choose<EngineName>(t.engineQ, ENGINE_CHOICES, 'dsh');
  const adapter = engine === 'dsh' ? dshAdapter : codexAdapter;
  const status = adapter.status();
  io.note(`  ${t.engineInfo} ${status.healthy ? 'OK' : 'unhealthy'} (${status.capabilities?.join(', ')})`);

  // step 2 — model
  io.note(`\n${t.step2}`);
  const catalog = MODEL_CATALOG[engine];
  const modelOptions: Choice<string>[] = [...catalog, { value: '__custom__', label: t.modelCustom }];
  let model = await io.choose(t.modelQ, modelOptions);
  if (model === '__custom__') model = await io.secret(t.modelOther);

  // step 3 — model credentials
  io.note(`\n${t.step3}`);
  const modelToken = await io.secret(t.modelToken);

  // step 4 — git credentials (empty = skip)
  io.note(`\n${t.step4}`);
  const gitToken = await io.secret(t.gitToken);
  if (!gitToken) io.note(`  ${t.gitSkipped}`);

  // step 5 — scaffold + persist bootstrap choices (document config in Git; secrets in .env)
  io.note(`\n${t.step5}`);
  await mkdir(dir, { recursive: true });
  for (const f of await initTenant(dir)) io.note(`  + ${f}`);

  const cfgPath = path.join(dir, '.buildingos', 'configs', 'runtime.yaml');
  const cfg = await readFile(cfgPath, 'utf8');
  const cfgNext = cfg
    .replace(/^engine: .*$/m, `engine: ${engine}`)
    .replace(/^model: .*$/m, `model: ${model}`);
  await writeFile(cfgPath, cfgNext, 'utf8');

  const envPath = path.join(dir, '.env');
  await writeFile(envPath, `MODEL_TOKEN=${modelToken}\n${gitToken ? `GIT_TOKEN=${gitToken}` : '# GIT_TOKEN (skipped; reuse system credentials)'}\n`, 'utf8');
  await writeFile(path.join(dir, '.env.example'), 'MODEL_TOKEN=\nGIT_TOKEN=\n', 'utf8');
  io.note(`  ${t.scaffoldDone} ${dir}`);
  io.note(`  ${t.secretNote}`);

  // step 6 — validate
  io.note(`\n${t.step6}`);
  const { diagnostics, ok } = await loadTenantDocs({ repoRoot: dir });
  for (const d of diagnostics) {
    if (d.severity !== 'info') io.note(`  [${d.severity.toUpperCase()}] ${d.code} ${d.file ? `(${d.file})` : ''} ${d.message}`);
  }
  io.note(ok ? `  ${t.validateOk}` : `  ${t.validateFail}`);

  // step 7 — summary + next steps
  io.note(`\n${t.step7}`);
  for (const s of t.nextSteps) io.note(`  - ${s}`);

  return { ok, language, engine, model };
}

/** Non-interactive variant for the web console / automation: answers arrive as values. */
export interface WizardAnswers {
  language: WizardLanguage;
  engine: EngineName;
  model: string;
  customModel?: string;
  modelToken: string;
  gitToken?: string;
}

export async function runWizardFromAnswers(dir: string, a: WizardAnswers): Promise<WizardResult> {
  const transcript: string[] = [];
  const io: WizardIO = {
    async choose(_q, options) {
      const want = transcript.length === 0 ? a.language : transcript.length === 1 ? a.engine : a.model;
      const hit = options.find((o) => o.value === want);
      return hit ? hit.value : (options[0]?.value ?? '');
    },
    async secret() {
      const secrets = transcript.filter((l) => l.startsWith('secret')).length + 1;
      transcript.push('secret');
      if (a.model === '__custom__') {
        if (secrets === 1) return a.customModel ?? '';
        if (secrets === 2) return a.modelToken;
        return a.gitToken ?? '';
      }
      if (secrets === 1) return a.modelToken;
      return a.gitToken ?? '';
    },
    note(m) {
      transcript.push(m);
    },
  };
  const result = await runWizard(dir, io);
  return { ...result, transcript };
}
