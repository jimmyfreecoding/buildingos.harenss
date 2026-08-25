# BuildingOS 开发环境（本地 Docker 开发环境设计，M1.5 ②）

> 目标体验（用户需求）：`buildingos init my-tenant` → `cd my-tenant` → `docker compose up` →
> 在容器里直接开始开发（改 know-how、跑 validate/compile/Conformance、将来直接与 AI 对话）。
> English: [dev-environment.md](dev-environment.md)

## 1. 目标：租户目录自包含、一键起开发环境

```
my-tenant/                      ← init 生成（向导第 5 步的产物扩展）
├── docker-compose.yml          ← 租户自包含的开发环境定义（init 生成）
├── .env                        ← 秘密：MODEL_TOKEN / GIT_TOKEN / PG_PASSWORD（D21，gitignored）
├── .buildingos/                ← 大脑：rules / skills / prompts / configs
├── knowledge/                  ← 世界模型
└── .gitignore

cd my-tenant && docker compose up
# → buildingos-runtime:4000   dev runtime CLI（build/dev/validate/compile/conformance）
# → postgres:5432            状态库（会话/记忆，核心栈）
# → （可选）tdengine/mqtt     IoT 场景栈
```

交互面是 **Web 控制台**（`buildingos web`，DSH-GUI 风格：工作区选择器 → 文档/向导/流水线/开发环境面板）；
容器内 `buildingos` CLI 保留（validate/compile/conformance 即用），供 `docker compose exec` 与脚本使用。
将来的 dev runtime（M2+）提供 hot-reload + 引擎 run() 对话入口。

## 2. 服务拓扑（dev profile）

```
┌─ docker compose up（租户目录）─────────────────────────────┐
│  buildingos-runtime（node 容器）                           │
│    ├─ 挂载 工具源码（buildingos.harenss，dev 模式热改即生效）│
│    ├─ 挂载 租户目录（/workspace = my-tenant）              │
│    ├─ 入口：buildingos（CLI；交互面）                      │
│    └─ 读 .env（MODEL_TOKEN/GIT_TOKEN，D21 秘密不进 Git）   │
│  postgres（状态库：会话/记忆，核心栈默认）                  │
│  tdengine + mqtt（IoT 场景栈，按模板启用）                  │
└───────────────────────────────────────────────────────────┘
```

## 3. 现状盘点：今天能跑什么、还差什么（诚实）

| 能力 | 状态 |
|---|---|
| 租户文档管线（normalizer → adapters → golden 比对） | ✅ 已有——Web 控制台"校验/编译/一致性"面板（API 驱动）；容器内 CLI 同功能 |
| Web 控制台（工作区选择器/文档/向导/流水线/dev 控制） | ✅ 已有（M1.5 ③ 前半，`@buildingos/web`） |
| 首启向导（语言/引擎/模型/凭证/git） | ✅ 已有（CLI + 控制台"向导"面板） |
| 全局安装（`pnpm install -g`，自包含 bundle） | ✅ 已有 |
| **在租户目录 `docker compose up` 一键起环境** | ✅ 已实现（M1.5 ②）：init 生成 `docker-compose.yml` + `.env`（PG_PASSWORD）；`buildingos dev` 自动解析 `BUILDINGOS_TOOL_DIR` 并 `docker compose up` |
| **与 AI 对话（引擎 run() 桥：DSH/Codex）** | 📋 run() 桥待实现——这是"直接开发"体验的最后一块 |
| 热加载（改 know-how → 自动 re-validate/compile） | 📋 后置（E，随 run() 桥/M2） |

**结论**：开发环境已落地——Web 控制台是交互面，容器（CLI + PG）由控制台"开发环境"面板或 `buildingos dev` 启停；AI 对话依赖 run() 桥（M1.5 ③），是补全体验的下一环。

## 4. 实施拆分（按顺序）

| # | 交付物 | 内容 | 状态 |
|---|---|---|---|
| A | `deploy/Dockerfile` + `deploy/docker-compose.dev.yml` | buildingos-runtime（node）镜像定义 + postgres 服务；dev 模式挂载工具源码与租户目录 | ✅ 已实现 |
| B | runtime 容器入口 | 容器内 `buildingos` CLI 可用（镜像内全局安装自包含 bundle）；/workspace 挂载租户 | ✅ 已实现 |
| C | init 生成租户 `docker-compose.yml` + `.env` 扩展 | 向导第 5 步写入 compose（build context = 工具仓库，自动解析 BUILDINGOS_TOOL_DIR）+ PG_PASSWORD | ✅ 已实现 |
| D | `buildingos dev` 命令 | 等于 `docker compose up`（在租户工作区检测 compose，自动注入 BUILDINGOS_TOOL_DIR） | ✅ 已实现 |
| E | （后置）热加载 + 引擎 run() 桥 | watch 租户文档 → 自动 validate/compile；引擎对话（M1.5 ③） | 📋 待实现 |

## 5. 待确认决策点

1. **compose 放哪**：init 在租户目录生成 `docker-compose.yml`（自包含，符合"在目录中启动"）——推荐；备选：工具仓库 `deploy/`，租户引用。
2. **镜像 vs 挂载**：dev 模式**挂载工具源码**（改代码即生效，dogfooding 友好）；生产（M1.5 尾）再打镜像。
3. **PG 凭证**：进 `.env`（D21）——init 生成随机密码写入 `.env`，compose 引用 `${PG_PASSWORD}`。
4. **引擎对话优先级**：run() 桥（M1.5 ③）是否提前到本设计之后立即做，决定"直接开发"体验的完整度。
5. **场景栈分层**：核心栈（runtime + postgres）默认；TDengine/MQTT 按 IoT 模板 profile 启用（README 分层捆绑原则）。
