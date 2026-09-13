# examples/skills 示例

本目录是 BuildingOS know-how 文档的示例，同时充当 [skill schema](../../schemas/skill.schema.md)（M0 定稿项）的**验收用例**：验证 schema 是否好写、好读、能编译成两个引擎的视图。

## 本示例

| 文件 | 作用 |
|---|---|
| `network-diagnose/SKILL.md` | 按定稿 schema 编写的真实技能（canonical 目录束形态，Q4 决策） |
| `network-diagnose/references/thresholds.md` | `references[]` 声明的补充文档（正文中被显式引用） |

## schema 验证点（对应未来 CI lint 规则）

| 检查 | 本示例的满足方式 |
|---|---|
| `name` kebab-case ≤64 | `network-diagnose` ✅ |
| `description` 非空单行 | ✅ |
| `ui.brand-color` 为 `#RRGGBB` | `#2563EB` ✅ |
| `dependencies.value` 可解析 | `telemetry` → 需在 `configs/runtime.yaml` 注册（Q3 分层，见下） |
| `references[]` 声明与正文一致 | 正文引用 `thresholds.md` 且已声明 ✅ |
| `data[]` 路径存在 | `knowledge/topology.yaml`、`knowledge/network.md`（世界模型，D19）✅ |
| `invocation.implicit` 携带规则 | `implicit: false` → Codex `openai.yaml` policy；DSH 侧 `metadata.x-buildingos` 携带（Q1 决策） |

## compile 三视图演示

### 统一格式（租户仓库）——即本示例 SKILL.md 本身

### → Codex 视图（`.codex/skills/network-diagnose/`）

```markdown
---
name: network-diagnose
description: 基于网络遥测诊断交换机/AP 健康度，输出带置信度的结构化结论
metadata:
  short-description: 网络健康诊断
---
```

```yaml
# openai.yaml（伴生，由 compile 生成）
interface:
  display_name: 网络诊断
  short_description: 快速定位网络故障
  brand_color: '#2563EB'
  default_prompt: 帮我诊断一下网络问题
policy:
  allow_implicit_invocation: false
dependencies:
  tools:
    - type: mcp
      value: telemetry
      transport: stdio        # 由 runtime.yaml 派生（Q3：skill 只写引用）
```

`references/thresholds.md` 原样保留在 `references/` 子目录。

### → DSH 视图（`.dsh/skills/network-diagnose/SKILL.md`）

```markdown
---
name: network-diagnose
description: 基于网络遥测诊断交换机/AP 健康度，输出带置信度的结构化结论
whenToUse: 用户报告延迟升高、丢包、端口抖动、设备离线时
metadata:
  short-description: 网络健康诊断
  author: ops-team
  version: 1.0.0
  x-buildingos:               # 无损携带（Q1/Q2 决策；DSH 运行时忽略）
    ui:
      display-name: 网络诊断
      short-description: 快速定位网络故障
      brand-color: '#2563EB'
      default-prompt: 帮我诊断一下网络问题
    invocation-implicit: false
---
```

`resourceBase` 指向 `references/` 所在目录，正文引用的资源按需加载，不做目录枚举。

## 依赖解析演示（Q3 分层）

本示例引用 `telemetry`。配套的租户级注册见 [examples/configs/runtime.yaml](../configs/runtime.yaml)（configs.schema 草案已建）：

```yaml
# examples/configs/runtime.yaml（节选）
mcp_servers:
  - name: telemetry
    transport: stdio
    command: npx telemetry-mcp
```

CI 规则：skill 的 `dependencies.tools[].value` 必须能在 `runtime.yaml` 中解析，否则 PR 不通过。

## 验证结论（示例编写时的体会）

1. schema 字段足够写真实内容，无缺失感；`ui:` 块让技能"有名有姓"，对 M3 动态 UI 是现成的数据源。
2. 正文约定（步骤 / 置信度 / 只读默认 / 授权边界）与示例内容天然吻合——"诚实输出"与"治理"不是文档装饰，是技能正文的写作规范。
3. 示例验收中暴露的"租户数据依赖"问题已定（M0 决策记录第 5 条）：新增 `data:` 字段与 `references:` 分工——references = 技能自带资源（编译进引擎视图），data = 租户数据文件（如 `topology.yaml`，仅 lint / 审计 / 上下文构建用）。本示例 frontmatter 已按此更新。
