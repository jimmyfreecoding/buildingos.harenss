/**
 * BuildingOS web console server — the interaction surface (product decision: web over CLI).
 *
 *   GET  /                     the console SPA
 *   POST /api/wizard           { dir, language, engine, model, customModel?, modelToken, gitToken? }
 *   POST /api/validate         { workspace }
 *   POST /api/compile          { workspace, engine: dsh|codex }
 *   POST /api/conformance      { workspace }
 *
 * A local dev tool: binds 127.0.0.1 and accepts explicit workspace paths.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWizardFromAnswers } from '@buildingos/bootstrap';
import { codexAdapter } from '@buildingos/adapter-codex';
import { dshAdapter } from '@buildingos/adapter-dsh';
import { runConformance } from '@buildingos/conformance';
import { loadTenantDocs } from '@buildingos/normalizer';

const HTML_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.html');

function json(res: ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function assetsResolver(buildingosDir: string) {
  return (skill: string, rel: string) => {
    try {
      return readFileSync(path.join(buildingosDir, 'skills', skill, rel), 'utf8');
    } catch {
      return undefined;
    }
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const body = (await readBody(req)) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const strOpt = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);

  switch (url.pathname) {
    case '/api/wizard': {
      const r = await runWizardFromAnswers(path.resolve(str(body.dir)), {
        language: (str(body.language) === 'en' ? 'en' : 'zh'),
        engine: (str(body.engine) === 'codex' ? 'codex' : 'dsh'),
        model: str(body.model) || 'gpt-4o',
        customModel: strOpt(body.customModel),
        modelToken: str(body.modelToken),
        gitToken: strOpt(body.gitToken),
      });
      json(res, 200, r);
      return;
    }
    case '/api/validate': {
      const { diagnostics, ok } = await loadTenantDocs({ repoRoot: path.resolve(str(body.workspace)) });
      json(res, 200, { ok, diagnostics });
      return;
    }
    case '/api/compile': {
      const engine = str(body.engine);
      if (engine !== 'dsh' && engine !== 'codex') {
        json(res, 400, { ok: false, error: 'engine must be dsh|codex' });
        return;
      }
      const workspace = path.resolve(str(body.workspace));
      const buildingosDir = path.join(workspace, '.buildingos');
      const { docs, ok } = await loadTenantDocs({ repoRoot: workspace, buildingosDir });
      if (!ok) {
        json(res, 200, { ok: false, error: 'tenant validation failed — run validate first' });
        return;
      }
      const adapter = engine === 'dsh' ? dshAdapter : codexAdapter;
      const view = adapter.compile(docs, { assets: assetsResolver(buildingosDir) });
      // Materialize the engine view (like the CLI): conformance reads the golden baseline from disk.
      const outDir = path.join(workspace, 'engine-views', engine);
      for (const f of view.files) {
        const full = path.join(outDir, ...f.path.split('/'));
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, f.content, 'utf8');
      }
      json(res, 200, { ok: true, engine, files: view.files, outDir });
      return;
    }
    case '/api/conformance': {
      const workspace = path.resolve(str(body.workspace));
      const goldenDir = path.join(workspace, 'engine-views');
      if (!existsSync(goldenDir) || !statSync(goldenDir).isDirectory()) {
        json(res, 200, { ok: false, error: 'no golden baseline (engine-views/ missing) — compile both engines first' });
        return;
      }
      const buildingosDir = path.join(workspace, '.buildingos');
      const results = await runConformance({
        repoRoot: workspace,
        buildingosDir,
        knowledgeDir: path.join(workspace, 'knowledge'),
        goldenDir,
        assets: async (skill, rel) => {
          try {
            return await readFile(path.join(buildingosDir, 'skills', skill, rel), 'utf8');
          } catch {
            return undefined;
          }
        },
      });
      json(res, 200, { ok: true, results });
      return;
    }
    default:
      json(res, 404, { ok: false, error: `unknown api: ${url.pathname}` });
  }
}

export interface ServerOptions {
  port?: number;
  host?: string;
}

export async function startServer(opts: ServerOptions = {}): Promise<Server> {
  const html = await readFile(HTML_PATH, 'utf8');
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    json(res, 404, { ok: false, error: 'not found' });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 4173, opts.host ?? '127.0.0.1', resolve);
  });
  return server;
}
