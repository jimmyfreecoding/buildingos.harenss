# BuildingOS Adapter Contract（M1 细化版）

> 状态：M1 设计稿 v0.4 —— api-contract §6 的**字段级细化**，目标是让 `compile()` / `run()` 可以真正实现。
> v0.2：首轮 compile 实弹验证；v0.3：类型定义落成 JSON Schema + D20；v0.4：校验与规范化模块设计（[normalizer-design.md](normalizer-design.md)）。
> 关联：[api-contract.md](api-contract.md) §6（框架）、[tenancy-model.md](tenancy-model.md)（数据从哪来）、[schemas/](../schemas/README.md)（文档 schema 家族）、[contract-philosophy_cn.md](contract-philosophy_cn.md)（D1–D21）。
> 本稿不包含任何适配器实现；DSH / Codex 的具体接入在 M1 实施阶段完成。

## 1. 目标与非目标

**目标**
- 给出 `compile()` 的输入（TenantDocs）与输出（EngineView）的字段级定义；
- 给出四张映射表（skill / rules / prompts / configs × DSH / Codex）的**逐字段转换规则**；
- 给出事件归一化的引擎映射（BuildingOS AgentEvent ↔ DSH ↔ Codex）；
- 给出 conformance 判定表（黄金任务集 + 权限矩阵 + 更新门禁）的具体条目。

**非目标**
- 不写适配器代码、不选具体语言/框架；
- 不定 Codex / DSH 的接入桥形态（ACP vs codex mcp-server vs 进程内）——实施时决策（§9）。

## 2. TenantDocs（compile 输入）

> 类型定义已落成机器可校验 JSON Schema：[schemas/contract/adapter-contract.schema.json](../schemas/contract/adapter-contract.schema.json)（以下 TS 为其可读镜像，以 schema 为准）。

```ts
// adapter-contract/v1 —— 引擎无关的规范化文档模型
interface TenantDocs {
  skills:     SkillDoc[];        // schemas/skill.schema.json（D1–D5）
  rules:      RuleDoc[];         // schemas/rules.schema.json（D6–D9）
  prompts:    PromptDoc[];       // schemas/prompts.schema.json（D10–D12）
  config:     RuntimeConfig;     // schemas/configs.schema.json（D13–D15）
  knowledge:  KnowledgeDoc[];    // 自由格式（D19，t3）
}

interface SkillDoc {
  name: string;                  // kebab-case ≤64
  description: string;
  whenToUse?: string;
  metadata: Record<string, unknown>;   // 开放对象（含 short-description、x-buildingos 携带区）
  ui?: { displayName?: string; shortDescription?: string; iconSmall?: string;
         iconLarge?: string; brandColor?: string; defaultPrompt?: string };
  invocation: { model: boolean; user: boolean; implicit: boolean };  // 规范化后（默认 true）
  products: string[];
  dependencies: ToolRef[];       // 引用（type+value），注册在 config.mcp_servers
  references: string[];          // bundle 内资源
  scripts: string[];             // scripts/ 脚本路径（N1：Codex 隐式调用；DSH 忽略但保留）
  data: string[];                // 租户知识/数据路径（D5、D19）
  body: string;                  // Markdown 正文
}

interface RuleDoc {
  id: string; title?: string; description?: string;
  scope: 'all' | 'tools' | 'session' | 'surface';
  enforce: 'hard' | 'soft';
  permission?: { effect: 'allow' | 'deny'; resource: string };  // hard 必填（D6 生成式）
  order: number;                 // 规范化后（默认 100）
  appliesTo?: string;            // M0 预留（D8）
  enabled: boolean;
  sections: { heading: string; body: string }[];  // 多段落（D7）
}

interface PromptDoc {
  id: string; language: string;  // 默认 zh-CN
  tone?: string; order: number; enabled: boolean;
  body: string;                  // 人格正文（合并式：按 order 拼接，D10）
}

interface RuntimeConfig {
  version: string; engine: 'dsh' | 'codex';
  model?: string;
  mcpServers: McpServerReg[];    // 注册（D3 分层）
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  approval: 'never' | 'on-request' | 'unless-trusted';
  ui?: { theme?: string; surfaces?: string[] };
  memory?: { provider: 'mcp-memory' | 'codex-native' };  // 占位（D15）
  // permissions 不在此：由 hard rules 派生（D6、D14）
}

interface KnowledgeDoc { path: string; content: string; }  // 自由格式（D19）
```

**compile 流水线（三段式）**：

```
TenantDocs → [1 解析校验] → [2 规范化] → [3 渲染] → EngineView
```

1. **解析校验**（引擎无关）：各文档过对应 JSON Schema + lint 规则（引用可解析、permissions 派生等）；
2. **规范化**（引擎无关）：排序（order）、技能同名冲突（D17 层级最近者胜）、人格合并（D10）、permissions 派生（D6）；
3. **渲染**（引擎相关）：按目标引擎模板生成 EngineView。

## 3. EngineView（compile 输出）

```ts
interface EngineView {
  engine: 'dsh' | 'codex';
  // 落盘模式：写入引擎工作区的文件（.dsh/ 或 .codex/ 等）
  files: GeneratedFile[];
  // 内存模式：headless API 调用时直接传结构化配置（不落盘）
  runtimeConfig?: Record<string, unknown>;
}

interface GeneratedFile {
  path: string;      // 相对引擎工作区（如 .codex/skills/network-diagnose/SKILL.md）
  content: string;   // 渲染后的文本（.md / .yaml / .toml）
  kind: 'skill' | 'rule' | 'prompt' | 'config' | 'knowledge';
}
```

- **DSH 适配器**：`files` 写 `.dsh/skills/...` + cordis.yml 行 / preset 配置；或 `runtimeConfig` 走进程内注册（`ctx.skills` / system-prompt section）——实施时选型（§9）。
- **Codex 适配器**：`files` 写 `.codex/skills/<name>/SKILL.md` + `openai.yaml` + `AGENTS.md` + `config.toml`；或 `runtimeConfig` 走 `codex mcp-server`（experimental）——实施时选型（§9）。

## 4. 四张映射表（逐字段）

> **跨家族装配（D20）**：`order` 为**全局统一编号空间**（rules 与 prompts 共用），数值冲突由 lint 报错；渲染时按 order 排成一条线（AGENTS.md 段落 / system-prompt sections）。

### 4.1 Skill 映射（D1–D5）

| TenantDocs 字段 | → DSH | → Codex |
|---|---|---|
| `name` / `description` | 原样（parser 校验：≤64 / 非空单行） | 原样进 SKILL.md frontmatter |
| `whenToUse` | → frontmatter `whenToUse` | 丢弃（或并入 description，可配） |
| `metadata` | 原样（开放对象） | 原样；`short-description` 被消费 |
| `ui` | → `metadata.x-buildingos.ui`（运行时忽略） | → `openai.yaml interface`（key 形态按收录版本复核） |
| `invocation.model=false` | → `disable-model-invocation: true` | — |
| `invocation.user=false` | → `user-invocable: false` | — |
| `invocation.implicit=false` | → `metadata.x-buildingos.invocation-implicit: false` | → `openai.yaml policy.allow_implicit_invocation: false` |
| `products` | — | → `openai.yaml policy.products` |
| `dependencies` | 仅作校验（引用须在 runtime.yaml 解析） | → `openai.yaml dependencies`（transport/command/url 从 config 派生） |
| `references[]` | → `resourceBase`（按需加载） | `references/` 子目录原样 |
| `data[]` | 不进视图（正文引用，租户文件系统可读） | 不进视图（同左） |

### 4.2 Rules 映射（D6–D9）

| TenantDocs 字段 | → DSH | → Codex |
|---|---|---|
| `sections[]`（按 order 排序） | → system-prompt section（如 `rules:<id>`，order 映射装配序） | → AGENTS.md 段落（根级，按 order；`appliesTo` 指向子目录时落子目录 AGENTS.md） |
| `enforce=hard` + `permission` | → 派生 sandbox / approval 配置条目 | → 段落内权限说明 + 生成权限检查条目（Codex 无原生权限层，工具级） |
| `enabled=false` | 跳过 | 跳过 |
| `appliesTo` | M0 忽略 | M0 忽略 |

### 4.3 Prompts 映射（D10–D12）

| TenantDocs 字段 | → DSH | → Codex |
|---|---|---|
| `body`（多文件按 order 合并） | → system-prompt persona section（persona 区 order 0–50） | → developer instructions 段落（会话级） |
| `language` | → persona / preset 语言设置 | 并入 developer instructions 文本（"回答使用 zh-CN"） |
| `tone` | 并入 section 正文 | 并入段落正文 |

### 4.4 Configs 映射（D13–D15）

| TenantDocs 字段 | → DSH | → Codex |
|---|---|---|
| `engine` / `model` | 模型配置 | `model` / `model_provider` |
| `mcpServers[]` | cordis.yml `dsh-mcp-client` 行 | `config.toml mcp_servers` 段（或 `.mcp.json`） |
| `sandbox` | sandbox 旋钮 | `sandbox_mode`（同名） |
| `approval` | approval 策略 | `approval_policy`（同名） |
| `memory` | mcp-client overlay（如 mcp-reference-memory） | memories 开关 / mcp memory 配置 |
| `ui` | — | —（BuildingOS 层） |
| permissions（派生） | 生成 sandbox/approval 相关条目 | —（工具级） |

## 5. run() 与事件归一化

`run(req: RunRequest, cfg: EngineConfig) → AsyncStream<AgentEvent>`。

**AgentEvent 类型扩展**（相对 api-contract §6 的 7 类，新增两类——plan 与审批是两引擎都有的真实事件面）：

```ts
type AgentEvent =
  | { type: 'thought'; ts: string; payload: { text: string } }
  | { type: 'tool.call';   ts: string; payload: { tool: string; args: unknown } }
  | { type: 'tool.result'; ts: string; payload: { tool: string; ok: boolean; result?: unknown } }
  | { type: 'step';        ts: string; payload: { step: string; summary?: string } }
  | { type: 'message';     ts: string; payload: { text: string } }
  | { type: 'artifact';    ts: string; payload: { type: string; data: unknown } }
  | { type: 'error';       ts: string; payload: { code: string; message: string } }
  | { type: 'approval.request'; ts: string; payload: { id: string; description: string; options?: string[] } }
  | { type: 'user.input.request'; ts: string; payload: { id: string; question: string; options?: string[] } };
```

**引擎事件映射**（实施时按锁定版本校准）：

| BuildingOS AgentEvent | DSH 事件面 | Codex 事件面 |
|---|---|---|
| `thought` | session 事件中的思考段（校准） | `PlanDelta` / `AgentMessageContentDelta`（protocol_v1） |
| `tool.call` / `tool.result` | `tool/call` + tool presentation（generic/terminal/diff） | codex/event 流中的工具事件（校准） |
| `step` | `agent/pre-step` 等步骤边界 | `TurnStarted` / `TurnComplete` 之间的步骤 |
| `message` | 消息事件 | `AgentMessage` |
| `artifact` | 结构化工具结果（归一） | 同左（结构化 content） |
| `error` | `turn/end` 错误 | `Error` / `Warning` |
| `approval.request` | user-approval seam（`approval/request`） | `ExecApprovalRequest` / `applyPatchApproval`（mcp-server） |
| `user.input.request` | `ask_user_question`（user-interaction seam） | `RequestUserInput` |

## 6. Conformance 判定表（M1 核心）

| 维度 | 判据 | 失败处置 |
|---|---|---|
| **接口一致性** | adapter 通过 `adapter-contract/v1` 契约测试（类型检查 + 边界用例） | 构建失败 → 不发布 |
| **行为一致性** | 黄金任务集（见下）全部通过断言 | 任一红 → 告警 + 固定 last-known-good |
| **策略一致性** | 权限矩阵：被租户策略 deny 的工具在**两个引擎**上都必须以 `POLICY_DENIED` 拒绝 | 任一漏放 → 阻断发布 |
| **更新门禁** | 上游 release → 自动构建 → 全量 conformance | 全绿自动发布 / 红则 pin |

**黄金任务集（黄金 G1–G4，初始版）**：

| 任务 | 输入 | 断言 |
|---|---|---|
| G1 `network-diagnose` | 黄金 skill（examples/skills/network-diagnose）+ knowledge/ 数据 + runtime.yaml（telemetry 注册） | 事件流形状合法；`artifact` 含 `confidence`；无编造字段；工具调用 `mcp://telemetry/*` 出现在 `tool.call` |
| G2 只读知识问答 | 从 `knowledge/network.md` 取数的问答 | 答案可溯源到知识文档（引用路径出现）；`message` 事件非空 |
| G3 权限拒绝 | 请求被 `permissions` deny 的工具（如 `write:router`） | 返回 `POLICY_DENIED` 错误事件；引擎侧无实际执行 |
| G4 plan 场景 | plan 模式会话（DSH `exit_plan_mode` / Codex `<proposed_plan>`） | 出现 `approval.request`（或等价的 plan 评审面）；无变更执行 |

**往返一致性**（编译层）：BuildingOS → 引擎视图 → 重新导入 → 语义等价（D1–D19 的无损规则，含 `x-buildingos` 携带区）。

## 7. 适配器生命周期（自维护流水线）

```
上游 release/tag（DSH、Codex）
  → release hook 触发构建
  → conformance 套件（§6）
  → 全绿 → 自动发布（发 adapter.updated 事件；租户热加载可选升级）
  → 任一红 → 告警 + 固定 last-known-good 版本
```

- 收录新引擎 = 人工社区评审（M4+），不在自动跟踪范围（README 已定）。
- 每个适配器独立版本化（`adapter:<engine>:<version>`），随引擎版本 pin。

## 8. 实施清单（M1 交付拆分）

- [x] `adapter-contract/v1` 类型定义（[schemas/contract/](../schemas/contract/README.md)）
- [x] 校验与规范化模块**设计**（[normalizer-design.md](normalizer-design.md)）——实现为 #4 实施项
- [ ] **DSH 适配器**：compile（skills→.dsh/skills、rules→system-prompt section、prompts→persona、configs→cordis.yml）+ run（事件桥，§9 选型）
- [ ] **Codex 适配器**：compile（skills→.codex/skills+openai.yaml、rules→AGENTS.md、prompts→developer instructions、configs→config.toml）+ run（事件桥，§9 选型）
- [ ] conformance 套件：黄金任务集 G1–G4 + 权限矩阵 + 往返测试
- [ ] 自动跟踪流水线：release hook → build → conformance → 发布/pin
- [ ] Dogfooding：BuildingOS 自身文档仓库作为第一个租户跑 DSH adapter（README 已定）

## 9. 待定项（M1 实施中决策）

| # | 议题 | 说明 |
|---|---|---|
| 1 | DSH `run()` 桥形态 | ACP（自动化专用）vs 进程内 cordis ctx 直接调用——实施时评估 |
| 2 | Codex `run()` 桥形态 | `codex mcp-server`（experimental，thread/turn RPC）vs protocol v1（SQ/EQ，非稳定 wire 契约）——倾向 mcp-server，需锁定版本验证 |
| 3 | EngineView 落盘 vs 内存 | 每适配器可选（DSH 倾向内存注册；Codex 倾向落盘 + mcp-server） |
| 4 | 事件字段命名 | §5 归一化的字段名以黄金任务集 G1–G4 验证后冻结 |
| 5 | **C1：Codex `interface` key 形态**（[compile-verification.md](compile-verification.md) §3） | openai.yaml interface 按 snake_case 生成，但 metadata.rs 的 serde 未显式可见 rename——收录版本时用真实加载验证后冻结 |
| 6 | **C2：跨家族合并顺序** | ✅ 已解决（D20）：order 全局统一编号空间，重号 lint 报错；示例已按 10/20/30 重排 |
| 7 | **C3：DSH cordis.yml 配置键形态** | system-prompt / mcp-client 接线所需具体键，实施 DSH adapter 时以真实 cordis 配置校准 |

## 10. Changelog

| 版本 | 说明 |
|---|---|
| v0.1 | M1 设计稿：TenantDocs / EngineView 字段级定义、四张映射表、事件归一化（AgentEvent 扩展为 9 类）、conformance 判定表（G1–G4）、适配器生命周期、实施清单、待定项 |
| v0.2 | 首轮 compile 实弹验证（[compile-verification.md](compile-verification.md)）：skill 映射表验证可用；登记校准点 C1–C3（interface key 形态 / 跨家族合并顺序 / DSH cordis 配置键） |
| v0.3 | C2 关闭（D20：order 全局统一编号空间）；`adapter-contract/v1` 类型定义落成 JSON Schema（[schemas/contract/](../schemas/contract/README.md)） |
| v0.4 | 校验与规范化模块设计（[normalizer-design.md](normalizer-design.md)）：流水线第 1、2 段 + 集合级 lint 清单 + 模块接口 + 往返测试用例 |
| v0.5 | N1 决策：SkillDoc 建模 `scripts[]`（contract schema 同步）；normalizer N3 决策（lint 级别 M1 硬编码 + M2 可配） |
