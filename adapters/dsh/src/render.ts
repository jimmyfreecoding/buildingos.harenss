/**
 * DSH view rendering (adapter-contract §4 mapping tables).
 * The rendered files are the DSH engine view: .dsh/skills bundles (SKILL.md with
 * DSH frontmatter incl. the metadata.x-buildingos lossless-carry namespace, D2/D4/D19)
 * plus an intermediate system-prompt-sections document (rules + persona; wired into
 * cordis.yml at engine integration, calibration point C3).
 */
import { stringify as stringifyYaml } from 'yaml';
import type { GeneratedFile, SkillDoc, TenantDocs } from '@buildingos/normalizer';

/** kebab-case ui block (the lossless-carry shape, D4). */
function kebabUi(ui: NonNullable<SkillDoc['ui']>): Record<string, unknown> {
  return {
    ...(ui.displayName ? { 'display-name': ui.displayName } : {}),
    ...(ui.shortDescription ? { 'short-description': ui.shortDescription } : {}),
    ...(ui.iconSmall ? { 'icon-small': ui.iconSmall } : {}),
    ...(ui.iconLarge ? { 'icon-large': ui.iconLarge } : {}),
    ...(ui.brandColor ? { 'brand-color': ui.brandColor } : {}),
    ...(ui.defaultPrompt ? { 'default-prompt': ui.defaultPrompt } : {}),
  };
}

/** DSH SKILL.md frontmatter (key order matters for golden-output parity). */
function renderSkillFrontmatter(s: SkillDoc): Record<string, unknown> {
  const metadata: Record<string, unknown> = { ...s.metadata };
  const xBuildingos: Record<string, unknown> = {};
  if (s.ui && Object.keys(s.ui).some((k) => s.ui![k as keyof typeof s.ui])) {
    xBuildingos['ui'] = kebabUi(s.ui);
  }
  if (!s.invocation.implicit) {
    xBuildingos['invocation-implicit'] = false;
  }
  if (Object.keys(xBuildingos).length > 0) {
    metadata['x-buildingos'] = xBuildingos;
  }
  const fm: Record<string, unknown> = { name: s.name, description: s.description };
  if (s.whenToUse) fm['whenToUse'] = s.whenToUse;
  if (Object.keys(metadata).length > 0) fm['metadata'] = metadata;
  if (!s.invocation.model) fm['disable-model-invocation'] = true;
  if (!s.invocation.user) fm['user-invocable'] = false;
  return fm;
}

function renderSkillFile(s: SkillDoc, assets?: (rel: string) => string | undefined): GeneratedFile[] {
  const base = `.dsh/skills/${s.name}`;
  const fm = renderSkillFrontmatter(s);
  const files: GeneratedFile[] = [
    { path: `${base}/SKILL.md`, content: `---\n${stringifyYaml(fm)}---\n${s.body}`, kind: 'skill' },
  ];
  for (const ref of s.references) {
    const content = assets?.(ref);
    if (content !== undefined) files.push({ path: `${base}/${ref}`, content, kind: 'skill' });
  }
  for (const script of s.scripts) {
    const content = assets?.(script);
    if (content !== undefined) files.push({ path: `${base}/${script}`, content, kind: 'skill' });
  }
  return files;
}

/** Intermediate representation of rules + persona as DSH system-prompt sections (C3 calibration pending). */
function renderSystemPromptSections(docs: TenantDocs): string {
  const lines: string[] = [
    '# DSH system-prompt sections (compiled view)',
    '',
    '> Intermediate representation: rules/ + prompts/ compiled per the mapping tables. Wired into',
    '> cordis.yml system-prompt assembly at engine integration (calibration point C3).',
    '',
  ];
  const orderedPrompts = [...docs.prompts].filter((p) => p.enabled).sort((a, b) => a.order - b.order);
  const orderedRules = [...docs.rules].filter((r) => r.enabled).sort((a, b) => a.order - b.order);
  for (const p of orderedPrompts) {
    lines.push(`## persona:${p.id} (order ${p.order}, from prompts)`, '', p.body, '');
  }
  for (const r of orderedRules) {
    const body = r.sections.map((s) => s.body).join('\n\n');
    const perm = r.permission ? `\n(Derived permission: \`${r.permission.effect} ${r.permission.resource}\` — see the configs view permissions note)` : '';
    lines.push(`## rules:${r.id} (order ${r.order}, ${r.enforce})`, '', body, perm, '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function renderDshView(docs: TenantDocs, assets?: (skill: string, rel: string) => string | undefined): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  for (const s of docs.skills) {
    files.push(...renderSkillFile(s, (rel) => assets?.(s.name, rel)));
  }
  files.push({ path: 'generated/system-prompt-sections.md', content: renderSystemPromptSections(docs), kind: 'rule' });
  return files;
}
