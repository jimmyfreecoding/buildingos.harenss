/**
 * BuildingOS web console server — the interaction surface (DSH-GUI style).
 *
 * Serves the React SPA (built to dist/client by vite) plus the /api routes.
 * Local dev tool: binds 127.0.0.1 by default.
 *
 *   buildingos web [--port N] [--host 127.0.0.1]
 */
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
const CLIENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'client');
const INDEX_HTML = path.join(CLIENT_DIR, 'index.html');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface WebServerOptions {
  port: number;
  host: string;
  /** directory containing the built SPA (index.html + assets); defaults to dist/client */
  clientDir?: string;
}

export function startServer(opts: WebServerOptions): Server {
  const clientDir = opts.clientDir ?? CLIENT_DIR;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    // static SPA
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(clientDir, pathname);
    if (!full.startsWith(path.resolve(clientDir))) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (existsSync(full) && !full.endsWith('index.html')) {
      const ext = path.extname(full);
      res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' });
      res.end(readFileSync(full));
      return;
    }
    // SPA fallback: unknown routes serve index.html
    if (existsSync(INDEX_HTML) || existsSync(path.join(clientDir, 'index.html'))) {
      const html = existsSync(INDEX_HTML)
        ? readFileSync(INDEX_HTML)
        : readFileSync(path.join(clientDir, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`SPA not built yet — run pnpm --filter @buildingos/web build (clientDir=${clientDir})`);
  });

  server.listen(opts.port, opts.host);
  return server;
}

export async function main(argv: string[]): Promise<number> {
  const port = Number(argv[0] ?? process.env.PORT ?? 4399);
  const host = argv[1] ?? process.env.HOST ?? '127.0.0.1';
  const server = startServer({ port, host });
  const addr = server.address();
  const shown = typeof addr === 'object' && addr ? addr.port : port;
  console.log(`BuildingOS web console: http://${host}:${shown}  (Ctrl+C to stop)`);
  await new Promise<void>(() => {});
  return 0;
}

if (typeof process !== 'undefined' && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
