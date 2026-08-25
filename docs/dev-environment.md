# BuildingOS Dev Environment（本地 Docker 开发环境设计，M1.5 ②）

> 目标体验（用户需求）：`buildingos init my-tenant` → `cd my-tenant` → `docker compose up` →
> 浏览器打开 Web 控制台 → **直接开始开发**（改 know-how、看校验/编译/Conformance、将来直接与 AI 对话）。
> 中文版：[dev-environment_cn.md](dev-environment_cn.md)

## 1. 目标：租户目录自包含、一键起开发环境

```
my-tenant/                      ← init 生成（向导第 5 步的产物扩展）
├── docker-compose.yml          ← 租户自包含的开发环境定义（init 生成）
├── .env                        ← 秘密：MODEL_TOKEN / GIT_TOKEN / PG_PASSWORD（D21，gitignored）
├── .buildingos/                ← 大脑：rules / skills / prompts / configs
├── knowledge/                  ← 世界模型
└── .gitignore

cd my-tenant && docker compose up
# → http://127.0.0.1:4173  Web 控制台（向导/校验/编译/Conformance 面板）
# → postgres:5432          状态库（会话/记忆，核心栈）
# → （可选）tdengine/mqtt   IoT 场景栈
```

## 2. 服务拓扑（dev profile）

```
┌─ docker compose up（租户目录）─────────────────────────────┐
│  buildingos-runtime（node 容器）                           │
│    ├─ 挂载 工具源码（buildingos.harenss，dev 模式热改即生效）│
│    ├─ 挂载 租户目录（/workspace = my-tenant）              │
│    ├─ 入口：buildingos web --port 4173（Web 控制台）       │
│    └─ 读 .env（MODEL_TOKEN/GIT_TOKEN，D21 秘密不进 Git）   │
│  postgres（状态库：会话/记忆，核心栈默认）                  │
│  tdengine + mqtt（IoT 场景栈，按模板启用）                  │
└───────────────────────────────────────────────────────────┘
```

## 3. 现状盘点：今天能跑什么、还差什么（诚实）

| 能力 | 状态 |
|---|---|
| Web 控制台（向导/校验/编译/Conformance 面板） | ✅ 已有（`@buildingos/web`）——容器里就能跑 |
| 租户文档管线（normalizer → adapters → golden 比对） | ✅ 已有 |
| **在租户目录 `docker compose up` 一键起环境** | 📋 本设计，待实现 |
| **与 AI 对话（引擎 run() 桥：DSH/Codex）** | 📋 run() 桥待实现——这是"直接开发"体验的最后一块 |
| 热加载（改 know-how → 控制台自动刷新） | 📋 后置（E） |

**结论**：容器环境可以先落地（Web 控制台 + PG + 文档管线全在容器里跑）；AI 对话依赖 run() 桥（M1.5 ③），是补全体验的下一环，不是本设计的前置。

## 4. 实施拆分（按顺序）

| # | 交付物 | 内容 |
|---|---|---|
| A | `deploy/Dockerfile` + `deploy/docker-compose.dev.yml` | buildingos-runtime（node）镜像定义 + postgres 服务；dev 模式挂载工具源码与租户目录 |
| B | runtime 容器入口 | 启动 `buildingos web`，绑定租户挂载（`--workspace /workspace`）；可选 healthcheck |
| C | init 生成租户 `docker-compose.yml` + `.env` 扩展 | 向导第 5 步同时写入 compose（引用工具仓库路径或镜像）+ PG_PASSWORD 等 |
| D | `buildingos dev` 命令 | 等于 `docker compose up`（在租户工作区检测 compose）+ 打开浏览器 |
| E | （后置）热加载 + 引擎 run() 桥 | watch 租户文档 → 自动 validate/compile → 控制台刷新；引擎对话（M1.5 ③） |

## 5. 待确认决策点

1. **compose 放哪**：init 在租户目录生成 `docker-compose.yml`（自包含，符合"在目录中启动"）——推荐；备选：工具仓库 `deploy/`，租户引用。
2. **镜像 vs 挂载**：dev 模式**挂载工具源码**（改代码即生效，dogfooding 友好）；生产（M1.5 尾）再打镜像。
3. **PG 凭证**：进 `.env`（D21）——init 生成随机密码写入 `.env`，compose 引用 `${PG_PASSWORD}`。
4. **引擎对话优先级**：run() 桥（M1.5 ③）是否提前到本设计之后立即做，决定"直接开发"体验的完整度。
5. **场景栈分层**：核心栈（runtime + postgres）默认；TDengine/MQTT 按 IoT 模板 profile 启用（README 分层捆绑原则）。
