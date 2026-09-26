// harness-gateway 用例（P4-04）：会话创建 / 排队、消息与事件流（seq + since）、取消、capabilities。
// 用桩运行时（test/stub-runtime.mjs），不需要真的 DSH 与模型密钥。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGateway } from '../gateway.mjs';

const stub = pathToFileURL(path.join(import.meta.dirname, 'stub-runtime.mjs')).href;

/** 等到条件成立（子进程 spawn + initialize 的耗时不定，别用固定 sleep） */
async function until(fn, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return fn();
}

async function start(t, overrides = {}) {
  const gw = createGateway({
    dshCmd: process.execPath,
    dshArgs: ['--input-type=module', '-e', 'await import(process.env.STUB_URL)', ],
    secretsDir: mkdtempSync(path.join(os.tmpdir(), 'gw-')),
    mcpUrl: 'http://ioc:3040/ioc/mcp',
    maxSessions: 2,
    ...overrides,
  });
  // 环境变量走 STUB_URL 更省事：桩运行时用 import 加载
  gw.opts.dshArgs = ['--input-type=module', '-e', 'import(process.env.STUB_URL)'];
  process.env.STUB_URL = stub;
  await new Promise((r) => gw.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + gw.server.address().port;
  if (t) t.after(() => { gw.closeAll(); gw.server.close(); });
  const http = async (method, route, body) => {
    const res = await fetch(base + route, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };
  return { gw, base, http };
}

test('capabilities：暴露会话数、MCP 配置与运行时命令', async t => {
  const { http } = await start(t);
  const r = await http('GET', '/v1/capabilities');
  assert.equal(r.status, 200);
  assert.equal(r.data.mcp.configured, true);
  assert.equal(r.data.sessions.max, 2);
  assert.deepEqual(r.data.sessions, { running: 0, max: 2, queued: 0 });
  assert.equal(r.data.dsh.profile, 'sdk');
});

test('创建会话：缺 mcp.token 是 400；成功时 token 写进该进程专用的 secrets 文件', async t => {
  const { gw, http } = await start(t);
  assert.equal((await http('POST', '/v1/sessions', { domain: 'ioc' })).status, 400);
  assert.equal((await http('POST', '/v1/sessions', { domain: 'ioc', mcp: {} })).status, 400);
  const made = await http('POST', '/v1/sessions', { domain: 'ioc', auth_ctx: { project_id: 'p', draft_id: 'd1' }, mcp: { url: 'http://ioc:3040/ioc/mcp', token: 'tok-123' } });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  assert.match(made.data.session_id, /^ses_[0-9a-f]{16}$/);
  // 运行时（桩）自述它读到的 secrets 文件与 token：证明 token 真的写进了这个进程专用的文件
  const s = gw.sessions.get(made.data.session_id);
  await until(() => s.events.some((e) => e.type === 'ready'));
  const ready = s.events.find((e) => e.type === 'ready');
  assert.ok(ready, JSON.stringify(s.events));
  assert.equal(ready.result.tokenSeen, 'tok-123');
  assert.ok(ready.result.tokenFile.startsWith(s.opts.secretsDir), ready.result.tokenFile);
  assert.ok(s.events.some((e) => e.type === 'status'));
});

test('消息 + 事件流：事件带 seq，?since= 补发，一轮结束回到 idle', async t => {
  const { base, http } = await start(t);
  const made = await http('POST', '/v1/sessions', { domain: 'ioc', mcp: { token: 'tok' } });
  const id = made.data.session_id;
  const stream = await fetch(base + '/v1/sessions/' + id + '/stream');
  assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  const accepted = await http('POST', '/v1/sessions/' + id + '/messages', { text: '把标题改成仓库概览', page_context: { page: 'overview' } });
  assert.equal(accepted.status, 202);
  // 读事件流（读到 idle 为止）
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const deadline = Date.now() + 5000;
  // 订阅时会补发已有事件（含开会话时的 status idle），所以等到「一轮结束」turn/end 再停
  while (Date.now() < deadline && !/turn\/end/.test(text)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  const events = text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
  assert.ok(events.length >= 4, text);
  const seqs = events.map((e) => e.seq);
  assert.deepEqual([...seqs].sort((a, b) => a - b), seqs, 'seq 单调递增');
  assert.ok(events.some((e) => e.type === 'turn/start'));
  assert.ok(events.some((e) => e.type === 'message' && /收到/.test(e.text)));
  assert.ok(events.some((e) => e.type === 'tool_result' && e.tool === 'mcp__ioc__write_block'));
  assert.ok(events.some((e) => e.type === 'turn/end'));
  // since 补发：since 之后没有新事件时只有空流（会收到 SSE 的 ': ping' 注释，剥掉再看）
  const last = seqs[seqs.length - 1];
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 300);
  let t2 = '';
  try {
    const again = await fetch(base + '/v1/sessions/' + id + '/stream?since=' + last, { signal: ac.signal });
    const r2 = again.body.getReader();
    while (true) { const { value, done } = await r2.read(); if (done) break; t2 += decoder.decode(value, { stream: true }); }
  } catch { /* 300 ms 到点就断开 */ }
  clearTimeout(timer);
  assert.equal(t2.replace(/^: ping\s*$/gm, '').trim(), '', JSON.stringify(t2));
  // 反过来：since=0 会把之前的都补发回来
  const ac0 = new AbortController();
  const timer0 = setTimeout(() => ac0.abort(), 400);
  let t0 = '';
  try {
    const all = await fetch(base + '/v1/sessions/' + id + '/stream?since=0', { signal: ac0.signal });
    const r0 = all.body.getReader();
    while (true) { const { value, done } = await r0.read(); if (done) break; t0 += decoder.decode(value, { stream: true }); }
  } catch { /* 到点断开 */ }
  clearTimeout(timer0);
  const replayed = t0.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
  // 从 0 补发应包含我们已经看到的那一批（之后可能又来了 status 之类的新事件，所以用 >=）
  assert.ok(replayed.length >= seqs.length, 'since=0 应把已有事件全部补发：' + replayed.length + ' vs ' + seqs.length);
  assert.equal(replayed[0].seq, 1, '第一条事件的 seq 应为 1');
  assert.deepEqual([...replayed.map((e) => e.seq)].sort((a, b) => a - b), replayed.map((e) => e.seq), '补发的事件按 seq 升序');
});

test('取消会结束该会话的运行时进程；删除后接口 404', async t => {
  const { gw, http } = await start(t);
  const made = await http('POST', '/v1/sessions', { domain: 'ioc', mcp: { token: 'tok' } });
  const id = made.data.session_id;
  const cancelled = await http('POST', '/v1/sessions/' + id + '/cancel');
  assert.equal(cancelled.status, 202);
  await until(() => ['cancelled', 'stopped'].includes(gw.sessions.get(id).status));
  assert.ok(['cancelled', 'stopped'].includes(gw.sessions.get(id).status), gw.sessions.get(id).status);
  assert.equal((await http('POST', '/v1/sessions/' + id + '/messages', { text: 'x' })).status, 202, '取消后仍可发消息（会重新失败/记录），但状态是 cancelled');
  const gone = await http('DELETE', '/v1/sessions/' + id);
  assert.equal(gone.status, 200);
  assert.equal((await http('POST', '/v1/sessions/' + id + '/messages', { text: 'x' })).status, 404);
});

test('并发上限：满了先排队，取消后自动放行', async t => {
  const { gw, http } = await start(t, { maxSessions: 1 });
  const first = await http('POST', '/v1/sessions', { domain: 'ioc', mcp: { token: 'a' } });
  assert.equal(first.status, 201);
  let secondDone = false;
  const second = http('POST', '/v1/sessions', { domain: 'ioc', mcp: { token: 'b' } }).then((r) => { secondDone = true; return r; });
  await until(() => gw.queued() === 1);
  assert.equal(secondDone, false, '上限 1 时第二个会话应该排队');
  assert.equal((await http('GET', '/v1/capabilities')).data.sessions.queued, 1);
  await http('POST', '/v1/sessions/' + first.data.session_id + '/cancel');
  const done = await second;
  assert.equal(done.status, 201);
  assert.equal(gw.running(), 1);
});

test('不认识的接口 404', async t => {
  const { http } = await start(t);
  assert.equal((await http('GET', '/v1/nope')).status, 404);
  assert.equal((await http('POST', '/v1/sessions/zzz/messages', { text: 'x' })).status, 404);
});
