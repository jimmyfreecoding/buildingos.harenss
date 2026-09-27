# harness-gateway（P4-04）

调用方 ↔ harness 的服务，契约见 `docs/design/CONTRACTS.md` 的 C2 / C4 与 `docs/design/TECH-PLAN-ioc-harness.md` 8.3。

- **零依赖**：只用 Node 内置模块（`node:http`、`node:child_process`）。harenss 仓库没有根 `package.json`，也不引入运行时依赖。
- **端口 8090**（新分配，TECH-PLAN 8.3）：`GATEWAY_PORT` 可改。
- **一个 AI 会话一个 DSH 运行时子进程**（V0-4 实测：MCP 调用不带会话标识，所以靠「进程级 token」绑定）：
  gateway 用 JSON-RPC over stdio 只调三个方法 `initialize` / `session/prompt` / `shutdown`，
  收两种通知 `session.event`（带 `seq`）与 `session.status`。
- **会话 token 不由 gateway 生成**：调用方（apps/ioc 的 `POST /projects/{p}/ai/sessions`）签发，
  gateway 把它写进该子进程专用的 secrets 文件（`0600`，路径经 `IOC_MCP_TOKEN_FILE` 传给运行时），
  profile 里的 `@deepseek-ai/dsh-mcp-client.headers` 启动时读取；**模型全程看不到**。
- **取消 = 结束该会话的运行时进程**（SDK 运行时不支持 `session/cancel`）；**续接**由 gateway 的事件日志
  按 `seq` 补发（`?since=`）。并发按内存排队（每会话约 315 MB），`GATEWAY_MAX_SESSIONS` 默认 2。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/v1/capabilities` | 会话数 / 队列、MCP 配置、运行时命令（studio 显示「AI 写入通道可用 / 不可用」） |
| POST | `/v1/sessions` | `{ domain, auth_ctx, mcp: { url, token } }` → `201 { session_id }`；缺 `mcp.token` 400 |
| POST | `/v1/sessions/{id}/messages` | `{ text, page_context? }` → `202`，结果走事件流 |
| GET | `/v1/sessions/{id}/stream?since=<seq>` | SSE：`event: <type>` + `data: {seq,type,…}` |
| POST | `/v1/sessions/{id}/cancel` | 结束运行时进程 → `202` |
| DELETE | `/v1/sessions/{id}` | 丢弃会话（事件日志随会话删掉） |

C1 的任务（批处理）**这一步不做**：ioc 用不到，P7b netops 再补。

## 运行与测试

```bash
# 真实运行（需要 DSH 运行时与模型密钥，密钥由负责人提供、只落 secrets）
DSH_CMD=/path/to/deepseek-harness-sdk-runtime IOC_MCP_URL=http://127.0.0.1:3040/ioc/mcp node harness/service/gateway.mjs

# 用例（桩运行时，不需要 DSH 与模型密钥）
node --test harness/service/test/gateway.test.mjs
```

环境变量：`DSH_CMD`、`DSH_ARGS`（默认 `--profile sdk`）、`DSH_PROFILE`、`DSH_SECRETS_DIR`、
`GATEWAY_PORT`（8090）、`GATEWAY_HOST`（默认 `0.0.0.0`）、`GATEWAY_MAX_SESSIONS`（2）、`IOC_MCP_URL`。

## 还没做（后续步骤）

- P4-05：dsh-ioc profile 与镜像（`harness/domains/ioc/`、`harness/image/`）；
- P4-06：端到端（真模型 + ioc-server 的 `/mcp`）；
- 上游 SDK 运行时补上 `session/cancel` / `session/resume` 后，取消与续接可以简化（V0-4 已记）。

## 真 DSH 实测（P4-06b，2026-09-26）

本机的 DSH 是**源码构建的镜像** `netops-infra-harness:latest`（3.24 GB，DSH 提交 `c291e79`，node 22 + `dsh` CLI）。
里面**没有** V0-4 用的那个预编译 SDK 运行时二进制，但装了官方 SDK profile：
`@deepseek-ai/dsh-sdk-jsonrpc-server`（stdio JSON-RPC，按 sessionId 开会话、转发会话事件、`shutdown` 退出 0）。**协议名与 gateway 完全一致**：
`initialize` / `session/prompt` / `shutdown` + 通知 `session.event` / `session.status`。实测确认的参数契约：

| 方法 | 参数（实测） | 返回 |
|---|---|---|
| `initialize` | `{ provider, model, cwd, reasoningEffort? }` —— **三个必填**，缺一个报 `paths[0] must be of type string` | `{ serverInfo }` |
| `session/prompt` | `{ sessionId, contentBlocks: [{ type: 'text', text }] }` | `{ messageId }` |
| 通知 | `session.event { sessionId, event: { type, data, time } }`、`session.status { sessionId, status }` | —— |

gateway 已按这个契约对齐（原先按 V0-4 spike 写的 `{ domain, authCtx, sessionId }` 参数是错的）。
另外修了一个**真 bug**：运行时进程起不来时（例如 `DSH_CMD` 写错）未处理的 `error` 事件会把整个 gateway 打崩，
现在会回 500 `E_UPSTREAM` 并保持存活（用例 `运行时起不来：建会话回 500 E_UPSTREAM，gateway 自己不能崩`）。

### 建议的容器跑法

见 `harness/service/dsh-container-entry.sh`：Windows 上跑不了 Linux 运行时，所以 **gateway 与 DSH 同容器**；
容器用 `host.docker.internal:<端口>` 访问宿主机的 ioc-server；宿主机的 `~/.dsh/.credentials.yaml` 挂到 `/run/secrets` 由入口脚本以 600 装进 `$DSH_HOME`。
DSH 的 SDK profile 用 `dsh plugin --profile sdk add @deepseek-ai/dsh-sdk-app` + `… add @deepseek-ai/dsh-mcp-client` 建（入口脚本幂等）。

### 已验证 / 未通

- ✅ 模型凭据可用：`dsh --profile headless "…"` 在容器里拿到真答复（宿主机凭据，未用 Anthropic 兼容端点）。
- ✅ gateway ↔ SDK 运行时握手：`initialize` 成功、会话创建返回 `{ session_id, status: 'idle' }`。
- ✅ 提示送达：运行时事件 `agent/inbox/spliced` 里就是 gateway 发的文本（`contentBlocks` 形状正确）。
- ✅ MCP `failOnStartupError` 有效：token 不对时整棵插件树加载失败、会话起不来（不会静默降级）。
- ✅ **已通（同一个真模型）**：会话 → 模型 → `mcp__ioc__*` 工具 → 草稿。事件流：`step/start → user/message → request/header → assistant/message → tool/call → tool/result → step/end → turn/end`，草稿里真的写出 `blocks/dsh-note.html`，且 AI 没有发布（rev 不变）。

### 打通它要的三个条件（都踩过）

1. **`DSH_CMD=dsh`**：镜像里是 CLI，不是 V0-4 那个预编译 SDK 二进制（默认名会 ENOENT）。
2. **模型密钥走环境变量**：SDK profile 的 `llm-deepseek` 读 `DEEPSEEK_API_KEY`（凭据文件那条路在 SDK 组装里走不通），容器里从 `/run/secrets/deepseek-api-key` 读进去。
3. **审批策略**：`@deepseek-ai/dsh-user-approval` 默认 `ask`（agent 每次调工具都要人批）→ `harness/domains/ioc/sdk.patch.yml` 里加 preset `ioc`（沙箱仍 `workspace-write`、审批 `never`）并设 `defaultPreset: ioc`。注意 patch 会**替换整块 config**，原有三个 preset 必须重述。

**gateway 侧两个真 bug（都已修）**：

- `session/prompt` 的返回只是「消息已入队」（`{ messageId }`），**不代表这一轮结束**；gateway 原来在这里合成了一个 `turn/end`，调用方（面板 / 测试驱动）于是立刻停下，模型的动作一个都看不到。现在只发 `turn/accepted`，`turn/end` 一律转发运行时自己的。
- 运行时的事件自带 `seq`，原来会**覆盖** gateway 自己的单调 `seq`（`since` 续接与排序都乱）；现在 gateway 的 `seq` 权威，运行时的记成 `sourceSeq`。

