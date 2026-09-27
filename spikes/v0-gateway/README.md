# V0-4 · gateway ↔ DSH 会话 + MCP 写工具

对应 `buildingos.ioc/docs/TECH-PLAN.md` 8.4 与 11.2 的 V0-4（关闭开放问题 O1、O2）。验证代码，不是 gateway 的正式实现。

## 环境

- DSH：`pip install deepseek-harness-sdk`（0.1.5rc1），自带预编译运行时 `deepseek-harness-sdk-runtime-linux-x64`，不需要系统 Node，也不需要从源码构建。
- 模型：`fake-llm.mjs` 模拟 DeepSeek（OpenAI 兼容）接口，第一轮返回一次 `mcp__ioc__write_block` 工具调用，第二轮返回最终答复。没有真实模型密钥也能验证整条管道。
- MCP：`mcp-server.mjs` 模拟 apps/ioc 的 `/ioc/mcp`（Streamable HTTP，无状态），校验服务 token，并记录每次调用收到的请求头。
- profile：`sdk` 模板 + `ioc-mcp.patch.yml`（`@deepseek-ai/dsh-mcp-client`，`transport: streamable-http`，Authorization 从 secrets 文件读取，`failOnStartupError: true`）。
- 驱动：`gateway_probe.py`（模拟 gateway）、`startup_probe.py`（启动开销）。

## 结果

| 验证项 | 结果 |
|---|---|
| 会话 → 模型 → MCP 写工具 → 回到模型 → 最终答复 | ✅ 一轮 355 ms（假模型）。事件依次为 `turn/start → user/message → … → tool/call → tool/result → assistant/message → turn/end`，每个事件带 `seq`，`session.status: idle` 标志一轮结束 |
| 工具暴露 | ✅ MCP 工具以 `mcp__ioc__write_block`、`mcp__ioc__get_catalog` 出现，与 DSH 内置工具（bash、edit、read、web_fetch 等 20 余个）并列 |
| 服务 token | ✅ MCP 每次请求都带 `Authorization: Bearer <token>`，token 从 secrets 文件读取，模型看不到 |
| **MCP 调用是否带 DSH 会话标识** | ❌ **不带**。请求头只有静态配置的头，`_meta` 里也没有会话信息 |
| MCP 不可用时 | `failOnStartupError: true` → 运行时启动直接失败，错误明确（`mcp-client(ioc): initial connection or tool synchronization failed / ECONNREFUSED`），不会出现写工具悄悄消失的情况 |
| 取消 / 续接 / 列表 | ❌ SDK 运行时只实现了 `initialize`、`session/prompt`、`shutdown` 三个方法；`session/cancel` 等都返回 unknown method。同一个会话 id 在新进程里再次 prompt 会报 `session "…" already exists`（会话已落盘，但 SDK 运行时不提供续接） |
| web profile | 同一个运行时二进制可以启动 `--profile web`；二进制里有 `session/cancel`、`session/resume`、`session/load`、`session/list` 等，走 DSH 内部的 Connection 协议（受 browser-trust 和 cookie 约束），**本次未打通** |
| 启动开销 | 每个运行时进程启动约 **1.4 s**，常驻内存约 **315 MB**；假模型下单轮额外开销约 260 ms |

## 结论

**O1（gateway 与 DSH 怎么通信）→ 第一版采用 SDK 运行时，JSON-RPC over stdio，一个 AI 会话对应一个运行时进程。**

- gateway 用 Node 实现这套 JSON-RPC 协议（只有三个方法加上 `session.event` 和 `session.status` 两种通知，协议很小），不依赖 Python。
- **取消**：结束这个会话的运行时进程（已产生的事件都已落盘）。代价是下一轮要重新启动，约 1.4 s。
- **续接**：由 gateway 自己记录事件日志（按 `seq`），给前端断线重连时补发。服务进程重启后，用新的会话 id 加上前情摘要继续对话。
- 并发上限按内存计算（每个会话约 315 MB），沿用 D13 的队列：小盒子 1–2 个，中央服务器按内存配置。
- web profile 的 Connection 协议功能完整（取消、续接、分页），但属于 DSH 内部协议。列为 P4 的后续评估项：如果 DSH 上游公开这套接口，或者 SDK 运行时补上 cancel 和 resume，就切换过去。

**O2（MCP 调用怎么绑定会话）→ 每个运行时进程一个会话级 token。**

- 因为「一个会话一个进程」，gateway 启动进程时生成一个只绑定 `projectId + draftId + ops`、15 分钟有效、可续期的 token，写进这个进程专用的 secrets 文件。profile 的 `headers` 在启动时读取这个文件。
- apps/ioc 收到 MCP 调用后，用 token 找回 AuthCtx。**模型全程看不到 token，也不需要在工具参数里传。**
- 这比计划 8.4 里的「退路（模型带一次性 token 参数）」更安全，计划中的退路方案可以删掉。
