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
