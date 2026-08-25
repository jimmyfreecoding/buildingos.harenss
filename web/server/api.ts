/**
 * BuildingOS web console API (server routes).
 *
 *   GET  /api/health
 *   GET  /api/workspaces/recents          recent workspaces
 *   POST /api/workspaces/select           { path } → remember + return info
 *   POST /api/workspaces/scan             { baseDir, depth? } → found workspaces
 *   GET  /api/workspace/tree              ?path= → document tree (.buildingos + knowledge)
 *   GET  /api/workspace/file              ?path=&file= → file content (within workspace)
 *   POST /api/workspace/file              { workspace, file, content } → write
 *   POST /api/wizard                      { dir, language, engine, model, customModel?, modelToken, gitToken? }
 *   POST /api/validate                    { workspace }
 *   POST /api/compile                     { workspace, engine, out? }
 *   POST /api/conformance                 { workspace }
 *   GET  /api/dev/status                  ?workspace=
 *   POST /api/dev/up                      { workspace, detached?, pgPort? }
 *   POST /api/dev/down                    { workspace, volumes? }
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runWizardFromAnswers } from '@buildingos/bootstrap';
import { codexAdapter } from '@buildingos/adapter-codex';
import { dshAdapter } from '@buildingos/adapter-dsh';
import { runConformance } from '@buildingos/conformance';
import { loadTenantDocs } from '@buildingos/normalizer';
import {
  isWorkspace,
  listRecents,
  rememberWorkspace,
  scanForWorkspaces,
  workspaceName,
} from './workspaces.js';
import { devDown, devStatus, devUp } from './dev.js';

export function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Document tree: .buildingos/** (minus configs secrets) + knowledge/**. */
async function docTree(workspace: string): Promise<Array<{ path: string; isDir: boolean; size?: number }>> {
  const roots = ['.buildingos', 'knowledge'];
  const out: Array<{ path: string; isDir: boolean; size?: number }> = [];
  for (const root of roots) {
    const base = path.join(workspace, root);
    if (!existsSync(base)) continue;
    const walk = async (dir: string, rel: string) => {
      const entries = await readdir(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        const relPath = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          out.push({ path: relPath, isDir: true });
          await walk(full, relPath);
        } else {
          const st = await stat(full);
          out.push({ path: relPath, isDir: false, size: st.size });
        }
      }
    };
    await walk(base, root);
  }
  return out;
}

function filePathWithin(workspace: string, file: string): string {
  const resolved = path.resolve(workspace, file);
  const base = path.resolve(workspace);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`path escapes workspace: ${file}`);
  }
  return resolved;
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const p = url.pathname;
  const body = await readBody(req);

  try {
    // ---- workspaces ------------------------------------------------------
    if (p === '/api/health') {
      return json(res, 200, { ok: true, version: '0.1.0' });
    }
    if (p === '/api/workspaces/recents' && req.method === 'GET') {
      return json(res, 200, { recents: listRecents() });
    }
    if (p === '/api/workspaces/select' && req.method === 'POST') {
      const dir = path.resolve(str(body.path));
      if (!isWorkspace(dir)) {
        return json(res, 400, { error: `not a BuildingOS workspace (no .buildingos/): ${dir}` });
      }
      rememberWorkspace(dir);
      return json(res, 200, { path: dir, name: workspaceName(dir) });
    }
    if (p === '/api/workspaces/scan' && req.method === 'POST') {
      const baseDir = path.resolve(str(body.baseDir) || process.cwd());
      const depth = typeof body.depth === 'number' ? body.depth : 1;
      if (!existsSync(baseDir)) return json(res, 400, { error: `no such dir: ${baseDir}` });
      return json(res, 200, { baseDir, workspaces: scanForWorkspaces(baseDir, depth) });
    }

    // ---- workspace documents --------------------------------------------
    if (p === '/api/workspace/tree' && req.method === 'GET') {
      const workspace = path.resolve(str(url.searchParams.get('path')));
      if (!isWorkspace(workspace)) return json(res, 400, { error: 'not a workspace' });
      return json(res, 200, { workspace, tree: await docTree(workspace) });
    }
    if (p === '/api/workspace/file' && req.method === 'GET') {
      const workspace = path.resolve(str(url.searchParams.get('path')));
      const file = str(url.searchParams.get('file'));
      if (!file) return json(res, 400, { error: 'file is required' });
      try {
        const full = filePathWithin(workspace, file);
        const content = await readFile(full, 'utf8');
        return json(res, 200, { file, content });
      } catch (err) {
        return json(res, 404, { error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (p === '/api/workspace/file' && req.method === 'POST') {
      const workspace = path.resolve(str(body.workspace));
      const file = str(body.file);
      const content = str(body.content);
      if (!file) return json(res, 400, { error: 'file is required' });
      try {
        const full = filePathWithin(workspace, file);
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, content, 'utf8');
        return json(res, 200, { ok: true, file });
      } catch (err) {
        return json(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ---- wizard -----------------------------------------------------------
    if (p === '/api/wizard' && req.method === 'POST') {
      const dir = path.resolve(str(body.dir));
      const r = await runWizardFromAnswers(dir, {
        language: str(body.language) === 'en' ? 'en' : 'zh',
        engine: str(body.engine) === 'codex' ? 'codex' : 'dsh',
        model: str(body.model) || 'gpt-4o',
        customModel: str(body.customModel) || undefined,
        modelToken: str(body.modelToken),
        gitToken: str(body.gitToken) || undefined,
      });
      return json(res, r.ok ? 200 : 422, { ok: r.ok, language: r.language, engine: r.engine, model: r.model });
    }

    // ---- pipeline ----------------------------------------------------------
    if (p === '/api/validate' && req.method === 'POST') {
      const workspace = path.resolve(str(body.workspace));
      const { diagnostics, ok } = await loadTenantDocs({ repoRoot: workspace });
      return json(res, 200, { ok, diagnostics });
    }
    if (p === '/api/compile' && req.method === 'POST') {
      const workspace = path.resolve(str(body.workspace));
      const engine = str(body.engine);
      if (engine !== 'dsh' && engine !== 'codex') return json(res, 400, { error: 'engine must be dsh|codex' });
      const buildingosDir = path.join(workspace, '.buildingos');
      const { docs, ok } = await loadTenantDocs({ repoRoot: workspace, buildingosDir });
      if (!ok) return json(res, 422, { error: 'tenant failed validation; fix before compiling' });
      const adapter = engine === 'dsh' ? dshAdapter : codexAdapter;
      const assets = (skill: string, rel: string) => {
        try {
          return readFileSync(path.join(buildingosDir, 'skills', skill, rel), 'utf8');
        } catch {
          return undefined;
        }
      };
      const view = adapter.compile(docs, { assets });
      const outDir = path.join(workspace, 'engine-views', engine);
      const written: string[] = [];
      for (const f of view.files) {
        const full = path.join(outDir, ...f.path.split('/'));
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, f.content, 'utf8');
        written.push(f.path);
      }
      return json(res, 200, { engine, files: written, outDir });
    }
    if (p === '/api/conformance' && req.method === 'POST') {
      const workspace = path.resolve(str(body.workspace));
      const repoRoot = workspace;
      const goldenDir = path.join(repoRoot, 'engine-views');
      if (!existsSync(goldenDir)) {
        return json(res, 200, { results: [], baseline: false, note: 'no golden baseline (engine-views/) — compile first' });
      }
      const results = await runConformance({
        repoRoot,
        buildingosDir: path.join(repoRoot, '.buildingos'),
        knowledgeDir: path.join(repoRoot, 'knowledge'),
        goldenDir,
        assets: (skill: string, rel: string) => {
          try {
            return readFileSync(path.join(repoRoot, '.buildingos', 'skills', skill, rel), 'utf8');
          } catch {
            return undefined;
          }
        },
      });
      return json(res, 200, { results, baseline: true });
    }

    // ---- dev environment -----------------------------------------------------
    if (p === '/api/dev/status' && req.method === 'GET') {
      const workspace = path.resolve(str(url.searchParams.get('workspace')));
      if (!isWorkspace(workspace)) return json(res, 400, { error: 'not a workspace' });
      return json(res, 200, await devStatus(workspace));
    }
    if (p === '/api/dev/up' && req.method === 'POST') {
      const workspace = path.resolve(str(body.workspace));
      const r = await devUp(workspace, {
        detached: body.detached !== false,
        pgPort: str(body.pgPort) || undefined,
      });
      return json(res, r.ok ? 200 : 500, r);
    }
    if (p === '/api/dev/down' && req.method === 'POST') {
      const workspace = path.resolve(str(body.workspace));
      const r = await devDown(workspace, { volumes: body.volumes === true });
      return json(res, r.ok ? 200 : 500, r);
    }

    return json(res, 404, { error: `no such api: ${p}` });
  } catch (err) {
    return json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
