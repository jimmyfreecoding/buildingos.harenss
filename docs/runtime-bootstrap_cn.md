# BuildingOS Runtime 引导与配置（M1 设计稿 v0.1）

> 定位：runtime 首启引导（bootstrap）与配置分层设计——写代码前的最后一个设计块，衔接 normalizer（加载租户文档）与 adapter（接引擎）。
> 决策：b1 配置三分（D21）/ b2 秘密 M1 env 注入 + M2 secret store / b3 M1 CLI 向导（admin web 归 M3）/ b4 dev 与 prod 同一 runtime 双姿态。
> 关联：[configs.schema](../schemas/configs.schema.md)、[normalizer-design.md](normalizer-design.md)、[tenancy-model.md](tenancy-model.md)、[契约哲学](../契约哲学.md) D21。

## 1. 配置三分（D21，铁律：钥匙不进仓库）

| 层 | 内容 | 存放 | 例子 |
|---|---|---|---|
| **引导配置**（bootstrap） | 首启时的选择与凭证输入 | 本地 bootstrap 会话（CLI 向导） | 选引擎、选模型、输入 token |
| **文档配置** | 应用的行为与参数（选择结果） | **Git**（`configs/runtime.yaml`） | engine、model、mcp_servers、sandbox、approval |
| **秘密配置** | token、凭证 | **env 注入 / secret store，不进 Git** | MODEL_TOKEN、GIT_TOKEN |

- **铁律**：模型 token、git 凭证等秘密**绝不写入任何进 Git 的文件**（runtime.yaml、skill/rules/prompts 正文、知识文档都不行）。进 Git = 密钥入史，PR 评审可见、历史永久留存——整个治理模型毁于一旦（D14 同款哲学：没有例外）。
- 引导时：**选**（A/B → 文档配置）、**填**（C/D → 秘密配置）、**指**（指向租户仓库）。
- 运行时：**读**文档配置（normalizer 加载）+ **注入**秘密配置（env）。

## 2. 首启引导流程（CLI 向导，M1）

```
buildingos init
  1. 选引擎（dsh / codex）          → 检查本地 adapter 可用性（conformance 状态）
  2. 选模型                         → 从引擎支持的模型目录选择（codex model/list；DSH 模型配置）
  3. 配置模型凭证：输入 token       → 写 .env（本地，.gitignore）
  4. 配置 git 凭证：输入 token      → 写 .env（或复用系统凭据/gh auth）
  5. 指向 / 初始化租户仓库：
     - 已有仓库：git clone + 指向
     - 新仓库：生成 .buildingos/ 骨架（rules/skills/prompts/configs/knowledge + 示例）
  6. 校验：loadTenantDocs（normalizer）→ diagnostics（error 阻断 / warning 提示）
  7. 进入 runtime（dev 模式）
```

**引导产物**：

| 产物 | 层 | 内容 |
|---|---|---|
| `configs/runtime.yaml` | 文档配置（进 Git） | engine / model / sandbox / approval / mcp_servers / ui / memory（configs.schema 初始实例） |
| `.env`（.gitignore） | 秘密配置 | MODEL_TOKEN、GIT_TOKEN（M1 env 注入） |
| 仓库指向 | 引导配置 | 租户仓库路径 / remote（本地状态，不进 Git） |

## 3. 秘密管理（M1 env 注入）

- **注入点**：runtime 进程启动时读 `.env` → 注入 adapter 的引擎调用（DSH 模型 API、Codex model provider）与 git 操作（拉取/推送租户仓库）。
- **configs.schema 衔接**：`mcp_servers[].env` 字段即此通道（"敏感值不入 Git，走部署时注入"）——M1 保持 env，M2 集成 secret store（Docker secrets / K8s secrets），env 通道不变，只换来源。
- **交付件**：仓库提供 `.env.example`（键名清单，无值），绝不提供 `.env`。

## 4. dev / prod 双姿态（同一 runtime）

| | dev runtime | prod companion（M5.5） |
|---|---|---|
| 部署 | 本地进程 / 开发容器 | 生产服务器伴生 |
| 职责 | 加载租户仓库 → normalizer → TenantDocs → adapter → 引擎 run + 热加载 + 动态 UI | 观察 → 诊断 → Issue → PR（GitOps 闭环）+ 日志/健康/升级 |
| 文档/契约 | 同一套（schema 家族 + adapter-contract） | 同一套 |
| 入口 | `buildingos dev` | `buildingos serve --prod`（Ops API 面，§4.4） |

两种姿态共用：配置分层、normalizer、adapter、GitOps 模型——**一个 runtime，两种姿态**（b4）。

## 5. 引导 → 下游衔接

```
buildingos init（本设计）
  → runtime.yaml + .env + 仓库指向
  → loadTenantDocs（normalizer-design）→ TenantDocs
  → compile（adapter-contract §2–§5）→ EngineView
  → adapter run（接引擎，注入秘密）
  → runtime 就绪（dev 模式）→ M5 向导可执行（建系统/部署）
```

## 6. 与相邻里程碑的关系

| 里程碑 | 关系 |
|---|---|
| M3 内置前端 | admin web 的引导页/配置界面 = 本 CLI 向导的 web 形态（M1 不做，b3） |
| M5 新项目向导 | 本引导 = "runtime 起来之前"的最小配置；M5 = "建系统"（交付清单 → 部署文件）。两者衔接：bootstrap 完成 → runtime 就绪 → M5 向导可执行 |
| M1.5 Turnkey 交付 | 引导第 2 步的"推荐服务器配置/上传 yml"= 部署要求文档（自动生成）+ 用户覆盖（deploy/ 覆盖文件），属 Turnkey 交付面 |
| M5.5 生产伴生 | dev runtime 与 prod companion 是同一 runtime 双姿态（b4） |

## 7. 决策记录（M1 评审，已定）

| # | 议题 | 决策 |
|---|---|---|
| b1 | 配置分层 | **配置三分（D21）**：引导 / 文档（Git）/ 秘密（env，不进 Git）；钥匙不进仓库是安全底线 |
| b2 | 秘密存储 | **M1 env 注入 + M2 secret store**（env 通道不变，只换来源） |
| b3 | 引导交互形态 | **M1 CLI 向导**；admin web 引导归 M3 内置前端 |
| b4 | dev/prod 关系 | **同一 runtime 双姿态**（dev runtime / prod companion），共用文档与契约 |

## 8. 待定项

| # | 议题 | 归属 |
|---|---|---|
| R1 | 模型目录来源：codex `model/list`（mcp-server RPC）vs DSH 模型配置——首启第 2 步的数据源 | M1 adapter 实施时定 |
| R2 | git 凭证细化：`.env` vs 系统凭据 vs `gh auth` 复用 | M1 实施时定 |
| R3 | 无人值守引导（`--non-interactive` + env 预设） | M2 |
| R4 | bootstrap 与 M5 向导的衔接顺序（是否 `init` 后直接进新项目向导） | M5 设计时定 |

## 9. Changelog

| 版本 | 说明 |
|---|---|
| v0.1 | 设计稿：配置三分（D21）、CLI 首启引导 7 步、秘密管理（env 注入）、dev/prod 双姿态、下游衔接、决策记录（b1–b4）、待定项（R1–R4） |
