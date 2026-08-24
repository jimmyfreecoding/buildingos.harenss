# BuildingOS Rules 文档规范（DRAFT v0.1）

> 状态：M0 草案，待评审。机器可校验版本见 [rules.schema.json](rules.schema.json)。
> 字段约束依据：docs/api-contract.md 附录 A —— Codex `AGENTS.md`（`agents_md.rs`：根→cwd 层级收集、`AGENTS.override.md` 优先、字节上限）；DSH system-prompt 装配缝（具名 section + order：persona=0、mode:policy=50、tool guidance=100–199）。

## 1. 定位

`rules/` = AI 的"宪法"：**行为边界与约束**。与 skills（"能力"：怎么做一件事）不同，rules 描述"如何行事、不做什么、到什么边界为止"。

## 2. 文件布局

```
rules/<rule-id>.md       # 扁平文件（两引擎的规则载体都是文件/段落，无目录束要求）
```

## 3. frontmatter 字段

| 字段 | 必填 | 约束 | 引擎映射 |
|---|---|---|---|
| `id` | ✅ | kebab-case，全局唯一 | 标识（AGENTS.md 标题 / DSH section name） |
| `title` | 可选 | 单行 | AGENTS.md 段落标题 |
| `description` | 可选 | 目的说明（进目录/评审，不强制进提示词） | — |
| `scope` | 可选 | `all` / `tools` / `session` / `surface`，默认 `all` | 决定装配位置（见 §4） |
| `enforce` | 可选 | `hard` / `soft`，默认 `soft` | hard → 必须携带 `permission` 片段（生成式，Q1 已定）；soft → 仅提示词 |
| `permission` | hard 时必填 | `{ effect: allow\|deny, resource: <模式> }`；词汇与 runtime.yaml `permissions` 一致 | compile 派生 runtime.yaml permissions 条目（单一事实源） |
| `order` | 可选 | 整数，默认 100，越小越靠前；**全局统一编号空间（D20）**：与 prompts 共用一把尺子，重号 lint 报错 | AGENTS.md 段落顺序 / DSH section order |
| `applies-to` | 可选 | 适用面（如 `ops-engineer`）；**M0 预留，compile 忽略**（Q3 已定） | 导入时：Codex 子目录 AGENTS.md → 目录名 |
| `enabled` | 可选 | bool，默认 true | false → 跳过编译 |
| `references` | 可选 | 关联文档路径 | — |

> **多段落（Q2 已定）**：一个文件可含多个 `##` 段落；段落顺序 = 文件内出现顺序；跨文件排序用文件级 `order`（编译时先按 order 排文件、文件内按段落展开）。

正文 = 约束指令（Markdown）。示例：

```markdown
---
id: no-data-exfiltration
title: 数据不出租户边界
scope: all
enforce: hard
permission:
  effect: deny
  resource: data:*:external
order: 10
---

# 数据不出租户边界

禁止将客户数据发送至租户边界之外的任何端点。
（compile 将 `permission` 派生为 runtime.yaml permissions 条目；本规则不再手写权限。）
```

## 4. 双引擎映射（compile() 依据）

| BuildingOS | → Codex 视图 | → DSH 视图 |
|---|---|---|
| `rules/*.md`（enabled=true） | 按 `order` 合并为 **AGENTS.md 段落**（根级；`applies-to` 指向子目录时落子目录 AGENTS.md，根→cwd 就近拼接） | 编译为 **system-prompt section**（如 `rules:<id>`，`order` 直接映射装配顺序） |
| `enforce: hard` + `permission` | 段落内加权限说明 | **compile 由 `permission` 片段派生 runtime.yaml `permissions` 条目**（生成式，单一事实源，Q1 已定） |
| `enabled: false` | 跳过 | 跳过 |
| `applies-to` | **M0 忽略**（语义待多 Agent 场景定义，Q3 已定） | **M0 忽略** |
| 强制覆盖（可选输出） | → `AGENTS.override.md`（优先于普通 AGENTS.md，Codex 原生语义） | — |

## 5. 导入规则

| 来源 | 导入动作 |
|---|---|
| Codex `AGENTS.md` | 按 `##` 标题拆分为 `rules/*.md`；`<INSTRUCTIONS>` 包裹内容去除；`order` 按出现顺序；`AGENTS.override.md` 导入为 `enforce: hard` 候选 |
| DSH system-prompt section 配置 | 按 section 拆分导入；`order` 取自配置；section 名 → `id` |

## 6. 校验与 conformance

- **M0 lint**：`id` kebab-case 且唯一；`scope` / `enforce` 枚举合法；`order` 整数；`references` 路径存在。
- **hard 规则一致性（生成式，Q1 已定）**：`enforce: hard` 必须携带合法 `permission` 片段（effect 枚举 + resource 模式合法）；`permission` 与 `enforce: soft` 并存 → lint 报错。runtime.yaml `permissions` 由全部 hard 规则**派生**、不再手写——漂移在构造上不可能。
- **引擎视图校验**：Codex 视图为合法 AGENTS.md（纯文本段落、总量不超引擎字节上限）；DSH 视图 section 装配顺序正确。
- **往返一致性**：`enforce` / `order` / `scope` / `permission` 语义无损。

## 7. 与相邻文档的边界

| 文档 | 回答什么问题 | 典型内容 |
|---|---|---|
| `rules/` | 边界与约束（宪法） | 数据不外泄、只读默认、授权前置 |
| `skills/` | 怎么做一件事（能力） | 诊断流程、工具调用步骤 |
| `prompts/` | 语气与人格（人设） | 专业、简洁、中文回答 |
| `configs/runtime.yaml` | 运行参数（引擎/工具/权限） | mcp_servers、permissions（由 hard 规则派生）、engine |

> **rules vs prompts 判据（Q4 已定）**：模型违反了它，用户认为这是 **bug 还是风格偏好**？bug → rules（可强制）；语气/格式偏好 → prompts。`scope: surface` 的规则仍是可强制规则，不是人格。

## 8. 决策记录（M0 评审，已定）

| # | 议题 | 决策 | 落点 |
|---|---|---|---|
| 1 | hard 规则的单一事实源 | **生成式**：hard 规则携带机器可读 `permission` 片段，compile 派生 runtime.yaml permissions；CI 只验片段合法性 | §3 字段表、§4 映射、§6 lint |
| 2 | 多段落规则文件 | **允许**：段落顺序 = 文件内顺序；跨文件排序用文件级 `order`；不造段落级语法 | §3 注、§5 导入 |
| 3 | `applies-to` 建模时机 | **M0 仅预留**：compile 忽略；导入时 Codex 子目录 AGENTS.md → `applies-to` 目录名；语义待多 Agent 场景定义 | §3、§4 |
| 4 | rules 与 prompts 边界 | **以"是否可违反"判定**：违反即 bug → rules；风格偏好 → prompts；`scope: surface` 仍是可强制规则 | §7 边界表 |
