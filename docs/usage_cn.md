# BuildingOS 使用指南

> 这个项目今天怎么用，以及目标工作流（设计已定、实现待做）。
> English: [usage.md](usage.md)

## 1. 快速上手（今天就能跑）

```bash
git clone <你的-buildingos-仓库> && cd buildingos.harenss
pnpm install          # 工作区：normalizer / adapters / bootstrap / conformance / web / cli
pnpm build            # 必须一次——bin 指向 dist/cli.js
pnpm test             # 55 个测试——全绿
```

调用 CLI（三种方式）：

```bash
pnpm buildingos <cmd>        # 根辅助脚本——无需配置 PATH（推荐）
pnpm exec buildingos <cmd>   # 工作区 bin
# 或想在任何目录用裸 buildingos：pnpm link --global @buildingos/cli
```

示例（下面命令同理，用辅助脚本）：`pnpm buildingos init my-tenant`

```bash
# 脚手架一个租户仓库 —— 交互式首启向导：
#   0. 选择语言（中文 / English）   ← 第一个问题
#   1. 选引擎（dsh / codex）        → runtime.yaml engine
#   2. 选模型（内置起始目录）       → runtime.yaml model
#   3. 模型 token                   → .env（绝不进 Git，D21）
#   4. git 凭证（可跳过）           → .env
#   5. 脚手架 .buildingos/ + knowledge/ + .gitignore
#   6. 校验（normalizer）
#   7. 进入 runtime（dev 模式）——runtime CLI 随 M1.5 交付
buildingos init my-tenant

# 校验与 lint（normalizer 流水线第 1–2 段）
buildingos validate my-tenant

# 渲染引擎视图（DSH 或 Codex 实际消费的形态）
buildingos compile --engine dsh my-tenant
buildingos compile --engine codex my-tenant

# Conformance：编译产物 vs golden 引擎视图基线
buildingos conformance my-tenant

# 或打开 Web 控制台 —— 交互面（产品决定）：
# 浏览器里的 向导 / 校验 / 编译 / Conformance 面板
buildingos web
# → http://127.0.0.1:4173
```

### `init` 之后租户长什么样

```
my-tenant/
├── .buildingos/          # AI 应用的大脑（文档即代码）
│   ├── rules/            # 边界（宪法）——hard 规则派生权限（D6）
│   ├── skills/           # 能力（how-to know-how）
│   ├── prompts/          # 人格（语气、语言）
│   └── configs/          # runtime.yaml——引擎/模型/mcp_servers/沙箱/审批
├── knowledge/            # 世界模型——harness 生成、人工评审（D19）
└── .gitignore            # D21：钥匙绝不进仓库
```

## Workspace —— 工具不是项目

BuildingOS 仓库是**工具**（normalizer / adapters / conformance / cli）；租户工作区是**用户的项目**——任何带 `.buildingos/` 标记的目录。CLI 操作的是工作区，绝不是工具仓库本身（除非你把它 dogfood 成租户）。

工作区解析顺序：

1. `--workspace <dir>`（或位置参数）——显式
2. `BUILDINGOS_WORKSPACE` 环境变量
3. 从当前目录向上搜索 `.buildingos/` 标记（像 git 找 `.git`）
4. 报错并引导（`buildingos init <dir>` / `--workspace`）

```bash
buildingos validate --workspace my-tenant
BUILDINGOS_WORKSPACE=my-tenant buildingos compile --engine dsh
cd my-tenant && buildingos validate          # 向上搜索命中标记
```

## 2. CLI 命令参考

| 命令 | 作用 |
|---|---|
| `buildingos init <dir>` | 脚手架租户仓库（starter rules/skills/prompts/configs/knowledge + .gitignore） |
| `buildingos web [--port N]` | **交互面**（产品决定）：打开控制台 SPA——向导 / 校验 / 编译 / Conformance 面板 |
| `buildingos validate [root]` | 加载 + lint 租户：schema 校验、`ORDER_DUPLICATE`（D20）、`DEP_UNRESOLVED`（D3）、权限禁手写（D14）；有 error 时退出码非零 |
| `buildingos compile --engine dsh\|codex [root] [--out <dir>]` | 从 TenantDocs 渲染引擎视图；默认写入 `engine-views/<engine>` |
| `buildingos conformance [root]` | G1 编译黄金比对（需先有 `engine-views/`）；G2–G4 引擎门控，跳过 |

## 3. 开发循环（今天）

```
编辑 .buildingos/*.md     # 改 know-how——rules/skills/prompts
→ buildingos validate .   # CI 级 lint，出错即失败
→ buildingos compile --engine dsh .   # 看引擎将消费什么
→ git commit + PR         # 治理：评审、合并、版本、回滚
```

AI 应用的一切——行为、能力、人格、权限——都是租户仓库里的 Markdown/YAML。没有应用代码。

## 4. 目标工作流（设计已定；实现待做）

完整的首启体验在 [runtime-bootstrap.md](runtime-bootstrap.md) 与路线图中：

```
buildingos init            # M1.5 CLI 向导（已设计）：
                           #   1. 选引擎（dsh / codex）
                           #   2. 选模型
                           #   3. 模型凭证 → .env（绝不进 Git，D21）
                           #   4. git 凭证 → .env
                           #   5. 指向 / 脚手架租户仓库
                           #   6. 校验（normalizer）
                           #   7. 进入 runtime（dev 模式）

buildingos dev             # dev runtime（M1.5/M2）：本地进程 + 热加载 + 动态 UI；
                           #   docker compose 拉起 PG / 状态存储

buildingos serve --prod    # 生产伴生（M5.5）：同一 runtime 的运维姿态——
                           #   观察 → 诊断 → Issue → PR → CI 构建 → pull → up
```

| 阶段 | 里程碑 | 状态 |
|---|---|---|
| normalizer / 适配器 / conformance / 最小 CLI | M1 | ✅ 已实现，35 测试 |
| 首启向导（init 第 0–5 步：语言/引擎/模型/凭证/git/脚手架） | M1.5 | ✅ 已实现——[runtime-bootstrap.md](runtime-bootstrap.md) §2 |
| Runtime CLI 入口（第 7 步：`buildingos dev` / `serve --prod`） | M1.5/M5.5 | 📋 待实现 |
| 本地 Docker 开发环境（Turnkey compose：runtime + PG + 捆绑服务） | M1.5 | 📋 已设计——README 路线图 |
| Git 集成（webhook 热加载、PR CI 检查） | M2 | 📋 计划中 |
| 动态 UI（从 UI-skill 文档生成 admin web / dashboard） | M3 | 📋 计划中 |
| 新项目向导（交付清单 → 部署文件 → 自动部署） | M5 | 📋 计划中 |
| 生产伴生（自动部署/防火墙要求、GitOps 修复闭环） | M5.5 | 📋 计划中 |

在 runtime 落地之前，虚线以上的一切——文档模型、schema、编译映射、conformance——都由这四个 CLI 命令实测。

## 5. 测试当前状态

一条命令验证全部（48 个单元/验收测试 + 完整 CLI 端到端流程）：

```bash
pnpm verify        # typecheck → build → test → e2e demo
# 或分步：
pnpm check                          # typecheck + build + test（全部包）
pnpm --filter @buildingos/cli demo  # init(向导) → validate → compile dsh/codex → conformance
```

| 包 | 测试数 | 覆盖 |
|---|---|---|
| `@buildingos/normalizer` | 15 | frontmatter 提取（warn-and-skip）、五家族 loader、规范化（kebab→camel、默认值、人格合并 D10、权限派生 D6）、集合级 lint（`ORDER_DUPLICATE` D20、`DEP_UNRESOLVED` D3、`PERMISSIONS_HAND_WRITTEN` D14、路径检查 D5/D19）、输出门禁、构造的负面租户 |
| `@buildingos/adapter-dsh` | 6 | compile() 渲染 DSH 视图；golden 黄金比对（frontmatter 语义+正文）、`metadata.x-buildingos` 无损携带（D2/D4）、system-prompt sections 按 order（D20）、run() 待桥 |
| `@buildingos/adapter-codex` | 6 | compile() 渲染 Codex 视图；golden 黄金比对（SKILL.md parser 消费字段、openai.yaml 语义、AGENTS.md 顺序、config.toml D13） |
| `@buildingos/conformance` | 3 | G1 编译黄金比对（双引擎）、租户错误上抛、G2–G4 引擎门控骨架 |
| `@buildingos/cli` | 18 | 首启向导（语言优先、引擎/模型/凭证/git、`.env` D21、`.env.example`）、workspace 解析（flag/env/向上搜索/报错）、validate/compile/conformance 命令 |

**如何加测试**：在包的 `tests/` 放 `*.test.ts`（夹具：`examples/` 做验收用例，临时构造目录做负面用例），然后 `pnpm --filter <包名> test`。golden engine-views 是 compile 的字节/语义基线（conformance G1）。

## 6. 诚实状态

- **今天可用**：`init` / `validate` / `compile` / `conformance`——完整的"文档 → 引擎视图"流水线，golden 产物全程机器验证。
- **待实现**：`run()` 事件桥（DSH：ACP vs 进程内 cordis；Codex：`codex mcp-server` 验证——adapter-contract §9）、runtime CLI 向导、Docker/K8s 打包（M1.5）、Git webhook（M2）、动态 UI（M3）、项目向导（M5）、生产伴生（M5.5）。
- **秘密**：模型 / Git token 进 `.env`（gitignored）——绝不进仓库（D21）。
