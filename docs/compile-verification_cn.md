# compile() 映射验证报告（M1 设计稿 v0.1 的实弹验证）

> 方法：按 adapter-contract §4 映射表，将统一格式示例（examples/）手工编译为两引擎视图（examples/engine-views/），逐字段对照两引擎解析器规则核对。
> 事实源：DSH `packages/skill/skill-filesystem/src/index.ts`（frontmatter 键拼写）；Codex `skills/src/parser.rs` + `ext/skills/src/loader/metadata.rs` + `docs/config.md`（commit `d21794d6`）。
> 结论先行：**skill 映射表可用；发现 3 个校准点，已进入 adapter-contract §9**。

## 1. DSH 视图核对清单

产物：`examples/engine-views/dsh/.dsh/skills/network-diagnose/SKILL.md`

| 核对项 | 结果 | 依据（DSH 源码） |
|---|---|---|
| `name` kebab-case ≤64 | ✅ `network-diagnose` | 名称模式 + 长度约束 |
| `description` 非空单行 | ✅ | 必填字段 |
| `whenToUse` 拼写（camelCase） | ✅ 正确 | `optionalString(parsed.data, 'whenToUse')` |
| `metadata` 开放对象 | ✅（含 x-buildingos 携带区） | metadata 为开放对象 |
| `invocation.model=true` → 不写 `disable-model-invocation` | ✅（缺省即 true） | `frontmatterBoolean(data, 'disable-model-invocation')`，缺省 true |
| `invocation.user=true` → 不写 `user-invocable` | ✅（缺省即 true） | 同上 |
| `implicit=false` → `metadata.x-buildingos.invocation-implicit: false` | ✅（DSH 运行时忽略，往返保留） | D19 无损规则 |
| `references/` 同束保留（resourceBase 按需加载） | ✅ | bundle 目录形态 |

## 2. Codex 视图核对清单

产物：`examples/engine-views/codex/.codex/skills/network-diagnose/{SKILL.md, openai.yaml}`

| 核对项 | 结果 | 依据（Codex 源码） |
|---|---|---|
| SKILL.md frontmatter 只含 name/description/metadata.short-description | ✅ | `parser.rs` 只消费这三个键 |
| `openai.yaml` interface 来自 `ui:` 块 | ✅ 内容映射正确 | `metadata.rs` `SkillInterfaceFile` |
| `openai.yaml` policy.allow_implicit_invocation 来自 invocation.implicit | ✅ | `Policy` 结构 |
| `openai.yaml` dependencies 由 runtime.yaml 派生（transport/command） | ✅ | Q3 分层（D3） |
| `references/` 原样保留 | ✅ | SKILL.md 正文引用机制 |
| `AGENTS.md` 段落（rules + prompts） | ⚠️ 见校准点 2 | `agents_md.rs` 层级收集 |
| `config.toml`（model/sandbox_mode/approval_policy/mcp_servers） | ✅ 结构正确 | `docs/config.md` |

## 3. 校准点（已登记 adapter-contract §9）

| # | 校准点 | 影响 | 处置 |
|---|---|---|---|
| C1 | Codex `openai.yaml` `interface` 的 key 形态：按 snake_case 生成（`display_name`），但 metadata.rs 的 serde 未显式可见 rename，测试夹具未覆盖 interface 字段 | Codex 若期望 camelCase，interface 会静默失效 | 收录版本时用真实 `codex mcp-server`/skills 加载验证后冻结 |
| C2 | **跨家族合并顺序** | ✅ 已解决（D20）：order 全局统一编号空间，重号 lint 报错；示例 persona 改 order 30（10/20/30） | 决策 D20（contract-philosophy_cn.md §6） |
| C3 | DSH 侧 system-prompt / mcp-client 的 cordis.yml 具体配置键形态（当前为中间表示） | 实施接线时才需要 | 实施 DSH adapter 时以真实 cordis 配置校准 |

## 4. 附带收益

1. `engine-views/` 即 conformance G1 的 **golden outputs**——自动化实现时直接断言"编译产物 == 本目录期望值"；
2. 编译产物 `codex/.codex/AGENTS.md` 在本仓库环境（遵循 AGENTS.md 约定）**被自动识别为指令来源**——引擎视图是活的格式，不是纸面规范；
3. DSH 侧 `metadata.x-buildingos` 携带区经本验证确认合法（开放对象），往返无损规则（D1–D19）可落地。

## 5. 下一步

- 将 C1–C3 纳入 adapter-contract §9 待定项并标注状态；
- conformance G1 自动化时以 engine-views 为期望产物；
- 实施 DSH adapter 时验证 system-prompt 接线（C3）。
