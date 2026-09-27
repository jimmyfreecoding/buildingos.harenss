// V0-4 假的 DeepSeek（OpenAI 兼容）接口：第一轮让模型调用 mcp__ioc__write_block，第二轮给出最终回答。
// 用来在没有真实模型密钥的情况下验证 DSH 会话、工具调用、事件流这条管道。
import http from 'node:http'; import fs from 'node:fs';
const log = e => fs.appendFileSync('llm.log', JSON.stringify(e) + '\n');
let slow = false;
http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  let j = {}; try { j = JSON.parse(body); } catch {}
  const msgs = j.messages || [];
  const toolNames = (j.tools || []).map(t => t.function?.name);
  const lastUser = { content: msgs.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n') };
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content);
  const hasToolResult = msgs.some(m => m.role === 'tool');
  log({ url: req.url, stream: j.stream, model: j.model, nMsgs: msgs.length, toolNames, hasToolResult, userText: userText?.slice(0, 120) });
  if (req.url.includes('models')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: 'deepseek-flash' }] })); }
  const wantsSlow = /慢/.test(userText || '');
  let msg;
  if (!hasToolResult && toolNames.includes('mcp__ioc__write_block') && /写/.test(userText || '')) {
    msg = { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'mcp__ioc__write_block', arguments: JSON.stringify({ blockId: 'kpi', html: '<div class="ioc-panel">今日能耗 <span data-bind="main.energy.today"></span></div>' }) } }] };
  } else {
    msg = { role: 'assistant', content: hasToolResult ? '已把 KPI 块写入草稿。' : '你好，我是 ioc 设计助手。' };
  }
  if (wantsSlow) await new Promise(r => setTimeout(r, 15000));
  const base = { id: 'x', object: 'chat.completion', created: 0, model: j.model || 'deepseek-flash' };
  if (!j.stream) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ...base, choices: [{ index: 0, message: msg, finish_reason: msg.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })); }
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = d => res.write('data: ' + JSON.stringify({ ...base, object: 'chat.completion.chunk', ...d }) + '\n\n');
  if (msg.tool_calls) send({ choices: [{ index: 0, delta: { role: 'assistant', tool_calls: msg.tool_calls.map((c, i) => ({ index: i, ...c })) }, finish_reason: null }] });
  else send({ choices: [{ index: 0, delta: { role: 'assistant', content: msg.content }, finish_reason: null }] });
  send({ choices: [{ index: 0, delta: {}, finish_reason: msg.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  res.write('data: [DONE]\n\n'); res.end();
}).listen(3941, () => console.log('llm on 3941'));
