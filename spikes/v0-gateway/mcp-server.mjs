// V0-4 模拟 apps/ioc 的 MCP 端点（Streamable HTTP，无状态模式）。
// 记录每次调用收到的请求头，用来判断 DSH 是否把会话标识传给 MCP server。
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import fs from 'node:fs';

const log = e => fs.appendFileSync('mcp.log', JSON.stringify({ t: Date.now(), ...e }) + '\n');
const TOKEN = 'svc-token-v0';
const drafts = {};

function build(ctx) {
  const s = new McpServer({ name: 'ioc', version: '0.0.1' });
  s.tool('write_block', '写一个 HTML 块到当前草稿', { blockId: z.string(), html: z.string(), draftToken: z.string().optional() },
    async ({ blockId, html, draftToken }, extra) => {
      log({ tool: 'write_block', blockId, draftToken, headers: ctx.headers, mcpSession: extra?.sessionId, meta: extra?._meta });
      if (/<script|on\w+=/i.test(html)) return { isError: true, content: [{ type: 'text', text: 'E_VALIDATION: 不允许 script 或 on* 属性' }] };
      drafts[blockId] = html;
      return { content: [{ type: 'text', text: `ok：已写入草稿 ${blockId}（${html.length} 字节）` }] };
    });
  s.tool('get_catalog', '读取可用组件目录', {}, async (_a, extra) => {
    log({ tool: 'get_catalog', headers: ctx.headers, meta: extra?._meta });
    return { content: [{ type: 'text', text: JSON.stringify({ blocks: ['metric', 'list'], tokens: ['--ioc-accent'] }) }] };
  });
  return s;
}

http.createServer(async (req, res) => {
  const headers = { ...req.headers };
  if (req.headers.authorization !== 'Bearer ' + TOKEN) { log({ rejected: true, headers }); res.writeHead(401); return res.end(); }
  let body = ''; for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : undefined;
  log({ rpc: json?.method, headers });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = build({ headers });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, json);
}).listen(3940, () => console.log('mcp on 3940'));
