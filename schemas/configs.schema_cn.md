# BuildingOS Configs 文档规范（DRAFT v0.1）

> 状态：M0 草案，待评审。机器可校验版本见 [configs.schema.json](configs.schema.json)。
> 字段约束依据：docs/api-contract.md 附录 A —— DSH `cordis.yml` + preset + sandbox/approval 旋钮；Codex `config.toml`（model / sandbox_mode / approval_policy / mcp_servers）。

## 1. 定位

`configs/runtime.yaml` = 租户运行参数——**"工具世界的户口本"**（Q3 分层：MCP 注册的唯一事实源）+ 引擎/模型/界面选择。与 rules/skills/prompts 的关系见 §7。

## 2. 文件布局

```
configs/runtime.yaml     # 唯一文件（一个租户一份）
```

## 3. 字段

| 字段 | 必填 | 约束 | 引擎映射 |
|---|---|---|---|
| `version` | ✅ | schema 版本 | — |
| `engine` | ✅ | `dsh` / `codex` / …（已收录适配器） | 决定启用哪个 adapter |
| `model` | 可选 | 供应商无关句柄 | → Codex `model`；→ DSH 模型配置 |
| `mcp_servers[]` | 可选 | `name` 唯一；`transport`（stdio/http）；`command`/`url`；`env` | → Codex `mcp_servers` / `.mcp.json`；→ DSH `dsh-mcp-client` 行 |
| `sandbox` | 可选 | `read-only` / `workspace-write` / `danger-full-access`，默认 `read-only`（统一抽象，与 Codex 同名） | → Codex `sandbox_mode`；→ DSH sandbox 旋钮 |
| `approval` | 可选 | `never` / `on-request` / `unless-trusted`，默认 `on-request`（统一抽象） | → Codex `approval_policy`；→ DSH approval 策略 |
| `ui` | 可选 | `theme` / `surfaces`（web/mobile/voice） | —（BuildingOS 层，M3 动态 UI 消费） |
| `memory` | 可选 | `provider`: `mcp-memory` / `codex-native` | → DSH mcp-client overlay；→ Codex memories 开关 |
| `permissions` | ❌ **禁止手写** | 由 rules 的 hard 规则**派生**（rules.schema Q1 生成式） | lint 报错提示派生 |

示例：

```yaml
# configs/runtime.yaml
version: "0.1"
engine: dsh            # dsh | codex（引擎可插拔）
model: gpt-4o          # 供应商无关句柄
mcp_servers:
  - name: telemetry
    transport: stdio
    command: npx telemetry-mcp
sandbox: read-only
approval: on-request
ui:
  theme: dark
  surfaces: [web, mobile]
memory:
  provider: mcp-memory
# permissions 不在此手写：由 rules/ 的 hard 规则派生
```

> **秘密配置（D21）**：模型 token、git 凭证等**绝不进本文件**（本文件所有字段进 Git）——走 env 注入（M1）或 secret store（M2），见 [runtime-bootstrap.md](../docs/runtime-bootstrap.md)。

## 4. 双引擎映射（compile() 依据）

| BuildingOS | → Codex `config.toml` | → DSH `cordis.yml` / preset |
|---|---|---|
| `engine` / `model` | `model` / `model_provider` | 模型配置 |
| `mcp_servers[]` | `mcp_servers` 段（或 `.mcp.json`） | `dsh-mcp-client` 行 |
| `sandbox` | `sandbox_mode` | sandbox 旋钮 |
| `approval` | `approval_policy` | approval 策略 |
| `memory` | memories 开关 / mcp memory 配置 | mcp-client overlay（如 mcp-reference-memory） |
| `ui` | — | —（BuildingOS 层） |
| `permissions`（派生） | —（Codex 无原生权限层，工具级） | 生成 sandbox/approval 相关条目 |

## 5. 导入规则

| 来源 | 导入动作 |
|---|---|
| Codex `config.toml` | → `runtime.yaml`（`engine: codex`；model / sandbox_mode / approval_policy / mcp_servers 映射） |
| DSH `cordis.yml` / preset | → `runtime.yaml`（`engine: dsh`；mcp 行合并进 `mcp_servers`） |

## 6. 校验与 conformance

- **M0 lint**：`engine` 在已收录适配器集合内；`mcp_servers[].name` 唯一、`transport` 枚举合法；`sandbox` / `approval` 枚举合法；**`permissions` 段出现 → 报错"由 rules 派生，禁止手写"**。
- **交叉校验**：全部 skills 的 `dependencies.value` 必须能在 `mcp_servers` 解析（双向）；hard rules 的 `permission` 派生结果与引擎视图一致。
- **引擎视图校验**：生成的 `config.toml` / `cordis.yml` 行合法。
- **往返一致性**：`engine` / `model` / `mcp_servers` / `sandbox` / `approval` 语义无损。

## 7. 与相邻文档的边界

| 文档 | 回答什么问题 | 关系 |
|---|---|---|
| `rules/` | 边界（含 `permission` 片段） | **派生** runtime.yaml permissions |
| `configs/runtime.yaml` | 运行参数（注册/引擎/模型） | 注册唯一事实源 |
| `skills/` `dependencies` | 工具引用（type+value） | 由 `mcp_servers` **解析**（CI 校验） |
| `prompts/` | 人格 | 独立 |
| UI Skills（M3） | 界面生成规则 | `ui` 字段为 M3 提供输入 |

## 8. 决策记录（M0 评审，已定）

| # | 议题 | 决策 | 落点 |
|---|---|---|---|
| 1 | sandbox / approval 统一词汇 | **认可**：`read-only / workspace-write / danger-full-access` + `never / on-request / unless-trusted`（与 Codex 同名、DSH 可映射；只读默认） | §3 字段表 |
| 2 | permissions 例外通道 | **不做例外**：一切权限皆规则；临时放行 = 临时规则 + PR（可审计可回滚） | §3、§6 lint |
| 3 | memory 段形态 | **占位声明**：`provider: mcp-memory / codex-native`；具体字段随 M1 调研（附录 A.7.3）定稿 | §3 |
