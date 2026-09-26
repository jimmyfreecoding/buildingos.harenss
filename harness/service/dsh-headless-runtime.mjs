// DSH 运行时适配器（harness/service/）：把 gateway 的会话协议翻成 CLI 的 headless 一次性任务。
//
// 为什么需要它：CONTRACTS C4 设想的是 V0-4 那个**预编译 SDK 运行时**（pip 包的 stdio JSON-RPC）。
// 本机的 DSH 是**源码构建的镜像**（netops-infra-harness:latest，node 22 + dsh CLI），里面没有那个二进制，
// 但 CLI 有 headless profile：一次任务、把推理流写 stderr、把最终答复写 stdout、然后退出。
// 本适配器就把它包成 gateway 认得的那三个方法：
//   initialize     → 回 ok（顺带报出 profile 与 patch）
//   session/prompt → 起一次 `dsh <args...> "<任务>"`，stdout 逐行发 session.event(message)，stderr 发 session.event(log)
//   shutdown       → 退出
//
// **与 C4 的偏差（必须在文档里记着）**：headless 没有细粒度事件流，所以模型的
// tool_call / tool_result 不会逐条出来，只能看到 log 与最终答复。要恢复细粒度事件，需要
// SDK 运行时（pip 包）或 DSH 上游补一个 stdio 事件协议。取消仍然靠结束进程。
//
// 用法（gateway 侧）：DSH_CMD=node DSH_ARGS="<本文件> --profile headless --patch /opt/ioc/profile/cordis.patch.yml"
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const dshCmd = process.env.DSH_BIN || 'dsh';
// DSH_BIN_ARGS：调试/用例时把真实 dsh 换成别的可执行脚本（例如桩）
const dshPrefix = process.env.DSH_BIN_ARGS ? process.env.DSH_BIN_ARGS.split(' ').filter(Boolean) : [];
let buf = '';
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const emit = (event, params) => send({ jsonrpc: '2.0', method: 'session.event', params: { event, ...params } });

function runTask(text) {
  return new Promise((resolve, reject) => {
    const child = spawn(dshCmd, [...dshPrefix, ...argv, text], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let last = '';
    let rest = '';
    const linesOut = (chunk, kind) => {
      rest += chunk;
      for (let i = rest.indexOf('\n'); i >= 0; i = rest.indexOf('\n')) {
        const line = rest.slice(0, i).trim();
        rest = rest.slice(i + 1);
        if (!line) continue;
        emit(kind, { text: line.slice(0, 2000) });
        if (kind === 'message') last = line;
      }
    };
    child.stdout.on('data', (c) => linesOut(String(c), 'message'));
    child.stderr.on('data', (c) => linesOut(String(c), 'log'));
    child.on('error', reject);
    child.on('close', (code) => {
      const tail = rest.trim();
      if (tail) { emit('message', { text: tail }); last = tail; }
      code === 0 ? resolve({ text: last }) : reject(new Error('dsh 退出码 ' + code));
    });
  });
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buf += chunk;
  for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.method === 'initialize') {
      send({ jsonrpc: '2.0', id: msg.id, result: { ok: true, runtime: 'dsh-headless', args: argv, mcpUrl: process.env.IOC_MCP_URL || null, tokenFile: process.env.IOC_MCP_TOKEN_FILE || null } });
    } else if (msg.method === 'session/prompt') {
      const text = String(msg.params?.text || '');
      try {
        const out = await runTask(text);
        send({ jsonrpc: '2.0', id: msg.id, result: out });
      } catch (e) {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(e?.message || e) } });
      }
    } else if (msg.method === 'shutdown') {
      send({ jsonrpc: '2.0', id: msg.id, result: { ok: true } });
      process.exit(0);
    } else {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'unknown method ' + msg.method } });
    }
  }
});
