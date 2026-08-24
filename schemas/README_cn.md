# BuildingOS Schemas（M0 产出物）

> 状态：M0 草案。租户仓库 `.buildingos/` 的"文档即代码"schema 家族。
> 依据 [docs/api-contract.md](../docs/api-contract.md) 附录 A 的引擎兼容面调研（DSH 一手资料 + Codex 源码确认，commit `d21794d6`）。

## 设计原则

1. **超集统一**：BuildingOS 文档格式 = DSH 与 Codex 支持面（+ 空白区补全）的共同超集；一个文档，两个引擎。
2. **导入宽容、编译生成**：
   - **导入**（引擎既有资产 → 租户仓库）：原生 DSH / Codex 格式可直接接受，已知字段被映射，未知字段保留在 `metadata`。
   - **编译**（租户仓库 → 引擎视图）：由 adapter `compile()` 生成 DSH 视图（frontmatter + resourceBase）与 Codex 视图（SKILL.md frontmatter + 伴生 `openai.yaml` + references/）。
3. **源码即事实源**：字段约束以两引擎解析器源码为准（DSH `skills/src/...`、Codex `skills/src/parser.rs` + `ext/skills/src/loader/metadata.rs`），不依赖外链文档。
4. **机器可校验**：每个 schema 配 JSON Schema（`*.schema.json`），供 GitOps CI 的 `schema-lint` 检查使用。

## M0 决策记录（2026，skill schema 评审已定）

| 议题 | 决策 |
|---|---|
| `invocation.implicit` 在 DSH 侧 | 运行时忽略 + `metadata.x-buildingos.*` 无损携带（往返不丢） |
| Codex `interface` 归属 | 顶层 `ui:` 块（1:1 映射；M3 UI Skill 继承词汇） |
| `dependencies` 边界 | 分层：runtime.yaml = 注册目录 / skill = 引用清单；CI 校验引用可解析 |
| 扁平 `<name>.md` | 仅导入兼容，导入自动提升为目录束；canonical 唯一形态 = 目录束 |

> **M0 全部 15 条决策的人话版备忘录见 [契约哲学.md](../契约哲学.md)**（含每条决策的"为什么"与代价，按 D1–D15 编号）。

## Schema 家族

| Schema | 文件 | 状态 | 对应引擎原语 |
|---|---|---|---|
| **Skill** | `skill.schema.json` / `skill.schema.md` | ✅ 已定稿（M0 评审 4 决策落定） | DSH `<name>/SKILL.md`；Codex SKILL.md + `openai.yaml` |
| **Rules** | `rules.schema.json` / `rules.schema.md` | ✅ 已定稿（M0 评审 4 决策落定：生成式 permission / 多段落 / applies-to 预留 / 可否违反判据） | DSH system-prompt 插件 / preset；Codex AGENTS.md 层级段落 |
| **Prompts** | `prompts.schema.json` / `prompts.schema.md` | ✅ 已定稿（M0 评审 3 决策落定：合并式多人格 / 半结构化 / 会话级注入） | DSH persona/preset；Codex personality 模板 / developer instructions |
| **Configs** | `configs.schema.json` / `configs.schema.md` | ✅ 本草案 | DSH cordis.yml 行；Codex config.toml |
| UI Skills | `ui-skill.schema.json`（待建） | 📋 M3 | 预置"顶级 UI"的 Skill 与编码规则文档（动态生成前端） |
| World Knowledge（世界知识文档） | 自由 Markdown（t3 已定：M0 不建 schema） | 📋 M1 验证后定 | 无引擎原生原语（Codex memories 的 `MEMORY.md` 为同构先例）；toB `knowledge/` / toC `users/<uid>/` |

## 示例验收（examples/）

- `examples/skills/network-diagnose/`：skill schema 验收用例（真实技能 + references + 三视图编译演示 + 验证点清单），见 [examples/skills/README.md](../examples/skills/README.md)。

## 版本策略

- schema 语义版本独立于 API 契约（`schema/v1` 命名空间：`schemas/` 下文件版本号在 `$id` 中）。
- M0 讨论期以 `v0.x` 演进；首个稳定版 `v1.0` 在 M0 评审通过后锁定。
- 字段只做加法；破坏性变更必须升版本并提供迁移说明。

## 校验入口（供 CI）

```bash
# TODO: M1 提供 `dsh-schema-lint` 或复用构建管线的验证命令
# 输入：租户仓库 .buildingos/ 目录；输出：违反项清单
```
