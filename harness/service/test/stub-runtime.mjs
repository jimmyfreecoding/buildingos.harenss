// 桩运行时：模拟 DSH SDK 运行时的三个方法（initialize / session/prompt / shutdown）与两种通知，
// 只用于 gateway 的用例（不需要真的 DSH、模型密钥）。它会把 secrets 文件里的 token 念出来一次，
// 这样用例能证明「token 写进了这个进程专用的文件」。
import { readFileSync } from 'node:fs';
let buf = '';
const out = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.method === 'initialize') {
      const token = (() => { try { return readFileSync(process.env.IOC_MCP_TOKEN_FILE, 'utf8'); } catch { return null; } })();
      out({ jsonrpc: '2.0', id: msg.id, result: { ok: true, mcpUrl: process.env.IOC_MCP_URL || null, tokenFile: process.env.IOC_MCP_TOKEN_FILE, tokenSeen: token } });
    } else if (msg.method === 'session/prompt') {
      out({ jsonrpc: '2.0', method: 'session.event', params: { event: 'message', text: '收到：' + msg.params.text } });
      out({ jsonrpc: '2.0', method: 'session.event', params: { event: 'tool_result', tool: 'mcp__ioc__write_block', ok: true } });
      out({ jsonrpc: '2.0', id: msg.id, result: { text: '答复' } });
      out({ jsonrpc: '2.0', method: 'session.status', params: { status: 'idle' } });
    } else if (msg.method === 'shutdown') {
      out({ jsonrpc: '2.0', id: msg.id, result: { ok: true } });
      process.exit(0);
    } else {
      out({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'unknown method ' + msg.method } });
    }
  }
});
