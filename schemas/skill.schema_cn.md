# BuildingOS Skill 文档规范（DRAFT v0.1）

> 状态：M0 草案，待评审。机器可校验版本见 [skill.schema.json](skill.schema.json)。
> 字段约束依据：DSH `docs/subsystems/skills.md`；Codex `skills/src/parser.rs`、`ext/skills/src/loader/metadata.rs`、`skills/src/invocation.rs`（commit `d21794d6`）。

## 1. 定位

`skills/*.md` 是 BuildingOS 的 know-how 文档原语——**两个引擎都原生支持且格式趋同的唯一原语**。本规范定义其统一格式（超集），并给出 `compile()` 到 DSH / Codex 的双向映射（见 §4）。

## 2. 文件布局（canonical bundle）

租户仓库内的标准形态（目录束，与两引擎兼容）：

```
skills/<skill-name>/
├── SKILL.md            # 正文 = 指令；frontmatter 见 §3
├── references/         # 补充文档（可选），正文中显式引用
└── scripts/            # 脚本（可选）→ TenantDocs scripts[]（N1 已定）；Codex 隐式调用语义，DSH 忽略但保留
```

- 名称 `kebab-case`（`^[a-z0-9]+(?:-[a-z0-9]+)*$`），≤64 字符。
- **canonical 形态 = 目录束（唯一一等公民，M0 已定）**：Codex 只认目录束，两引擎兼容要求统一形态。
- 扁平 `<skill-name>.md` **仅导入兼容**：导入时自动提升为目录束（无 references/scripts 时等价于单文件束），租户仓库形状收敛。

## 3. frontmatter 字段（BuildingOS 统一格式）

```yaml
---
name: network-diagnose                 # 必填：kebab-case，≤64，单行
description: 基于网络遥测诊断交换机/AP 健康度   # 必填：非空，单行
when-to-use: 用户报告延迟升高、丢包、端口抖动时   # 可选：路由提示
metadata:                               # 可选：开放对象
  short-description: 网络健康诊断       # 已知键：Codex 消费
  author: ops-team                      # 开放扩展
  version: 1.0.0
ui:                                     # 可选：展示元数据（M0 已定，顶层块）
  display-name: 网络诊断                # 1:1 映射 Codex interface
  short-description: 网络健康诊断
  brand-color: '#3B82F6'
  default-prompt: 诊断一下网络健康
invocation:                             # 可选：统一调用策略（见 §5 映射）
  model: true                           # 默认 true：模型可自动调用 → DSH disable-model-invocation（反向）
  user: true                            # 默认 true：用户可手动调用 → DSH user-invocable
  implicit: false                       # 默认 true：Codex 隐式调用；DSH 运行时忽略、metadata 无损携带
products: []                            # 可选：产品门禁（→ Codex policy.products）
dependencies:                           # 可选：工具引用清单（M0 已定：只写引用，注册在 runtime.yaml）
  tools:
    - type: mcp                         # 必填
      value: telemetry                  # 必填；必须能在 runtime.yaml 解析（CI 校验）
references:                             # 可选：引用声明（正文中引用的资源）
  - references/thresholds.md
data:                                   # 可选：租户数据依赖（M0 已定：与 references 分工）
  - topology.yaml                       # 租户仓库路径；CI 校验存在性
---
```

### 字段明细

| 字段 | 必填 | 约束 | 来源锚点 |
|---|---|---|---|
| `name` | ✅ | kebab-case；≤64；单行；缺省用目录名（导入时） | DSH / Codex parser |
| `description` | ✅ | 非空；单行（裸冒号值自动修复为引号） | DSH / Codex parser |
| `when-to-use` | 可选 | 路由提示，单行 | DSH `whenToUse` |
| `metadata` | 可选 | 开放对象；已知键 `short-description`；`x-buildingos` 保留给跨引擎无损携带 | DSH `metadata` / Codex `metadata` |
| `ui` | 可选 | 展示元数据（见 §4.1）；1:1 映射 Codex `interface`；DSH 侧 metadata 携带 | Codex `interface` |
| `invocation.model` | 可选 | bool，默认 true | DSH `disable-model-invocation`（反向） |
| `invocation.user` | 可选 | bool，默认 true | DSH `user-invocable` |
| `invocation.implicit` | 可选 | bool，默认 true；**DSH 运行时忽略，经 metadata 无损携带** | Codex `policy.allow_implicit_invocation`（反向） |
| `products` | 可选 | string[] | Codex `policy.products` |
| `dependencies.tools[]` | 可选 | **只写引用**（type+value 必填）；transport/auth 由 compile 从 runtime.yaml 派生 | Codex `dependencies.tools`（导入兼容字段保留） |
| `references[]` | 可选 | 相对路径（bundle 内）或 URL | DSH resourceBase / Codex references/ |
| `data[]` | 可选 | 租户数据文件路径（租户仓库内）；与 references 分工 | 不进引擎视图；lint / 审计 / 上下文构建（M0 已定） |

### 正文约定

- 指令以 Markdown 编写；明确**步骤**、**输出形态**、**置信度要求**、**只读默认与授权边界**。
- 正文中引用的资源必须在 `references[]` 中声明（导入宽容：未声明但存在的 `references/` 文件在编译时自动补全声明）。

## 4. 双引擎映射表（compile() 依据）

| BuildingOS 字段 | → DSH 视图 | → Codex 视图 |
|---|---|---|
| `name` / `description` | 原样进 frontmatter | 原样进 SKILL.md frontmatter |
| `when-to-use` | → `whenToUse` | —（并入 description 或忽略） |
| `metadata` | → `metadata`（原样） | → `metadata`（原样，`short-description` 被消费） |
| `ui` | → `metadata.x-buildingos.ui`（运行时忽略，往返无损） | → `openai.yaml` `interface`（key 形态按收录版本复核） |
| `invocation.model=false` | → `disable-model-invocation: true` | — |
| `invocation.user=false` | → `user-invocable: false` | — |
| `invocation.implicit=false` | → `metadata.x-buildingos.invocation-implicit: false`（运行时忽略） | → `openai.yaml` `policy.allow_implicit_invocation: false` |
| `products` | — | → `openai.yaml` `policy.products` |
| `dependencies` | —（DSH 工具经 `configs/runtime.yaml` 注册；仅作引用校验） | → `openai.yaml` `dependencies`（只写引用；transport/command/url/oauth 从 runtime.yaml 派生） |
| `references[]` | → `resourceBase`（按需加载，不枚举目录） | `references/` 子目录原样保留 |
| `data[]` | —（不进视图；正文引用即可） | —（不进视图；正文引用即可） |

### 4.1 `ui:` 块字段（M0 已定）

| 字段 | 说明 | Codex `interface` 对应 |
|---|---|---|
| `display-name` | 展示名 | `display_name` |
| `short-description` | 短描述 | `short_description` |
| `icon-small` / `icon-large` | 图标（bundle 内路径或 URL） | `icon_small` / `icon_large` |
| `brand-color` | 主题色（`#RRGGBB`） | `brand_color` |
| `default-prompt` | 默认起始提示 | `default_prompt` |

> **M3 衔接**：UI Skill 文档（预置"顶级 UI"的 Skill 与编码规则）将继承并扩展此词汇——`ui:` 块是展示元数据，UI Skill 是"产品界面如何生成"的规则文档，两者同源不同层。

## 5. 导入规则（引擎既有资产 → 租户仓库）

| 来源格式 | 导入动作 |
|---|---|
| DSH `<name>/SKILL.md` 或 `<name>.md` | frontmatter 原样接受：`whenToUse`→`when-to-use`、`disable-model-invocation`→`invocation.model`（反向）、`user-invocable`→`invocation.user`；未知字段进 `metadata`；**扁平文件自动提升为目录束** |
| Codex `<name>/SKILL.md` + `openai.yaml` + `references/` | SKILL.md frontmatter 原样接受；`openai.yaml` 的 `policy`→`invocation.implicit`/`products`、`dependencies`→`dependencies`（transport 等导入兼容字段保留）、`interface`→`ui`；`references/` 原样 |

导入是**宽容解析**：任何不满足统一 schema 的已知引擎文件都不阻塞导入，未知内容保留，由 lint 提示；**canonical 形态仅目录束（M0 已定）**。

## 6. 校验与 conformance

- **M0 lint（PR CI 的 schema-lint 检查）**：`skill.schema.json` 校验 frontmatter；检查 `references[]` 声明与正文引用一致性；检查 `dependencies` 引用必须在 `configs/runtime.yaml` 中可解析（M0 已定：分层注册）；检查 `data[]` 路径在租户仓库中存在（M0 已定）。
- **引擎视图校验**：compile 产物必须通过目标引擎解析器语义（DSH：name≤64、description 非空；Codex：parser + openai.yaml 合法）。
- **往返一致性（conformance 行为维度）**：BuildingOS → 引擎视图 → 重新导入 → 语义等价（字段无损、调用策略等价）。**无损规则**：`invocation.implicit` 与 `ui` 在 DSH 侧经 `metadata.x-buildingos.*` 携带，往返不丢（M0 已定）。

## 7. 完整示例：network-diagnose

统一格式（租户仓库 `skills/network-diagnose/SKILL.md`）：

```markdown
---
name: network-diagnose
description: 基于网络遥测诊断交换机/AP 健康度，输出带置信度的结构化结论
when-to-use: 用户报告延迟升高、丢包、端口抖动时
metadata:
  short-description: 网络健康诊断
  author: ops-team
ui:
  display-name: 网络诊断
  short-description: 网络健康诊断
  brand-color: '#3B82F6'
invocation:
  model: true
  user: true
  implicit: false
dependencies:
  tools:
    - type: mcp
      value: telemetry
references:
  - references/thresholds.md
data:
  - topology.yaml
---

# 网络诊断

## 步骤
1. 查询目标交换机状态（mcp://telemetry/query-switch-status）
2. 结合拓扑（topology.yaml）分析影响面
3. 每个发现必须带置信度（0-1），禁止编造数据
4. 写操作（如 PoE 重启）仅在获得书面授权后执行

## 输出
结构化 JSON：{ findings: [...], confidence, nextActions: [...] }
```

compile 生成的 Codex 视图（`.codex/skills/network-diagnose/`）：

```markdown
---
name: network-diagnose
description: 基于网络遥测诊断交换机/AP 健康度，输出带置信度的结构化结论
metadata:
  short-description: 网络健康诊断
---
```

```yaml
# openai.yaml（伴生）
interface:
  display_name: 网络诊断
  short_description: 网络健康诊断
  brand_color: '#3B82F6'
policy:
  allow_implicit_invocation: false
dependencies:
  tools:
    - type: mcp
      value: telemetry
      transport: stdio        # 由 runtime.yaml 派生（注册信息在 runtime.yaml，skill 只写引用）
```

compile 生成的 DSH 视图（`.dsh/skills/network-diagnose/SKILL.md`）：

```markdown
---
name: network-diagnose
description: 基于网络遥测诊断交换机/AP 健康度，输出带置信度的结构化结论
whenToUse: 用户报告延迟升高、丢包、端口抖动时
metadata:
  short-description: 网络健康诊断
  author: ops-team
  x-buildingos:               # 无损携带（DSH 运行时忽略）
    ui:
      display-name: 网络诊断
      short-description: 网络健康诊断
      brand-color: '#3B82F6'
    invocation-implicit: false
---
```

（`resourceBase` 指向 `references/` 所在目录，正文引用按需加载。）

## 8. 决策记录（M0 评审，已定）

| # | 议题 | 决策 | 落点 |
|---|---|---|---|
| 1 | `invocation.implicit` 在 DSH 侧 | **运行时忽略 + `metadata.x-buildingos.invocation-implicit` 无损携带**（往返不丢） | §4 映射表、§6 往返规则 |
| 2 | Codex `interface` 归属 | **顶层 `ui:` 块**（结构化可校验；1:1 映射 Codex interface；M3 UI Skill 继承词汇） | §3 字段表、§4.1 |
| 3 | `dependencies` 职责边界 | **分层**：runtime.yaml = 注册目录（transport/auth 单一事实源）；skill `dependencies` = 引用清单（type+value），CI 校验引用可解析 | §3、§6 lint |
| 4 | 扁平 `<name>.md` | **仅导入兼容 + 导入自动提升为目录束**；canonical 唯一形态 = 目录束 | §2、§5 |
| 5 | skill 对租户数据的依赖（示例验收暴露） | **新增 `data:` 字段**：与 references 分工（references=技能资源 / data=租户数据）；CI 校验路径存在；动态上下文构建以此为据 | §3、§4、§6 |
