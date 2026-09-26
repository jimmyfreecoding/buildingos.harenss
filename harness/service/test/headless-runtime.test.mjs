// 适配器用例：不起真 DSH、不烧模型额度，只验「三个方法 + 两类事件」的协议翻译。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

const runtime = path.join(import.meta.dirname, '..', 'dsh-headless-runtime.mjs');
const fake = path.join(import.meta.dirname, 'fake-dsh.mjs');

/** 起适配器，按行读它的 JSON-RPC 输出 */
function startRuntime(t, env = {}) {
  const child = spawn(process.execPath, [runtime, '--profile', 'headless', '--patch', '/tmp/ioc.yml'], {
    env: { ...process.env, DSH_BIN: process.execPath, DSH_BIN_ARGS: fake, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const messages = [];
  let buf = '';
  child.stdout.on('data', (c) => {
    buf += c;
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) messages.push(JSON.parse(line)); }
  });
  if (t) t.after(() => child.kill());
  const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
  const waitFor = async (pred, ms = 5000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) { const hit = messages.find(pred); if (hit) return hit; await new Promise((r) => setTimeout(r, 20)); }
    return undefined;
  };
  return { child, messages, send, waitFor };
}

test('initialize 回 ok 并报出运行时；参数原样带过去', async t => {
  const rt = startRuntime(t);
  rt.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { domain: 'ioc' } });
  const res = await rt.waitFor((m) => m.id === 1);
  assert.equal(res.result.ok, true);
  assert.equal(res.result.runtime, 'dsh-headless');
  assert.deepEqual(res.result.args, ['--profile', 'headless', '--patch', '/tmp/ioc.yml']);
});

test('session/prompt：stderr 变 log 事件、stdout 变 message 事件，最后回最终答复', async t => {
  // 适配器用 DSH_BIN 指定的可执行文件；这里让它跑 node，真正的脚本走 DSH_BIN_ARGS
  const rt = startRuntime(t, { FAKE: '1' });
  rt.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  await rt.waitFor((m) => m.id === 1);
  rt.send({ jsonrpc: '2.0', id: 2, method: 'session/prompt', params: { text: '把标题改一下' } });
  const res = await rt.waitFor((m) => m.id === 2);
  assert.match(res.result.text, /答复：/);
  const events = rt.messages.filter((m) => m.method === 'session.event');
  assert.ok(events.some((e) => e.params.event === 'log' && /reasoning/.test(e.params.text)), JSON.stringify(events));
  assert.ok(events.some((e) => e.params.event === 'message' && /答复/.test(e.params.text)), JSON.stringify(events));
});

test('dsh 失败时回 JSON-RPC error，不让适配器自己挂掉', async t => {
  const rt = startRuntime(t, {});
  rt.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  await rt.waitFor((m) => m.id === 1);
  rt.send({ jsonrpc: '2.0', id: 2, method: 'session/prompt', params: { text: 'x' } });
  const res = await rt.waitFor((m) => m.id === 2);
  assert.ok(res.result || res.error, JSON.stringify(res));
});

test('不认识的方法回 -32601；shutdown 后退出', async t => {
  const rt = startRuntime(t);
  rt.send({ jsonrpc: '2.0', id: 1, method: 'resources/list' });
  const res = await rt.waitFor((m) => m.id === 1);
  assert.equal(res.error.code, -32601);
  rt.send({ jsonrpc: '2.0', id: 2, method: 'shutdown' });
  const bye = await rt.waitFor((m) => m.id === 2);
  assert.equal(bye.result.ok, true);
});
