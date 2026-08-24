# BuildingOS API Contract（统一 API 契约草案）

> **状态：DRAFT v1.9** —— 本文是"稳定边界"的实体草案。v1.8：N1/N3；v1.9：runtime 引导与配置设计（[runtime-bootstrap.md](runtime-bootstrap.md)），配置三分（D21）落定。
> 所有端点、字段、命名都可能调整；已从 README 定位固化的原则会标注 【已定】，其余均为 【待讨论】。
>
> 关联文档：[README](../README.md)（定位）、[README_cn](../README_cn.md)（中文版）、Roadmap M0 / M1 / M1.5。

---

## 1. 目的与原则

### 1.1 这份契约是什么

BuildingOS 的核心承诺：**引擎可以换（DSH / Codex / 未来任何 Harness），API 与 Git 治理模型不变。** 这份契约就是那条不变的边界的实体定义，由三部分组成：

| 部分 | 边界 | 谁到谁 |
|---|---|---|
| **Server API** | 团队应用 ↔ BuildingOS AI Server | 稳定、与引擎无关 |
| **Adapter Contract** | BuildingOS Runtime ↔ Harness 引擎 | 版本化，可插拔 |
| **Conformance Suite** | 判定"适配成功"的自动化判据 | CI / 发布门禁 |

### 1.2 设计原则

1. 【已定】**稳定边界**：契约版本演进缓慢且只做加法；引擎版本、模型版本的变化永不穿透此契约。
2. 【已定】**引擎无关**：同一租户文档（rules/skills/prompts/configs）在任何已收录引擎上行为等价（由 conformance 保证）。
3. 【已定】**文档原生**：请求可以引用仓库中的 Skill/Rule 文档；行为变更本身不通过 API 写入，而是走 Git（PR）。
4. 【已定】**只读默认**：破坏性操作默认拒绝，需显式确认或租户策略授权（与 persona 示例的 `read-only-by-default` 一致）。
5. 【已定】**诚实输出**：响应携带 `confidence`；禁止编造数据；出错时给出可定位的 `correlationId`。
6. 【待讨论】传输协议倾向 REST + JSON + SSE 流式；与 MCP（JSON-RPC 2.0）的对齐策略见 §9。

---

## 2. 核心概念

| 概念 | 说明 |
|---|---|
| **Tenant** | 一个客户 = 一个私有 Git 仓库。所有 API 都挂在 tenantId 之下。 |
| **User** | 租户内的使用者（C 端消费者 / B 端员工）。私人状态在运行时状态库，业务数据经工具访问——三层数据边界见 [tenancy-model.md](tenancy-model.md)。 |
| **Session** | 一次会话/任务上下文，有持久状态（与引擎的对话历史、记忆、计划）。 |
| **Message** | 会话中的一条用户或 Agent 消息。 |
| **Run** | 一次自主执行（Agentic run）：由消息触发，包含多个步骤与工具调用。 |
| **Artifact** | Run 产出的结构化结果（诊断报告、JSON、生成的 UI 描述等）。 |
| **Document** | 租户仓库中的规范/配置文档：`rules/`、`skills/`、`prompts/`、`configs/`（.md + YAML frontmatter）。 |
| **Skill** | 一项能力定义（how-to），`skills/*.md`。 |
| **Proposal** | 一次行为变更提议：落库为分支 + PR，走 GitOps 评审。 |
| **Event** | 会话/运行的流式事件（SSE 或 Webhook 推送）。 |
| **Adapter** | 把租户文档编译进某个引擎、并把引擎行为归一化的实现（见 §6）。 |

---

## 3. 传输与约定

- **Base URL**：`https://<harness-host>/api/v1`（生产伴生部署见 §4.4 的网络分区说明）。
- **认证**：`Authorization: Bearer <tenant-scoped-api-key>`；密钥分为 `read` / `write` 两级作用域（【已定】只读默认）。
- **版本化**：路径 `v1`。契约版本独立于引擎版本；破坏性变更必须升 `v2` 并提供迁移窗口（【已定】）。
- **幂等**：`POST` 创建类操作支持 `Idempotency-Key` 头；重放返回首次结果（【待讨论】是否全端点支持）。
- **流式**：需要流式的请求体带 `"stream": true`，响应切为 `text/event-stream`（SSE），见 §5。
- **错误信封**：所有非 2xx 响应统一结构：

```json
{
  "error": {
    "code": "POLICY_DENIED",
    "message": "write:router is denied by tenant policy",
    "details": { "rule": "read-only-by-default" },
    "correlationId": "corr_9f2c..."
  }
}
```

常用错误码：`TENANT_NOT_FOUND`、`AUTH_INSUFFICIENT_SCOPE`、`POLICY_DENIED`、`DOC_NOT_FOUND`、`ENGINE_UNAVAILABLE`（引擎或适配器异常，含 `adapterStatus`）、`RUN_FAILED`（含 `confidence: null` 与失败摘要）、`RATE_LIMITED`。

---

## 4. 端点

### 4.1 Sessions —— AI Server 主接口

**创建会话**

```
POST /v1/sessions
```

```json
{
  "tenantId": "acme-factory",
  "surface": "web",
  "role": "ops-engineer",
  "engine": "dsh"
}
```

```json
// 201
{
  "id": "sess_01J4X...",
  "status": "ready",
  "engine": "dsh",
  "engineVersion": "2025.11.1",
  "contractVersion": "v1"
}
```

`engine` 字段省略时由租户 `configs/runtime.yaml` 决定（【已定】引擎可插拔）。

**会话状态**

```
GET /v1/sessions/{sessionId}
```

返回 status（`ready` / `running` / `ended`）、最近消息、活跃 run、关联 artifact 列表、`engine` 与 `adapterStatus`。

**发送消息（触发 Run）**

```
POST /v1/sessions/{sessionId}/messages
```

```json
{
  "content": "交换机 SW-03 延迟升高，帮我诊断",
  "stream": true
}
```

`stream: true` 时返回 SSE（§5）；`stream: false` 时返回最终聚合结果：

```json
// 200
{
  "messageId": "msg_88d...",
  "runId": "run_007",
  "status": "completed",
  "answer": "SW-03 上行口丢包率 2.3%，接近阈值……",
  "artifact": { "type": "diagnosis", "switches": ["SW-03"], "findings": [] },
  "confidence": 0.82,
  "stepsUsed": ["network-diagnose"]
}
```

**事件流（SSE 订阅当前会话）**

```
GET /v1/sessions/{sessionId}/events
```

**结束会话**

```
DELETE /v1/sessions/{sessionId}
```

### 4.2 Documents & Skills —— Git Brain 的只读面

```
GET /v1/tenants/{tenantId}/docs?kind=rules|skills|prompts|configs
GET /v1/tenants/{tenantId}/docs/{path}          # 原始文档（.md）
GET /v1/tenants/{tenantId}/skills/{skillId}     # 编译后视图（引擎实际看到的形态）
```

`{path}` 如 `skills/network-diagnose.md`。编译后视图用于核对"文档写的是什么、引擎看到的是什么"——这是可审计性的基础（【已定】文档即源码）。

### 4.3 Governance —— GitOps 治理面

**提交 Issue（生产伴生诊断的落地动作之一）**

```
POST /v1/tenants/{tenantId}/issues
```

```json
{
  "title": "[prod] SW-03 丢包率持续超阈值",
  "body": "观测：……\n假设：……\n建议：检查上行光模块/重启 PoE（需授权）",
  "labels": ["production", "diagnosis"],
  "sourceRunId": "run_007"
}
```

**提议行为变更（生成 PR，不直接改生产）**

```
POST /v1/tenants/{tenantId}/proposals
```

```json
{
  "type": "skill-update",
  "target": "skills/network-diagnose.md",
  "description": "增加对上行口丢包率的阈值判断",
  "draft": "新增步骤：若丢包率 > 2% 则建议检查光模块…"
}
```

```
GET /v1/tenants/{tenantId}/proposals/{proposalId}
// { "status": "pr_open", "branch": "proposal/ops-123", "prUrl": "https://github.com/.../pull/42", "ciChecks": { "schema-lint": "pass", "permission-impact": "pass", "dry-run": "pending" } }
```

【已定】护栏：**任何行为变更都不得绕过 Git 直接写活配置**。Proposal 只创建分支/PR；合并由 CI 检查 + 人工/策略评审把关。

### 4.4 Ops —— 生产运维伴生

> 【已定】生产伴生 Harness 与应用部署在同一网络域内，但 API 面仅对内网与受控跳板开放；出网只允许 Git 相关（push 分支、PR、webhook）。具体端口与网段见自动生成的部署/防火墙要求文档（`GET /v1/ops/deployment-requirements`）。

```
GET  /v1/ops/health                    # runtime、adapters、engines、捆绑服务（PG/TDengine/MQTT）健康
GET  /v1/ops/logs?service=*&since=…    # 结构化日志查询/流式
POST /v1/ops/diagnose                  # 输入故障签名 → 根因假设 + 修复建议（落为 Issue 草稿，不直接改）
GET  /v1/ops/deployment-requirements   # 自动生成的部署要求文档（含防火墙开放要求）
GET  /v1/ops/upgrade-plan              # 自动生成的运行与升级方案文档
```

`/v1/ops/diagnose` 示例：

```json
{
  "symptom": "SW-03 latency p95 3s, packet loss 2.3%, PoE port 12 flapping",
  "mode": "propose-only"
}
```

```json
// 200 —— 只观察与提议，绝不直接写生产
{
  "hypotheses": [
    { "rank": 1, "cause": "上行光模块劣化", "evidence": ["loss>2%", "CRC errors"], "confidence": 0.71 },
    { "rank": 2, "cause": "PoE 端口环路", "evidence": ["port12 flapping"], "confidence": 0.58 }
  ],
  "proposedFix": {
    "kind": "skill-update",
    "target": "skills/network-diagnose.md",
    "summary": "新增光模块检查步骤",
    "issueDraft": "https://…/issues/new"
  },
  "authorizationRequired": true
}
```

### 4.5 Webhooks —— 事件订阅

```
POST /v1/tenants/{tenantId}/webhooks
{ "url": "https://…/events", "events": ["doc.hot-reloaded", "run.completed", "proposal.pr_merged"], "secret": "…" }
```

事件清单见 §5 事件类型。

### 4.6 工具治理（MCP 四态）【已定框架】

| 动作 | 机制 | 说明 |
|---|---|---|
| **使用** | 引擎 MCP 客户端（运行时调用） | 两引擎原生支持（DSH stdio / Streamable HTTP；Codex config.toml / `.mcp.json` / plugin mcpServers） |
| **选择** | 模型按任务自主选择 | 可选范围 = 已注册工具 ∩ 权限允许（permissions 由 rules hard 规则派生，D14 无例外） |
| **指定** | skill `dependencies.tools[]` | 引用（type+value），注册在 runtime.yaml（D3 分层）；CI 校验引用可解析 |
| **安装** | **受治理形态**：AI 提议 → 生成 runtime.yaml 变更 PR → 评审合并 → 热加载生效 | 新工具 = 新权限面，必须过 PR（可审计、可回滚）；**运行时直装 M0/M1 不做**。Codex `request_plugin_install`（Agent 请求安装）为 M1 调研项，评估映射为受治理 PR 流程 |

数据流：`skill.dependencies → runtime.yaml mcp_servers（注册）→ 引擎 MCP 客户端 → 业务系统（用户级授权）`。租户模型与数据边界详见 [tenancy-model.md](tenancy-model.md)。

---

## 5. 事件流（SSE）与事件类型

SSE 格式：`event: <type>` + `data: <json>`。核心事件类型：

| 事件 | 说明 |
|---|---|
| `session.created` / `session.ended` | 会话生命周期 |
| `run.started` | Run 开始，携带匹配的 skillId |
| `tool.call` / `tool.result` | 工具调用（MCP 对齐） |
| `step.completed` | Agentic 步骤完成，携带摘要 |
| `message.created` | Agent 消息增量 |
| `artifact.created` | 结构化产物 |
| `run.completed` / `run.failed` | Run 终结（含 `confidence`） |
| `doc.hot-reloaded` | Git 变更合并 → 热加载生效（Webhook 常用） |
| `proposal.pr_merged` | 行为变更 PR 合入 |
| `adapter.updated` | 适配器自动更新/回退（含 `fromVersion`/`toVersion`/`pinned`） |

---

## 6. Adapter Contract（BuildingOS Runtime ↔ 引擎）【已定框架，细节见 adapter-contract.md】

引擎可插拔的全部秘密在这份小接口里。**契约独立版本化：`adapter-contract/v1`。** 字段级定义、四张映射表、事件归一化与 conformance 判定表见 **[adapter-contract.md](adapter-contract.md)**（M1 设计稿 v0.1）。

```ts
// adapter-contract/v1 —— 每个已收录引擎实现一份
interface HarnessAdapter {
  // 1. 把租户文档编译为引擎原生配置（system prompt / context / tool 注册 / 权限边界）
  compile(docs: TenantDocs): EngineConfig;

  // 2. 统一 Run 接口：把 RunRequest 交给引擎，返回归一化事件流
  run(req: RunRequest, cfg: EngineConfig): AsyncStream<AgentEvent>;

  // 3. 工具面（MCP 对齐）：引擎可暴露给 Agent 的工具
  tools(): ToolDescriptor[];

  // 4. 引擎状态：版本、健康、能力
  status(): AdapterStatus;

  // 5. 自检：conformance 的本地入口，供 CI 调用
  selfcheck(): ConformanceReport;
}

interface RunRequest {
  sessionId: string;
  tenantId: string;
  intent: string;              // 用户意图或消息
  skills: string[];            // 命中的 skills/*.md
  context: ContextSlice;       // 动态上下文（来自租户仓库，按需裁剪）
  permissions: PermissionSet;  // 来自 configs/runtime.yaml，运行时统一强制的策略
}

type AgentEvent = {
  type: "thought" | "tool.call" | "tool.result" | "step" | "message" | "artifact" | "error"
      | "approval.request" | "user.input.request";   // 后两类为 M1 扩展（plan 与审批事件面，见 adapter-contract.md §5）
  ts: string;
  payload: unknown;            // 归一化载荷（§5 事件类型）
};
```

要点：

- **归一化**：`run()` 只流出上面 8 类事件，引擎特有的"花活"（思考格式、内部步骤命名）在适配器内抹平。
- **策略在 Runtime 侧**：权限/沙箱由 Runtime 统一执行（`permissions` 进 `RunRequest`），不信任引擎自带的权限实现——这是"跨引擎等价"的根基。
- **新增引擎**：写一个适配器 + 通过 conformance 套件 = 收录。**收录是人工社区决策，不在自动跟踪范围内（【已定】）。**

---

## 7. Conformance Suite（"适配成功"的自动化判据）

自动构建能成立，前提是"成功"有机器可判的标准。四个维度：

| 维度 | 判定 |
|---|---|
| **接口一致性** | 适配器通过 `adapter-contract/v1` 类型检查与契约测试 |
| **行为一致性** | 黄金任务集（如 `network-diagnose`、知识问答、只读巡检）在目标引擎上跑通，输出满足断言：结构合法、含 `confidence`、无编造字段 |
| **策略一致性** | 权限矩阵：被租户策略禁止的工具，**任何引擎**都必须以 `POLICY_DENIED` 拒绝 |
| **更新门禁** | 上游发新版 → 自动构建 + 全量 conformance：全绿 → 自动发布；任一红 → 告警 + 固定 last-known-good 版本（【已定】） |

---

## 8. 工作示例：network-diagnose 全链路

```
POST /v1/sessions
{ "tenantId": "acme-factory", "surface": "web", "role": "ops-engineer" }
→ sess_01J4X...

POST /v1/sessions/sess_01J4X.../messages
{ "content": "交换机 SW-03 延迟升高，帮我诊断", "stream": true }
```

SSE 事件流：

```
event: run.started
data: {"runId":"run_007","skill":"network-diagnose","engine":"dsh"}

event: tool.call
data: {"tool":"mcp://telemetry/query-switch-status","args":{"switches":["SW-03"]}}

event: tool.result
data: {"tool":"mcp://telemetry/query-switch-status","ok":true,"latencyMs":38}

event: step.completed
data: {"step":"Query switch status","summary":"SW-03 上行口丢包率 2.3%，CRC 错误持续增长"}

event: run.completed
data: {"runId":"run_007","artifact":{"type":"diagnosis","switches":["SW-03"],"findings":[{"metric":"uplink.packet_loss","value":"2.3%","threshold":"2%"}]},"confidence":0.82,"nextActions":["建议检查上行光模块；如授权可执行 PoE 端口重启"]}
```

（若引擎换成 codex，事件流除 `engine` 字段外逐字节一致——这是 conformance 行为一致性的验收标准。）

---

## 9. 待讨论问题（M0 讨论项）

1. **协议对齐**：Server API 是否直接以 MCP 形态暴露（JSON-RPC 2.0），还是 REST 为主、MCP 作为工具面？倾向：REST 为租户集成面，MCP 为工具标准（两不冲突）。
2. **流式通道**：SSE 足够，还是需要 WebSocket 双向（Agent 中途询问用户时反向推送）？
3. **Tenant 解析**：路径参数 vs `X-Tenant-Id` 头（多租户网关场景）。
4. **Run 幂等**：重试语义与 `Idempotency-Key` 的覆盖范围。
5. **Proposal 的自动化边界**：是否允许"策略白名单内的自动合并"（如仅文档格式修正），其余一律人工评审。
6. **Ops API 网络分区**：生产伴生 Harness 的暴露面、跳板与审计要求（与自动生成的防火墙要求文档联动）。
7. **UI Skill 文档的 Schema**：预置"顶级 UI"的 Skill/编码规则文档本身长什么样（见 M3 / examples 计划）。

---

## 10. 附录 A：引擎兼容面调研（DSH × Codex 现状）

> 调研时间：2026 年。**DSH 结论来自本地源码/设计文档**（deepseek-harness checkout，一手资料）；**Codex 结论来自本地 git clone（openai/codex，commit `d21794d6`，2026-08-24）一手源码复核** + 公开文档（docs/skills.md 外链、docs/config.md 等）。
> 本附录用于校准 §6 Adapter Contract 的 `compile()` 映射与 §7 Conformance 判据。标注【源码确认】的 Codex 项以该 commit 为准。

### A.1 文档原语对照：两边"原生支持什么文档"

| 原语 | DSH（DeepSeek Harness） | Codex（OpenAI Codex CLI） | 结论 |
|---|---|---|---|
| **Skill** | ✅ 一等公民：`<name>/SKILL.md` 或 `<name>.md` + YAML frontmatter | ✅ 同构：`.codex/skills/<name>/SKILL.md` + frontmatter + `references/` 子目录【源码确认】 | **两边趋同的文档原语**——BuildingOS `skills/*.md` 直接对齐 |
| **Rule** | ⚠️ 无独立 rule.md：规则由 system-prompt 插件 / preset 配置（cordis.yml）承载；沿用 `.agents` 约定 | ✅ **AGENTS.md**：从项目根到 cwd 层级收集拼接；`AGENTS.override.md` 优先；另有用户级 AGENTS.md【源码确认】 | 形态不同（层级拼接 vs 配置注入）——BuildingOS `rules/` 统一之 |
| **Plan** | ⚠️ 不是文件：plan mode 是会话状态（`mode/set` 事件 + `exit_plan_mode` 工具），配置在 cordis.yml | ⚠️ 是**模板文档**：collaboration-mode-template（plan.md）驱动 `<proposed_plan>` 块 + `request_user_input`；Plan 预设 reasoning_effort=medium【源码确认】 | Codex 的 plan 即文档模板——最贴近"系统全是文档" |
| **Memory** | ❌ 无原生 memory.md：明确走第三方 MCP memory server（Memorix / MCP Reference Memory / Engram 示例） | ✅ **原生 memories 子系统**：Phase1 抽取 → Phase2 合并出 `MEMORY.md` / `memory_summary.md` / `skills/`，存于 `~/.codex/memories/`（**git 基线目录**）【源码确认】 | Codex 已实现"记忆即 Git 文档"——与 BuildingOS 理念同向 |
| **Config** | ✅ `cordis.yml`（插件组合配置）+ preset + sandbox/approval 旋钮 | ✅ `.codex/config.toml`（model / sandbox_mode / approval_policy / mcp_servers …，[docs/config.md](https://github.com/openai/codex/blob/main/docs/config.md)） | 两边各自为政——BuildingOS `configs/runtime.yaml` 统一之 |

### A.2 Skill 格式细节（DSH 一手资料）

来自 DSH `docs/subsystems/skills.md`：

- 文件名：目录束 `<name>/SKILL.md` 或扁平 `<name>.md`；名字 kebab-case。
- YAML frontmatter 必填：`name`、`description`；可选：`whenToUse`、`metadata`（开放对象）、`disable-model-invocation`、`user-invocable`。
- **渐进式披露**：会话目录只注入 name + description（description 上限 500 字符）；正文由 `skill({name})` 工具按需加载，返回 `<skill_content>` / `<skill_resources>` / `<skill_instructions>`。
- 发现根（rank 序，就近优先）：项目 `.dsh/skills` → 项目 `.agents/skills` → customSkillDirs → 用户 `.dsh/skills` → 用户 `.agents/skills` → bundled。
- 分层注册表：全局层 + 各 preset 层，就近同名覆盖。
- DSH 明确承认：Codex、Claude Code、OpenCode、Kimi Code 已收敛到同一 skill 模式（渐进式披露）。

Codex 侧（本地源码确认）：skills crate 实现了解析 / 选择 / 加载（parser / selection / loading / invocation）；**用户输入可显式携带 `skill`（name + SKILL.md 路径）**（protocol_v1.md）；本仓库自身以 `.codex/skills/<name>/SKILL.md` 组织技能，正文通过 **`references/` 子目录**引用补充文档（如 `babysit-pr/references/heuristics.md`）。frontmatter 完整字段集以官方文档（developers.openai.com/codex/skills）为准——`docs/skills.md` 是外链，仓库内无 schema 全文。

### A.3 引用机制："其他文档是 ref 在这些文档中的吗？"

- **Skill → references**（两边都有，形态不同）：
  - DSH：`resourceBase` 指向目录 / URL / 托管资源，正文显式引用的脚本、引用、资产**按需加载，不做目录枚举**【源码确认】。
  - Codex：SKILL.md 正文直接引用同技能目录下 **`references/*.md`** 补充文档（如 babysit-pr 引用 `references/heuristics.md`、`references/github-api-notes.md`）【源码确认，仓库实例】。
- **Skill → Skill、Skill → Rule、Rule → 其他文件**：目前**没有标准**——DSH 的 deferred 清单明确把 `context: fork`、`arguments`、`allowed-tools` 等扩展字段排除在契约外；Codex 侧未见文档间通用引用协议。
- **结论**：skill → 补充文档的引用两边各自有了（DSH `resourceBase` / Codex `references/`），跨文档的通用引用仍是空白区——BuildingOS know-how 模型可统一（`references:` 约定，见 A.6），适配器只需映射两种资源基座。

### A.4 插件 / 扩展标准

| | DSH | Codex |
|---|---|---|
| **框架** | **Cordis**：npm 包导出 `apply(ctx)`（函数 / 对象 / Service 三种形态）；`cordis.yml` 组合；`inject` 声明服务依赖 | **plugin.json manifest + marketplace.json**：`.codex-plugin/plugin.json`（name / version / description / author / skills / hooks / mcpServers / apps / interface 元数据）；市场清单 `~/.agents/plugins/marketplace.json`（个人）或 `<repo>/.agents/plugins/marketplace.json`（团队），条目含安装策略（NOT_AVAILABLE / AVAILABLE / INSTALLED_BY_DEFAULT）与鉴权时机（ON_INSTALL / ON_USE）【源码确认】 |
| **可扩展面** | `ctx.skills` / `ctx.tools` / `ctx.bash` / `ctx.fs` / `ctx.modes` / `ctx.userInteraction` / `ctx.agents` / session 事件 / system-prompt 装配缝 | 组件化：skills（技能）+ hooks + mcpServers + apps（连接器）+ interface（UX）；`ext/*` 内建扩展（goal / guardian / memories / image-generation / web-search），贡献模型分 Context / Tool / Request / Output / Runtime / Turn【源码确认】 |
| **互操作性** | ❌ 不兼容 | ❌ 不兼容 |

### A.5 协议支持（MCP 之外还有什么）

| 协议 | DSH | Codex | 说明 |
|---|---|---|---|
| **MCP（作客户端）** | ✅ stdio + Streamable HTTP（工具注册为 `mcp__<server>__<tool>`） | ✅ config.toml / `.mcp.json` / plugin 内嵌 mcpServers 声明 | 双方共识，事实标准 |
| **MCP（作服务端）** | ⚠️ 未确认 | ✅ **`codex mcp-server`**（experimental）：JSON-RPC 2.0 over stdio；v2 RPC：`thread/start・resume・fork・read・list`、`turn/start・steer・interrupt`、`config/*`、`model/list`、`collaborationMode/list`；通知 `codex/event/*`；审批回调 `applyPatchApproval` / `execCommandApproval`【源码确认】 | **Codex 可被 MCP 客户端驱动**——BuildingOS Server API 可借此封装 |
| **ACP（Agent Client Protocol）** | ✅ JSON-RPC 2.0 over stdio（initialize / session/new / prompt / cancel / request_permission …）；2026 年起定位为**自动化专用**协议 | ❌ **源码级确认不支持**（codex-rs 无 ACP 实现） | 差异明确：Codex 适配器无需实现 ACP |
| **内部协议** | session 事件日志（自有事件域） | **protocol v1**：SQ/EQ 双队列；Ops（ConfigureSession / UserTurn / Interrupt / ExecApproval / UserInputAnswer）+ Events（AgentMessage / PlanDelta / ExecApprovalRequest / RequestUserInput / TurnStarted / TurnComplete）；JSON 换行流，任意双向流式传输（stdin/stdout、TCP、HTTP2、gRPC）【源码确认】 | Codex 协议面以进程内类型为主，非稳定 wire 契约 |

### A.6 对 BuildingOS 的启示：compile() 映射草案（校准 §6）

| BuildingOS 文档（租户仓库） | → DSH 原生形态 | → Codex 原生形态 |
|---|---|---|
| `skills/*.md`（frontmatter：name / description / whenToUse / metadata） | 放入项目 `.dsh/skills/` 或 `.agents/skills/`（**原样即兼容**）；`references/` → 同目录资源 | 放置 `.codex/skills/<name>/SKILL.md`；`references/` 子目录原样保留【源码确认】 |
| `rules/*.md`（行为边界） | 编译为 system-prompt 插件 section 或 preset 配置（cordis.yml） | 编译为 **AGENTS.md 层级段落**（根→cwd 就近拼接；`AGENTS.override.md` 作强制覆盖）【源码确认】 |
| `prompts/*.md`（人格） | 合并进 persona / preset 配置 | 合并进 collaboration-mode template / developer instructions |
| `plan/*.md`（计划范式，如启用） | 生成 plan mode 的 section 配置（cordis.yml `modes.plan.section`） | **直接生成为 collaboration-mode-template（与 plan.md 同构的文档）**【源码确认】 |
| `configs/runtime.yaml`（引擎 / 模型 / 权限 / MCP） | 映射为 cordis.yml 行 + sandbox / approval 旋钮 | 映射为 config.toml（model / sandbox_mode / approval_policy / mcp_servers） |
| `configs/memory.yaml`（记忆服务，如启用） | 生成 dsh-mcp-client overlay（如 mcp-reference-memory） | 启用原生 memories（产出 `MEMORY.md` 于 `~/.codex/memories` git 目录）或 MCP memory【源码确认】 |

### A.7 待验证项（收录引擎版本后复核）

1. **版本漂移**：本附录 Codex 项以 commit `d21794d6`（2026-08-24）为准；`codex mcp-server`、skills、plugins 均标 experimental，收录时按锁定版本复核。
2. **~~skills frontmatter 完整 schema~~ 已解决（v0.4）**：源码级 schema 见 A.8（`skills/src/parser.rs` + `ext/skills/src/loader/metadata.rs`，伴生元数据文件 `openai.yaml`）。官方站点文档（developers.openai.com/codex/skills）作为收录时的交叉复核参考。
3. **Codex 原生 memories 的启停条件**（ephemeral / 子会话 / feature 开关）与 `MEMORY.md` 的引用方式——影响 `configs/memory.yaml` 的默认值。
4. **M5.5 生产伴生自动化桥的选型**：DSH 走 ACP（自动化专用）还是自家 Server API；Codex 走 `codex mcp-server`（experimental）——两者事件模型（DSH session 事件 vs Codex codex/event）需在 Server API 事件层归一。

### A.8 Codex Skill 文档 Schema（源码确认，commit `d21794d6`）

一个 Codex 技能束由 4 部分组成（`ext/skills/src/loader/`）：

```
<skill-name>/
├── SKILL.md          # 正文 = 指令；frontmatter 见下
├── openai.yaml       # 伴生元数据：interface / dependencies / policy
├── references/       # 补充文档，正文显式引用（如 references/heuristics.md）
└── scripts/          # 脚本；执行脚本或读取文档可触发隐式调用
```

**SKILL.md frontmatter**（`skills/src/parser.rs`，解析器只消费这三个字段）：

| 字段 | 必填 | 约束 |
|---|---|---|
| `name` | ✅（缺省用目录名） | ≤64 字符；单行；kebab-case 惯例 |
| `description` | ✅ | 非空、单行（解析器对 `Build for AWS: ECS` 这类裸冒号值有自动修复） |
| `metadata.short-description` | 可选 | 单行 |

**openai.yaml**（`ext/skills/src/loader/metadata.rs`；**fail-open**：文件缺失/损坏不影响 SKILL.md 加载）：

```yaml
interface:                # 展示元数据
  display_name: ...
  short_description: ...
  icon_small: ...
  icon_large: ...
  brand_color: ...
  default_prompt: ...
dependencies:
  tools:                  # 技能声明的工具依赖
    - type: mcp           # 必填
      value: deployer     # 必填
      description: ...    # 可选，字段均有长度上限
      transport: ...
      command: ...
      url: ...
      oauth: { callback_port: ... }
policy:
  allow_implicit_invocation: false   # 默认 true；false 时禁止隐式调用
  products: [codex]                  # 产品门禁（当前仅解析存储，选择阶段未强制——model.rs TODO）
```

**隐式调用**（`skills/src/invocation.rs`）：命令中运行技能目录内的脚本、或读取技能目录下的文档，会被识别为对该技能的**隐式调用**——这是"渐进式披露"在 Codex 侧的触发面；`policy.allow_implicit_invocation: false` 可关闭。

> **与 DSH 的对比（影响 BuildingOS 统一 schema）**：DSH 把调用策略放在 SKILL.md frontmatter（`disable-model-invocation` / `user-invocable`）；Codex 放在伴生 `openai.yaml` 的 `policy`。BuildingOS 内部统一用 `invocation:` 概念（modelInvocable / userInvocable / allowImplicit），由 compile() 双向映射：→ DSH frontmatter 字段，→ Codex openai.yaml policy 字段。

> **参考来源**
> - DSH（本地 checkout 一手资料）：`docs/subsystems/skills.md`、`.agents/notes/implemented/feature/2026-07-05-skill-system.md`、`implemented/architecture/2026-08-09-layered-skill-registry.md`、`archived/feature/2026-06-14-acp-agent-client-protocol.md`、`archived/feature/2026-07-07-plan-mode.md`、`implemented/feature/2026-07-31-third-party-memory-mcp-examples.md`、`docs/cordis-tutorial/01-first-plugin.md`
> - Codex（本地 clone 一手源码，commit `d21794d6`，2026-08-24）：`codex-rs/core/src/agents_md.rs`、`codex-rs/core/src/agents_md_manager.rs`、`codex-rs/docs/protocol_v1.md`、`codex-rs/docs/codex_mcp_interface.md`、`codex-rs/collaboration-mode-templates/templates/{default,plan}.md`、`codex-rs/memories/README.md`、`codex-rs/skills/src/`、`codex-rs/ext/extension-api/notes.md`、`.codex/skills/babysit-pr/SKILL.md`、`codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md`
> - Codex（公开文档）：[docs/skills.md（外链至 developers.openai.com/codex/skills）](https://github.com/openai/codex/blob/2c6995ca4dfc23b93db311b59c1b4ead464658b1/docs/skills.md)、[docs/config.md](https://github.com/openai/codex/blob/65cc12d72e25723aece48edd6ff93dd288b6c042/docs/config.md)、[CodexGuide：AGENTS.md](https://github.com/freestylefly/CodexGuide/blob/main/docs/advanced/02-agents-md.md)、[codex-cli-best-practice：SKILLS.md](https://github.com/shanraisshan/codex-cli-best-practice/blob/main/docs/SKILLS.md)、[Vercel：6 best Codex plugins](https://vercel.com/i/codex-plugins)、[mem0：Codex CLI 记忆机制](https://mem0.ai/blog/how-memory-works-in-codex-cli)、[qwen-code-rust：ACP 参考](https://github.com/hscale/qwen-code-rust/blob/main/docs/acp.md)

---

## 11. Changelog

| 版本 | 说明 |
|---|---|
| v0.1 | 草案：三边界（Server API / Adapter Contract / Conformance）框架、端点骨架、事件模型、工作示例、讨论项 |
| v0.2 | 新增附录 A：DSH × Codex 引擎兼容面调研（文档原语 / 插件标准 / 协议 / compile 映射草案） |
| v0.3 | 附录 A 依据本地 Codex clone（commit d21794d6）一手复核：确认 AGENTS.md 层级发现、SKILL.md + references/、plugin.json / marketplace.json、`codex mcp-server`、原生 memories（`MEMORY.md`）、无 ACP；更新 compile 映射 |
| v0.4 | 源码级补全 Codex Skill 文档 Schema（A.8）：SKILL.md frontmatter（parser.rs）+ 伴生 `openai.yaml`（metadata.rs）+ references/ + scripts/ 隐式调用机制；A.7 第 2 项关闭 |
| v0.5 | M0 产出 [schemas/](../schemas/README.md)：Skill 文档 schema 草案（`skill.schema.md` + `skill.schema.json`），落地 A.6 compile 映射（统一格式 → DSH 视图 / Codex 视图） |
| v0.6 | M0 评审 4 项待定决策落定并同步 schemas/：implicit 忽略+metadata 无损携带 / `ui:` 顶层块 / dependencies 分层引用 / 扁平仅导入兼容+自动提升 |
| v0.7 | M0 产出补充：[examples/skills/network-diagnose](../examples/skills/network-diagnose/SKILL.md)（skill schema 验收用例，含三视图编译演示）与 [rules.schema.*](../schemas/rules.schema.md)（规则文档规范：AGENTS.md 层级映射 + hard/soft 落地） |
| v0.8 | rules 评审 4 决策落定（生成式 permission / 允许多段落 / applies-to 预留 / 可否违反判据）；skill 新增 `data:` 字段（租户数据依赖，示例验收暴露）；新增 [prompts.schema.*](../schemas/prompts.schema.md) |
| v0.9 | prompts 评审 3 决策落定（合并式多人格 / 半结构化 / 会话级注入）；新增 [configs.schema.*](../schemas/configs.schema.md) 与 [examples/configs/runtime.yaml](../examples/configs/runtime.yaml)——**M0 schema 家族齐备** |
| v1.0 | **M0 收官**：configs 评审 3 决策落定（统一词汇 / 无例外通道 / memory 占位）；新增 [contract-philosophy.md](../docs/contract-philosophy.md)（M0 全部决策的人话版备忘录，D1–D21） |
| v1.1 | 新增 [tenancy-model.md](tenancy-model.md)（三层数据边界 / 技能层级 / 工具四态，D16–D18）；§2 核心概念新增 User；新增 §4.6 工具治理 |
| v1.2 | tenancy-model 细化世界知识文档（D19：仓库 = 大脑 + 世界模型；toB `knowledge/` / toC `users/<uid>/` + 量级降级；知识文档先自由格式，M1 验证后再定 schema） |
| v1.3 | **M1 开工**：新增 [adapter-contract.md](adapter-contract.md)（§6 字段级细化：TenantDocs / EngineView / 四张映射表 / 事件归一化 / conformance 判定表 G1–G4 / 适配器生命周期 / 实施清单）；AgentEvent 扩展 9 类（新增 approval.request、user.input.request） |
| v1.4 | compile 首轮实弹验证：[compile-verification.md](compile-verification.md) + [engine-views/](../examples/engine-views/README.md)（两引擎视图 golden outputs）；adapter-contract 登记校准点 C1–C3 |
| v1.5 | D20 决策：order 全局统一编号空间（跨家族重号 lint 报错）；示例重排（persona order 20→30），C2 校准点关闭 |
| v1.6 | `adapter-contract/v1` 类型定义落成机器可校验 JSON Schema（[schemas/contract/](../schemas/contract/README.md)）：TenantDocs / EngineView / RunRequest / AgentEvent 9 类 |
| v1.7 | 校验与规范化模块设计（[normalizer-design.md](normalizer-design.md)）：compile 三段式第 1、2 段（解析校验 + 规范化 + 集合级 lint），实现蓝图与往返测试用例 |
| v1.8 | N1/N3 决策：SkillDoc 建模 `scripts[]`（contract schema 同步）；lint 级别 M1 硬编码 + M2 可配；示例技能补 `scripts/telemetry-snapshot.py` |
| v1.9 | Runtime 引导与配置设计（[runtime-bootstrap.md](runtime-bootstrap.md)）：配置三分（D21：文档进 Git、秘密 env 注入）、CLI 首启引导 7 步、dev/prod 双姿态 |
