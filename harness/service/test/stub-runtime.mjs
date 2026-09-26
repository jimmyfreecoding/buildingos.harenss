// 桩运行时：模拟 @deepseek-ai/dsh-sdk-jsonrpc-server 的**真实**协议（P4-04 用例用，不需要 DSH 与模型密钥）。
//   initialize({ provider, model, cwd, reasoningEffort? }) → { serverInfo: { name: 'deepseek-harness-sdk-runtime' } }
//   session/prompt({ sessionId, contentBlocks }) → { messageId }，期间发 session.event / session.status 通知
//   shutdown → { ok: true } 并退出
// 它会把 secrets 文件里的 token 念出来一次，用例据此证明 token 写进了这个进程专用的文件。
import { readFileSync } from 'node:fs';
let buf = '';
const out = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const notify = (method, params) => out({ jsonrpc: '2.0', method, params });
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.method === 'initialize') {
      const a = msg.params || {};
      if (!a.provider || !a.model || !a.cwd) {
        out({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'initialize 需要 provider / model / cwd' } });
        continue;
      }
      const token = (() => { try { return readFileSync(process.env.IOC_MCP_TOKEN_FILE, 'utf8'); } catch { return null; } })();
      out({ jsonrpc: '2.0', id: msg.id, result: { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: 'stub', provider: a.provider, model: a.model, cwd: a.cwd }, tokenSeen: token, tokenFile: process.env.IOC_MCP_TOKEN_FILE ?? null, mcpUrl: process.env.IOC_MCP_URL ?? null } });
    } else if (msg.method === 'session/prompt') {
      const sid = msg.params?.sessionId;
      const text = (msg.params?.contentBlocks || []).map((b) => b?.text || '').join(' ').trim();
      notify('session.event', { sessionId: sid, event: { type: 'message', text: '收到：' + text } });
      notify('session.event', { sessionId: sid, event: { type: 'tool_result', tool: 'mcp__ioc__write_block', ok: true } });
      out({ jsonrpc: '2.0', id: msg.id, result: { messageId: 'm_' + Date.now() } });
      notify('session.status', { sessionId: sid, status: 'idle' });
    } else if (msg.method === 'shutdown') {
      out({ jsonrpc: '2.0', id: msg.id, result: { ok: true } });
      process.exit(0);
    } else {
      out({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'unknown method ' + msg.method } });
    }
  }
});
