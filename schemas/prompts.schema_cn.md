# BuildingOS Prompts 文档规范（DRAFT v0.1）

> 状态：M0 草案，待评审。机器可校验版本见 [prompts.schema.json](prompts.schema.json)。
> 字段约束依据：docs/api-contract.md 附录 A —— DSH persona / preset 配置（system-prompt section，persona 装配区 order 0–50）；Codex developer instructions 与 personality 模板（`core/templates/personalities/*.md`，如 `gpt-5.2-codex_friendly.md` / `gpt-5.2-codex_pragmatic.md`）。

## 1. 定位

`prompts/` = AI 的"人格"：**人设、语气、回答风格**。与 rules 的边界判据（rules.schema §7，Q4 已定）：**模型违反了它，用户认为这是 bug 还是风格偏好？** bug → rules（可强制）；风格偏好 → prompts（可协商）。

## 2. 文件布局

```
prompts/<prompt-id>.md       # 扁平文件
```

## 3. frontmatter 字段

| 字段 | 必填 | 约束 | 引擎映射 |
|---|---|---|---|
| `id` | ✅ | kebab-case，全局唯一 | 标识（persona section name） |
| `title` | 可选 | 单行 | — |
| `description` | 可选 | 目的说明（进目录/评审，不强制进提示词） | — |
| `language` | 可选 | 输出语言（BCP-47 简化集，默认 `zh-CN`） | DSH 语言设置；Codex 并入 developer instructions 文本 |
| `tone` | 可选 | 自由字符串（如 `professional, concise`） | 并入人格正文 |
| `order` | 可选 | 整数，默认 100，越小越靠前；**全局统一编号空间（D20）**：与 rules 共用一把尺子，重号 lint 报错 | DSH system-prompt section 装配顺序（persona 区）；Codex developer instructions 组合顺序 |
| `enabled` | 可选 | bool，默认 true | false → 跳过编译 |
| `references` | 可选 | 关联文档路径 | — |

正文 = 人格描述（Markdown：人设、语气规则、回复习惯、禁忌）。示例：

```markdown
---
id: ops-engineer
title: 运维工程师人格
language: zh-CN
tone: professional, concise
order: 20
---

# 运维工程师

- 中文回答，保留英文技术术语。
- 结论先说，细节后补。
- 报告置信度；绝不编造数据。
- 运维结果以结构化 JSON 返回。
```

> 注意："绝不编造数据"同时出现在人格与规则里是**允许的重复**——人格负责语气表达，rules 负责可强制约束（见 §7 边界）。不可违反表述只进 rules，不靠人格兜底。

> **多人格（Q1 已定）**：M0 语义 = 全部 enabled 人格按 `order` 合并为一个 persona（冲突由评审把关）；role/surface 级选择与 rules `applies-to` 同款 M0 预留（M5 多 Agent 场景一起建模）。

## 4. 双引擎映射（compile() 依据）

| BuildingOS | → Codex 视图 | → DSH 视图 |
|---|---|---|
| `prompts/*.md`（enabled=true） | 编译为 **developer instructions 段落**（与 collaboration-mode template / personality template 同构的 Markdown） | 编译为 **system-prompt section**（persona 装配区，`order` 直接映射） |
| `language` | 并入 developer instructions 文本（"回答使用 zh-CN"） | → persona / preset 的语言设置 |
| `tone` | 并入人格正文 | 并入 section 正文 |
| `enabled: false` | 跳过 | 跳过 |

> **多人格合并（Q1 已定）**：多个 enabled 人格按 `order` 拼接合并后注入；role/surface 选择 M0 不做。
> **粒度（Q3 已定）**：统一按"会话级"处理——Codex 注入 developer instructions（会话级），DSH 注入 persona section（会话级）；Codex 模型级 personality 预设（friendly / pragmatic）不在 M0 范围。

## 5. 导入规则

| 来源 | 导入动作 |
|---|---|
| Codex personality 模板（`friendly` / `pragmatic` 等） | → `prompts/<name>.md`，正文原样；文件名 → `id` |
| DSH persona / preset section 配置 | 按 section 拆分导入；section 名 → `id`；`order` 取自配置 |

## 6. 校验与 conformance

- **M0 lint**：`id` kebab-case 且唯一；`language` 在允许集合内；`order` 整数。
- **边界检查（Q4 判据机器化）**：正文中出现不可违反表述（"禁止 / 必须 / 绝不"类，且无协商语气）→ lint 建议移入 rules（提示而非阻断）。
- **多人格合并提示（Q1 已定）**：多个 enabled 人格且无 role 区分 → lint 提示"将按 order 合并为单一 persona"。
- **引擎视图校验**：Codex developer instructions 为合法 Markdown 段落；DSH section 装配顺序正确（persona 区 0–50）。
- **往返一致性**：`language` / `tone` / `order`（含合并顺序）语义无损。

## 7. 与相邻文档的边界

| 文档 | 回答什么问题 | 判据 |
|---|---|---|
| `rules/` | 边界与约束 | 违反 = bug → 可强制（enforce 语义） |
| `prompts/` | 人格与语气 | 违反 = 风格偏好 → 可协商 |
| `skills/` | 怎么做一件事 | 能力（procedure） |
| `configs/runtime.yaml` | 运行参数 | 引擎 / 工具 / 权限（由 hard 规则派生） |

## 8. 决策记录（M0 评审，已定）

| # | 议题 | 决策 | 落点 |
|---|---|---|---|
| 1 | 多人格模型 | **合并式**：全部 enabled 人格按 order 合并为一个 persona；role/surface 选择与 rules `applies-to` 同款 M0 预留（M5 一起建模）；lint 提示合并 | §3 注、§4、§6 |
| 2 | tone / language 结构化 | **半结构化（认可现状）**：language 机器消费（→ DSH 语言设置），tone 并入正文，正文是人格主体 | §3 字段表、§4 |
| 3 | 人格粒度差异 | **统一会话级注入**：Codex developer instructions + DSH persona section；Codex 模型级 personality 预设不在 M0 范围 | §4 |
