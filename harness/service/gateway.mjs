// harness-gateway（P4-04）：调用方 ↔ harness，契约见 harenss docs/design/CONTRACTS.md C2 / C4。
//
// 零依赖（只用 node 内置模块）。每个 AI 会话起一个 DSH SDK 运行时子进程，JSON-RPC over stdio：
// 只用 initialize / session/prompt / shutdown 三个方法，通知是 session.event（带 seq）与 session.status。
// 会话 token 不由这里生成：调用方（apps/ioc）在 POST /projects/{p}/ai/sessions 里签发，gateway 把它
// 写进这个子进程专用的 secrets 文件（模型看不到），profile 的 mcp-client 启动时读取。
//
// 运行：DSH_CMD="<运行时可执行文件>" [DSH_PROFILE=sdk] [GATEWAY_PORT=8090] node harness/service/gateway.mjs
//   测试用 DSH_CMD 指向一个桩运行时（test/stub-runtime.mjs），不需要真的 DSH 与模型密钥。
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

/** 从各种事件形状里挑出一段可读文本（真实运行时的 message 事件形状可能是 message.content[{type,text}]） */
function textOf(ev) {
  const parts = [];
  const push = (v) => { if (typeof v === 'string' && v.trim()) parts.push(v.trim()); };
  push(ev.text);
  const blocks = ev.message?.content ?? ev.content;
  if (Array.isArray(blocks)) for (const b of blocks) push(typeof b === 'string' ? b : b?.text);
  return parts.join('\n').slice(0, 4000);
}

const sse = (res) => ({ write(event) { res.write('event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n'); } });

/** 一个会话：DSH 运行时子进程 + 事件日志 + SSE 订阅者（P4-04 的 C4） */
class Session {
  constructor(id, domain, authCtx, opts) {
    this.id = id;
    this.domain = domain;
    this.authCtx = authCtx;
    this.opts = opts;
    this.events = [];
    this.seq = 0;
    this.subs = new Set();
    this.status = 'starting';
    this.child = null;
    this.pending = new Map();
    this.nextRpc = 1;
    this.closed = false;
  }
  emit(type, payload = {}) {
    // 运行时的事件自带 seq：不能让它覆盖我们自己的单调 seq（否则 since 续接与排序都乱），
    // 把它记成 sourceSeq 供排查
    const { seq: sourceSeq, ...rest } = payload;
    const event = { seq: ++this.seq, type, ...rest, ...(sourceSeq !== undefined ? { sourceSeq } : {}) };
    this.events.push(event);
    for (const sub of this.subs) { try { sub.write(event); } catch { /* 断开的连接自己会清理 */ } }
    return event;
  }
  /** 把一个 JSON-RPC 请求写给子进程；只有 initialize / session/prompt / shutdown 三个方法 */
  rpc(method, params) {
    // 取消 / 结束时子进程已经没了：明确报「会话已结束」，不要写进一截断掉的管道
    if (this.closed || !this.child || this.child.killed || this.child.stdin.destroyed)
      return Promise.reject(new Error('E_SESSION_STOPPED: 运行时进程已结束'));
    const id = this.nextRpc++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n', (err) => { if (err) { this.pending.delete(id); reject(err); } });
    });
  }
  /** 起运行时进程：token 写进该进程专用的 secrets 文件（600），profile 启动时读 */
  start() {
    const dir = path.join(this.opts.secretsDir, this.id);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tokenFile = path.join(dir, 'ioc-mcp-token');
    writeFileSync(tokenFile, this.opts.mcpToken || '', { mode: 0o600 });
    const env = { ...process.env, IOC_MCP_TOKEN_FILE: tokenFile, IOC_MCP_URL: this.opts.mcpUrl || '', DSH_SESSION_ID: this.id, DSH_DOMAIN: this.domain };
    this.child = spawn(this.opts.dshCmd, this.opts.dshArgs, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdin.on('error', () => { /* 取消后子进程没了，EPIPE 忽略 */ });
    let buf = '';
    // spawn 失败（运行时不在 PATH 里）会发 error 事件：必须接住，否则整个 gateway 进程崩掉
    this.child.on('error', (e) => {
      this.status = 'failed';
      this.emit('error', { message: 'E_DSH_SPAWN: 起不了运行时 ' + this.opts.dshCmd + '：' + e.message });
      for (const { reject } of this.pending.values()) reject(new Error('E_DSH_SPAWN: ' + e.message));
      this.pending.clear();
    });
    this.child.stdout.on('data', (chunk) => {
      buf += chunk;
      for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (process.env.GATEWAY_DEBUG === '1') process.stderr.write('[dsh->gw] ' + line.slice(0, 300) + '\n');
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
          msg.error ? reject(new Error(msg.error.message || JSON.stringify(msg.error))) : resolve(msg.result);
        } else if (msg.method === 'session.event') {
          const p = msg.params || {};
          const ev = p.event;
          if (ev && typeof ev === 'object') {
            // 真实运行时给的是事件对象：type/kind 当类型，文本尽量挑出来给界面看
            const type = String(ev.type || ev.kind || 'event');
            const text = typeof ev.text === 'string' ? ev.text : textOf(ev);
            this.emit(type, { ...ev, ...(text ? { text } : {}), sessionId: p.sessionId });
          } else {
            const { sessionId, ...rest } = p;
            this.emit(String(ev || 'message'), { ...rest, sessionId });
          }
        } else if (msg.method === 'session.status') {
          this.status = msg.params?.status || this.status;
          this.emit('status', { status: this.status });
        }
      }
    });
    this.child.stderr.on('data', (c) => this.emit('log', { text: String(c).slice(0, 500) }));
    this.child.on('exit', (code, signal) => {
      this.status = 'stopped';
      this.emit('status', { status: 'stopped', code, signal });
    });
    // 真实 SDK 运行时的 initialize 契约（@deepseek-ai/dsh-sdk-jsonrpc-server）：provider / model / cwd 必填
    const start = this.rpc('initialize', { provider: this.opts.provider, model: this.opts.model, cwd: this.opts.cwd, ...(this.opts.reasoningEffort ? { reasoningEffort: this.opts.reasoningEffort } : {}) })
      .then((result) => {
        // ready：把运行时的自述带出来（用例据此断言 secrets 文件里的 token 真的被运行时读到了）
        this.emit('ready', { result });
        this.status = 'idle';
        this.emit('status', { status: 'idle' });
        return this;
      });
    return start;
  }
  async prompt(text, pageContext) {
    this.env = this.env || {};
    this.status = 'running';
    this.emit('turn/start', { text });
    // 真实运行时的 prompt 收 contentBlocks；页面上下文并进第一条文本块（模型看得到，工具参数里没有）
    const preamble = pageContext ? '[当前页面] ' + JSON.stringify(pageContext) + '\n' : '';
    const r = await this.rpc('session/prompt', { sessionId: this.id, contentBlocks: [{ type: 'text', text: preamble + text }] });
    // 注意：session/prompt 的返回只是「消息已入队」（{ messageId }），**不代表这一轮结束**。
    // 助手消息、工具调用、真正的 turn/end 都在之后以 session.event 通知进来——
    // 早先这里合成过一个 turn/end，结果调用方（面板/驱动）在这里就停了，模型的动作全看不到。
    this.emit('turn/accepted', { result: r });
    return r;
  }
  /** 取消 = 结束这个会话的运行时进程（V0-4：SDK 运行时不支持 session/cancel） */
  cancel() {
    this.emit('cancelled', {});
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');
      setTimeout(() => { if (this.child && !this.child.killed) this.child.kill('SIGKILL'); }, 2000).unref();
    }
    this.status = 'cancelled';
  }
  close() {
    this.closed = true;
    this.subs.clear();
    if (this.child && !this.child.killed) this.child.kill('SIGTERM');
  }
}

export function createGateway(overrides = {}) {
  const opts = {
    dshCmd: process.env.DSH_CMD || 'deepseek-harness-sdk-runtime',
    dshArgs: (process.env.DSH_ARGS ? process.env.DSH_ARGS.split(' ') : ['--profile', process.env.DSH_PROFILE || 'sdk']),
    secretsDir: process.env.DSH_SECRETS_DIR || path.join(process.env.TMPDIR || '/tmp', 'dsh-secrets'),
    mcpUrl: process.env.IOC_MCP_URL,
    provider: process.env.IOC_DSH_PROVIDER || 'deepseek-official',
    model: process.env.IOC_DSH_MODEL || 'deepseek-chat',
    cwd: process.env.IOC_DSH_CWD || '/data/work',
    reasoningEffort: process.env.IOC_DSH_REASONING || undefined,
    maxSessions: Number(process.env.GATEWAY_MAX_SESSIONS || 2),
    // 浏览器里的控制台（/ioc/console）直接调这个 gateway，所以要跨域头；GATEWAY_ALLOW_ORIGIN 可收紧
    allowOrigin: process.env.GATEWAY_ALLOW_ORIGIN || '*',
    port: Number(process.env.GATEWAY_PORT || 8090),
    ...overrides,
  };
  const sessions = new Map();
  const queue = [];
  const body = (req) => new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
  const send = (res, status, data) => {
    const text = data === undefined ? '' : JSON.stringify(data);
    res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
    res.end(text);
  };
  const fail = (res, status, code, message) => send(res, status, { code, message });
  const running = () => [...sessions.values()].filter((s) => s.status !== 'stopped' && s.status !== 'cancelled' && !s.closed).length;

  async function startSession(domain, authCtx, mcp) {
    const id = 'ses_' + randomBytes(8).toString('hex');
    const s = new Session(id, domain, authCtx, { ...opts, mcpToken: mcp?.token, mcpUrl: mcp?.url || opts.mcpUrl });
    sessions.set(id, s);
    await s.start();
    return s;
  }
  /** 排队：并发上限按内存算（每个会话约 315 MB，V0-4 实测），满了先排队 */
  async function create(domain, authCtx, mcp) {
    if (running() >= opts.maxSessions) {
      return await new Promise((resolve, reject) => queue.push({ domain, authCtx, mcp, resolve, reject }));
    }
    return startSession(domain, authCtx, mcp);
  }
  function drainQueue() {
    while (queue.length && running() < opts.maxSessions) {
      const job = queue.shift();
      startSession(job.domain, job.authCtx, job.mcp).then(job.resolve, job.reject).finally(drainQueue);
    }
  }

  const server = createServer(async (req, res) => {
    // CORS：控制台在另一个源上（开发时 3888，线上由 ioc-server 托管），预检也要答
    res.setHeader('access-control-allow-origin', opts.allowOrigin);
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, authorization');
    res.setHeader('vary', 'Origin');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // v1 / sessions / {id} / (messages|stream|cancel)
    try {
      if (req.method === 'GET' && url.pathname === '/v1/capabilities')
        return send(res, 200, {
          domain: process.env.GATEWAY_DOMAIN || 'ioc',
          model: process.env.DSH_MODEL || null,
          sessions: { running: running(), max: opts.maxSessions, queued: queue.length },
          mcp: { url: opts.mcpUrl || null, configured: Boolean(opts.mcpUrl) },
          dsh: { cmd: opts.dshCmd, args: opts.dshArgs, profile: process.env.DSH_PROFILE || 'sdk' },
        });
      if (parts[0] !== 'v1' || parts[1] !== 'sessions') return fail(res, 404, 'E_NOT_FOUND', '没有这个接口');
      if (req.method === 'POST' && parts.length === 2) {
        const b = await body(req);
        if (!b?.domain) return fail(res, 400, 'E_PARAM', 'body.domain 必填');
        if (!b?.mcp?.token) return fail(res, 400, 'E_PARAM', 'body.mcp.token 必填（由 apps/ioc 签发）');
        const s = await create(b.domain, b.auth_ctx || {}, b.mcp);
        return send(res, 201, { session_id: s.id, domain: s.domain, status: s.status });
      }
      const s = sessions.get(parts[2]);
      if (!s) return fail(res, 404, 'E_NOT_FOUND', '没有这个会话');
      if (req.method === 'POST' && parts[3] === 'messages') {
        const b = await body(req);
        if (typeof b?.text !== 'string' || !b.text.trim()) return fail(res, 400, 'E_PARAM', 'body.text 必填');
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ accepted: true, session_id: s.id }));
        s.prompt(b.text, b.page_context).catch((e) => s.emit('error', { message: String(e.message || e) }));
        return;
      }
      if (req.method === 'GET' && parts[3] === 'stream') {
        const since = Number(url.searchParams.get('since') || 0);
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        const sub = sse(res);
        for (const e of s.events.filter((e) => e.seq > since)) sub.write(e);
        s.subs.add(sub);
        const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
        req.on('close', () => { clearInterval(ping); s.subs.delete(sub); });
        return;
      }
      if (req.method === 'POST' && parts[3] === 'cancel') { s.cancel(); drainQueue(); return send(res, 202, { session_id: s.id, status: s.status }); }
      if (req.method === 'DELETE' && parts.length === 3) { s.close(); sessions.delete(s.id); drainQueue(); return send(res, 200, { session_id: s.id, closed: true }); }
      return fail(res, 404, 'E_NOT_FOUND', '没有这个接口');
    } catch (e) {
      return fail(res, 500, 'E_UPSTREAM', String(e?.message || e));
    }
  });
  return { server, opts, sessions, create, drainQueue, running, queued: () => queue.length, closeAll: () => { for (const s of sessions.values()) s.close(); } };
}

// 直接运行：node harness/service/gateway.mjs
if (process.argv[1] && process.argv[1].endsWith('gateway.mjs')) {
  const gw = createGateway();
  gw.server.listen(gw.opts.port, process.env.GATEWAY_HOST || '0.0.0.0', () => {
    console.log('[gateway] listening on ' + (process.env.GATEWAY_HOST || '0.0.0.0') + ':' + gw.opts.port + ', dsh=' + gw.opts.dshCmd + ' ' + gw.opts.dshArgs.join(' ') + ', maxSessions=' + gw.opts.maxSessions);
  });
  for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { gw.closeAll(); gw.server.close(() => process.exit(0)); });
}
