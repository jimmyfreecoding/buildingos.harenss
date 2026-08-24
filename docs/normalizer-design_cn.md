# TenantDocs Normalizer 设计（M1 设计稿 v0.1）

> 定位：compile 三段式流水线（解析校验 → 规范化 → 渲染）的**第 1、2 段**——把租户仓库的文档（kebab-case frontmatter）变成规范化的 TenantDocs（camelCase 模型，adapter-contract/v1）。
> **引擎无关、纯函数、无副作用**——第 3 段（渲染）由各引擎适配器负责。
> 关联：[adapter-contract.md](adapter-contract.md) §2、[schemas/](../schemas/README.md) 家族、[契约哲学](../契约哲学.md) D1–D20、[compile-verification.md](compile-verification.md)。

## 1. 边界

| | 做 | 不做 |
|---|---|---|
| 输入 | 租户仓库 `.buildingos/` + `knowledge/`（或 users/ 子目录） | — |
| 输出 | `TenantDocs`（经 adapter-contract.schema.json 校验） | 不渲染引擎视图（第 3 段） |
| 副作用 | 无（纯函数） | 不落盘、不触网、不调引擎 |

## 2. 处理流水线

```
租户仓库文件
  → [1a 解析] frontmatter 提取（YAML）+ 正文拆分
  → [1b 校验] 各文档过对应 schema（skill/rules/prompts/configs）+ 跨字段规则
  → [2  规范化] key 映射（kebab→camel）、默认值、结构变换、组合规则
  → [2b 集合级 lint] 跨文档规则（order 唯一、引用解析、派生检查）
  → TenantDocs（输出）
```

### 2.1 解析（1a）

- **frontmatter 提取**：`---` 定界 YAML 块 + Markdown 正文拆分。容错语义参照 DSH skill-filesystem：**坏文件 warn-and-skip，不阻塞整体**（一个来源坏了不能让整个租户加载失败）。
- **skill 目录束扫描**：`skills/<name>/SKILL.md`（canonical，D1）+ 同目录 `references/`、`scripts/`（scripts 收集为相对路径清单，N1 已定）；扁平 `<name>.md` 导入时自动提升为束（D1）。
- **rules 多段落拆分**（D7）：`##` 标题 → `sections[]`；文件级 frontmatter 为默认。
- **knowledge**：自由格式 Markdown（D19/t3），仅收集 path+content，不做结构校验。

### 2.2 校验（1b）

各文档过对应 JSON Schema（`schemas/*.schema.json`）：字段结构、枚举、格式（kebab-case、`#RRGGBB`、BCP-47）、`enforce: hard → 必须 permission`（schema if-then）。

### 2.3 规范化（2）

| 变换 | 说明 |
|---|---|
| key 映射 | kebab-case → camelCase：`when-to-use`→`whenToUse`、`short-description`→`shortDescription`、`display-name`→`displayName`、`mcp_servers`→`mcpServers` 等 |
| 默认值填充 | invocation（model/user/implicit 默认 true）、order（默认 100）、enabled（默认 true）、language（默认 zh-CN）、sandbox（read-only）、approval（on-request） |
| 结构变换 | skill 的 metadata 开放对象原样携带（含 `x-buildingos` 无损区，D2/D4/D19）；rules 段落并入 sections |
| 人格合并（D10） | prompts 按 order 排序后合并 body（保留各 id 边界注释） |
| 权限派生（D6/D14） | 全部 hard rules 的 `permission` 片段 → 归一化 PermissionSet（供渲染与 run 使用） |
| 技能层级（D17） | 同名技能：租户自有 > 行业模板 > 平台内置（M4 起支持模板层） |
| 引用补齐 | skill 正文引用的 references/ 文件自动补进 `references[]`（导入宽容，D5） |
| scripts 保留 | `scripts/` 相对路径 → SkillDoc.scripts[]（N1 已定；仅路径，不执行、不进上下文） |

### 2.4 集合级 lint（2b）

schema 表达不了的**跨文档/集合级规则**（对应 schemas/contract/README.md 的"需 CI 补充"清单）：

| 规则 | 级别 | 依据 |
|---|---|---|
| order 全局唯一（rules + prompts 同一编号空间） | error | D20 |
| `dependencies[].value` 可在 `mcpServers` 解析 | error | D3 |
| runtime.yaml 出现 `permissions` 段 | error | D14（派生禁止手写） |
| `references[]` / `data[]` 路径存在 | warning→error（M1 先 warning） | D5/D19 |
| 多 prompts enabled 且无 role 区分 | info（提示将合并） | D10 |
| 未知 frontmatter 字段 | warning（进 metadata 或忽略，不阻断） | 导入宽容 |

## 3. 模块接口（实现蓝图）

```ts
// @buildingos/normalizer —— 引擎无关
interface LoadTenantDocsOptions {
  repoRoot: string;          // 租户仓库根（.buildingos/ 所在）
  skillLayers?: SkillLayer[]; // D17 层级（平台内置/模板），M4 起使用
}

interface LoadResult {
  docs: TenantDocs;          // 经 adapter-contract.schema.json 校验
  diagnostics: Diagnostic[]; // lint 清单（error/warning/info）
  ok: boolean;
}

interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;              // 如 ORDER_DUPLICATE、DEP_UNRESOLVED
  file?: string;
  message: string;
}

async function loadTenantDocs(opts: LoadTenantDocsOptions): Promise<LoadResult>
```

- 输出 `docs` **必须**通过 adapter-contract.schema.json 校验（`ok=false` 时由调用方决定阻断）。
- 失败策略：1b schema 违反 → error（阻断）；坏文件/未知字段 → warn-and-skip（不阻断，与 DSH 语义一致）。

## 4. 往返测试设计（conformance 预备）

**目标**：normalizer（统一格式 → TenantDocs）与 import（引擎视图 → 统一格式）互为逆操作，语义无损（D1–D19 无损规则）。

```
[统一格式] → normalizer → TenantDocs → render → [引擎视图]
                ↑                                        ↓
           [import] ← 统一格式 ← [import 解析] ← [引擎视图]
```

用例（以 examples/ 为夹具）：

| 用例 | 断言 |
|---|---|
| examples/ 全家桶加载 | `ok=true`；TenantDocs 通过 contract schema；diagnostics 无 error |
| network-diagnose 规范化 | frontmatter kebab→camel 正确；invocation 默认值；`metadata.x-buildingos` 保留；dependencies/data 完整 |
| 人格合并 | 多 prompts 按 order 合并，边界注释保留 |
| hard 规则派生 | PermissionSet 含 `deny data:*:external`、`deny write:*`；runtime.yaml 无 permissions 段（lint error 用例反向验证） |
| order 重号 | 构造 rules=20 + prompts=20 → `ORDER_DUPLICATE` error |
| engine-views 反编译 | dsh/.codex 视图 → 统一格式 → normalizer → TenantDocs 与原输入语义等价（D2/D4 无损区验证） |
| scripts 往返 | 示例技能 `scripts/telemetry-snapshot.py` → scripts[] → 引擎视图原样 → import 回 scripts[]（N1） |

## 5. 依赖与工具

| 项 | 选择 | 依据 |
|---|---|---|
| YAML frontmatter | DSH 同款 `yaml` 包 + 自写 frontmatter 提取器 | DSH 已有先例（"yaml 是现代解析器"） |
| JSON Schema 校验 | ajv（TS 生态标准） | 与 schemas/ 家族同一工具链 |
| 实现语言 | TypeScript（与 DSH 生态一致；Dogfooding 友好） | README 已定 Dogfooding |
| 打包 | `@buildingos/normalizer` 独立小包（纯函数，无引擎依赖） | 模块边界清晰 |

## 6. 实施拆分（M1 #4 交付）

- [ ] frontmatter 提取器（`---` 定界 + 容错 + 坏文件 warn-and-skip）
- [ ] 五家族 loader（skill 目录束 / rules 多段落 / prompts / configs / knowledge）
- [ ] 规范化器（key 映射 + 默认值 + 结构变换 + 人格合并 + 权限派生 + 层级）
- [ ] 集合级 lint（order 唯一、引用解析、permissions 禁止手写等）
- [ ] 往返测试套件（§4 用例）
- [ ] contract schema 校验接线（输出门禁）

## 7. 决策记录（M1 评审，已定）

| # | 议题 | 决策 | 落点 |
|---|---|---|---|
| N1 | skill `scripts/` 建模 | **建模 `scripts: string[]`**：与 references 对称；可 lint / 审计 / 往返断言；Codex 隐式调用只需文件在位，DSH 忽略但保留（D2 哲学） | §2.1、§2.3、§4；contract schema SkillDoc |
| N2 | knowledge 轻量 frontmatter 的验证时机 | **维持 t3**：knowledge loader 先收集 path + content，发现实际需求再升级（仍在观察） | §2.1 |
| N3 | 错误策略租户可配性 | **M1 硬编码 + M2 可配**：安全类全 error、存在性类 warning；无真实用量数据前不猜需求 | §2.4 |

## 8. Changelog

| 版本 | 说明 |
|---|---|
| v0.1 | 设计稿：模块边界、两段流水线（解析校验 + 规范化）、集合级 lint 清单、模块接口、往返测试用例、实施拆分、待定项 |
| v0.2 | N1/N3 决策落定：skill `scripts[]` 建模（contract schema 同步）；lint 级别 M1 硬编码 + M2 可配；示例技能补 `scripts/telemetry-snapshot.py` |
