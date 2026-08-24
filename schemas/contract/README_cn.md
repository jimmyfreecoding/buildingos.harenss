# schemas/contract —— Adapter Contract v1 类型定义

> 状态：M1 设计稿 v0.1。**机器可校验版本**，对应 [docs/adapter-contract.md](../../docs/adapter-contract.md) §2–§5（TenantDocs / EngineView / RunRequest / AgentEvent）。
> 与租户文档 schema 的关系：**租户文档（kebab-case frontmatter）→ 规范化 → 本契约模型（camelCase）**——规范化在 compile 三段式流水线的第 2 段完成。

## 文件

| 文件 | 内容 |
|---|---|
| `adapter-contract.schema.json` | 全部 $defs：SkillDoc / RuleDoc / PromptDoc / RuntimeConfig / KnowledgeDoc / TenantDocs / GeneratedFile / EngineView / RunRequest / AgentEvent（9 类事件） |

## 使用方式

- **compile 输入校验**：租户文档解析 + 规范化后，产出的 TenantDocs 用本 schema 校验（root 即 `$ref: TenantDocs`）。
- **compile 输出校验**：EngineView 单独校验（`$ref: #/$defs/EngineView`）。
- **run 事件校验**：AgentEvent 判别联合校验（`$ref: #/$defs/AgentEvent`）。
- **TS 类型**：由本 JSON Schema 生成（工具 TODO——避免手写双份漂移）。

## Schema 能表达 vs 需 CI 补充的规则

| 规则 | 表达位置 |
|---|---|
| 字段结构、枚举、格式（kebab-case、#RRGGBB、BCP-47） | ✅ schema |
| `enforce: hard` 必须携带 `permission` | ✅ schema（if-then） |
| order 全局唯一（D20） | ⚠️ schema 无法跨实例校验 → **CI lint**（集合级检查） |
| dependencies 引用可在 mcpServers 解析 | ⚠️ 跨文档引用 → **CI lint** |
| permissions 由 hard rules 派生、禁止手写 | ⚠️ 派生关系 → **CI lint** |
| 人格合并顺序（D10） | ⚠️ 集合级 → **CI lint** |

## 版本策略

- 契约独立版本化：`adapter-contract/v1`（与 api-contract 的 Server API 版本无关）。
- 破坏性变更 → v2 + 迁移窗口；本 schema 的 `$id` 内嵌版本路径。

## 校验入口（供 CI）

```bash
# TODO: M1 提供 schema 校验命令（复用租户文档的 lint 工具链）
# 输入：TenantDocs JSON；输出：违反项清单
```
