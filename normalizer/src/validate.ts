/**
 * Structural output gate (pipeline stage 2 exit): verifies the assembled TenantDocs
 * against the adapter-contract/v1 shape. Code-level checks for M1; ajv wiring
 * against schemas/contract/adapter-contract.schema.json lands with packaging (M1.5).
 */
import type { TenantDocs } from './types.js';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export function validateTenantDocs(docs: TenantDocs): string[] {
  const errors: string[] = [];

  for (const s of docs.skills) {
    if (!KEBAB.test(s.name) || s.name.length > 64) errors.push(`skill "${s.name}": name must be kebab-case, ≤64`);
    if (!s.description) errors.push(`skill "${s.name}": description is required`);
    if (typeof s.invocation?.model !== 'boolean') errors.push(`skill "${s.name}": invocation.model must be boolean`);
    if (typeof s.invocation?.user !== 'boolean') errors.push(`skill "${s.name}": invocation.user must be boolean`);
    if (typeof s.invocation?.implicit !== 'boolean') errors.push(`skill "${s.name}": invocation.implicit must be boolean`);
  }

  for (const r of docs.rules) {
    if (!KEBAB.test(r.id) || r.id.length > 64) errors.push(`rule "${r.id}": id must be kebab-case, ≤64`);
    if (!['all', 'tools', 'session', 'surface'].includes(r.scope)) errors.push(`rule "${r.id}": invalid scope`);
    if (!['hard', 'soft'].includes(r.enforce)) errors.push(`rule "${r.id}": invalid enforce`);
    if (r.enforce === 'hard' && !r.permission) errors.push(`rule "${r.id}": enforce=hard requires permission (D6)`);
    if (r.enforce === 'hard' && r.permission && !['allow', 'deny'].includes(r.permission.effect)) {
      errors.push(`rule "${r.id}": permission.effect must be allow|deny`);
    }
  }

  for (const p of docs.prompts) {
    if (!KEBAB.test(p.id) || p.id.length > 64) errors.push(`prompt "${p.id}": id must be kebab-case, ≤64`);
    if (!LANG.test(p.language)) errors.push(`prompt "${p.id}": invalid language tag "${p.language}"`);
  }

  const c = docs.config;
  if (!['dsh', 'codex'].includes(c.engine)) errors.push('config: engine must be dsh|codex');
  if (!['read-only', 'workspace-write', 'danger-full-access'].includes(c.sandbox)) errors.push('config: invalid sandbox');
  if (!['never', 'on-request', 'unless-trusted'].includes(c.approval)) errors.push('config: invalid approval');
  const names = new Set<string>();
  for (const m of c.mcpServers) {
    if (!KEBAB.test(m.name)) errors.push(`config: mcp_servers name "${m.name}" must be kebab-case`);
    if (names.has(m.name)) errors.push(`config: duplicate mcp_servers name "${m.name}"`);
    names.add(m.name);
    if (!['stdio', 'http'].includes(m.transport)) errors.push(`config: mcp_servers "${m.name}" invalid transport`);
  }

  return errors;
}
