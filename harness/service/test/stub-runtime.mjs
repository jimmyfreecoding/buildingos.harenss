// 桩运行时：模拟 @deepseek-ai/dsh-sdk-jsonrpc-server 的**真实**协议（P4-04 用例用，不需要 DSH 与模型密钥）。
//   initialize({ provider, model, cwd, reasoningEffort? }) → { serverInfo: { name: 'deepseek-harness-sdk-runtime' } }
//   session/prompt({ sessionId, contentBlocks }) → { messageId }，期间发 session.event / session.status 通知
//   shutdown → { ok: true } 并退出
// 它会把 secrets 文件里的 token 念出来一次，用例据此证明 token 写进了这个进程专用的文件。
import { readFileSync } from 'node:fs';

/** 用会话 token 经 MCP 真写一个块（浏览器/集成用例要靠它让草稿真的变） */
async function mcpWrite() {
  // 只在显式打开时才真去写（gateway 用例不需要，免得每次 prompt 都等不可达的 MCP 超时）
  if (process.env.STUB_MCP_WRITE !== '1') return { ok: true, detail: '未打开 STUB_MCP_WRITE，跳过真实写入' };
  const url = process.env.IOC_MCP_URL;
  const token = (() => { try { return readFileSync(process.env.IOC_MCP_TOKEN_FILE, 'utf8').trim(); } catch { return ''; } })();
  if (!url || !token) return { ok: false, detail: '没有 IOC_MCP_URL 或 token（跳过）' };
  const call = async (method, params) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };
  await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'stub-runtime' } });
  const out = await call('tools/call', { name: 'write_block', arguments: { id: 'stub-note', html: '<div class="ioc-panel">桩运行时经 MCP 写入</div>' } });
  return { ok: out.status < 300 && !out.data?.result?.isError, detail: out.status + ' ' + JSON.stringify(out.data).slice(0, 200) };
}
let buf = '';
const out = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const notify = (method, params) => out({ jsonrpc: '2.0', method, params });
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
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
      // 真去调一次 ioc 的 MCP（写草稿）；失败也照常回，不打断协议
      let write = { ok: false, detail: '未尝试' };
      try { write = await Promise.race([mcpWrite(), new Promise((r) => setTimeout(() => r({ ok: false, detail: '超时' }), 8000))]); }
      catch (e) { write = { ok: false, detail: String(e?.message || e) }; }
      notify('session.event', { sessionId: sid, event: { type: 'tool_result', tool: 'mcp__ioc__write_block', ok: write.ok, detail: write.detail } });
      out({ jsonrpc: '2.0', id: msg.id, result: { messageId: 'm_' + Date.now() } });
      // 真实运行时的顺序：先回 messageId，之后才把「一轮结束」当事件发出来
      notify('session.event', { sessionId: sid, event: { type: 'turn/end', seq: 2, data: { turn: 1, reason: { kind: 'completed' } } } });
      notify('session.status', { sessionId: sid, status: 'idle' });
    } else if (msg.method === 'shutdown') {
      out({ jsonrpc: '2.0', id: msg.id, result: { ok: true } });
      process.exit(0);
    } else {
      out({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'unknown method ' + msg.method } });
    }
  }
});
