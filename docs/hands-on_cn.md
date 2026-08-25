# BuildingOS 自行体验指南（Hands-on）

> 在你自己的机器上跑完整流程：安装 → init 租户 → validate/compile/conformance →
> 拉起 Docker 开发环境 → 在容器里开发。
> English: [hands-on.md](hands-on.md)

## 0. 前置条件

| 工具 | 版本 | 检查命令 |
|---|---|---|
| Node.js | ≥ 18（推荐 v22+） | `node --version` |
| pnpm | ≥ 9（CI 用 v11） | `pnpm --version` |
| Git | 任意较新版本 | `git --version` |
| Docker Desktop | 已启动（引擎在线） | `docker info --format '{{.ServerVersion}}'` |

如果本机 **5432 端口已被占用**（很常见——已有 Postgres 在跑），dev 环境会报错，
用 `PG_PORT` 换一个空闲端口即可（见 §5）。

## 1. 拿到工具

```bash
git clone <你的-buildingos-仓库> && cd buildingos.harenss
pnpm install
pnpm build          # 必须一次——bin 指向 dist/cli.bundle.cjs
pnpm test           # 60 个测试——全绿
```

现在有两种方式跑 CLI：

```bash
node cli/dist/cli.bundle.cjs <cmd>   # 直接跑（任意目录）
pnpm exec buildingos <cmd>           # 通过工作区 bin（工具仓库内）
```

想永久安装：先 `pnpm setup` 一次，然后 `cd cli && pnpm pack && pnpm install -g ./buildingos-cli-0.1.0.tgz`，
之后任意目录直接 `buildingos <cmd>`。

> 注意：**从工具仓库运行** CLI 时，`init` 会自动探测仓库路径并写进租户的
> docker-compose.yml，`docker compose up` 零配置可用；全局安装时 compose 需要
> `BUILDINGOS_TOOL_DIR`（见 §5）。

## 2. Init 一个租户工作区（工具不是项目）

选一个**工具仓库之外**的目录——租户才是你的项目：

```bash
mkdir ~/my-tenant && cd ~/my-tenant
buildingos init            # git-init 风格：直接脚手架进当前目录
```

交互式向导按顺序问：

| 步骤 | 问题 | 写入位置 |
|---|---|---|
| 0 | 选择语言（中文 / English） | — |
| 1 | 选引擎（dsh / codex） | `.buildingos/configs/runtime.yaml` → `engine:` |
| 2 | 选模型（内置起始目录或自定义） | 同一文件 → `model:` |
| 3 | 模型 API token | `.env` → `MODEL_TOKEN`（绝不进 Git，D21） |
| 4 | Git token（留空 = 跳过） | `.env` → `GIT_TOKEN` |
| 5 | 脚手架租户仓库 | `.buildingos/`、`knowledge/`、`.gitignore`、`docker-compose.yml`、`.env` |
| 6 | 校验（normalizer） | 诊断输出 |
| 7 | 总结与下一步 | — |

生成的租户：

```
my-tenant/
├── .buildingos/          # AI 应用的大脑（文档即代码）
│   ├── rules/            # 边界——hard 规则派生权限（D6）
│   ├── skills/           # 能力（how-to know-how）
│   ├── prompts/          # 人格（语气、语言）
│   └── configs/          # runtime.yaml——引擎/模型/沙箱/审批
├── knowledge/            # 世界模型——人工评审的事实知识（D19）
├── docker-compose.yml    # 开发环境：buildingos-runtime + postgres（M1.5 ②）
├── .env                  # 秘密：MODEL_TOKEN / GIT_TOKEN / PG_PASSWORD（绝不进 Git，D21）
└── .gitignore
```

## 3. 跑文档流水线

```bash
buildingos validate .             # 加载 + lint（schema 校验、ORDER_DUPLICATE D20……）
buildingos compile --engine dsh . # 渲染 DSH 引擎实际消费的形态
buildingos compile --engine codex .
buildingos conformance .          # 编译产物 vs golden 基线（G1）
```

改一个 skill 再校验，感受开发循环：

```bash
# 例如给 hello 技能追加一步，然后：
buildingos validate .
buildingos compile --engine dsh .
```

## 4. 拉起开发环境

```bash
buildingos dev            # = 租户内 docker compose up（首次构建镜像，需几分钟）
```

如果 5432 被占用：

```bash
PG_PORT=55432 buildingos dev      # PowerShell: $env:PG_PORT='55432'; buildingos dev
```

你会得到：

```
buildingos-runtime   node 容器，内置全局安装的 `buildingos` CLI，
                     /workspace = 你的租户（实时双向挂载）
postgres             :5432（或 PG_PORT）——状态库；密码在 .env，绝不进 Git
```

## 5. 在容器里开发

```bash
docker compose exec buildingos-runtime buildingos validate
docker compose exec buildingos-runtime buildingos compile --engine dsh
docker compose exec buildingos-runtime buildingos conformance
# 或进入交互 shell：
docker compose exec buildingos-runtime sh
```

挂载是**双向的**：容器写入的文件（如 `engine-views/`）host 立刻可见；
你在 host 对 `.buildingos/` 的修改容器内也立刻生效。

## 6. 停止 / 清理

```bash
buildingos dev --down        # 或：docker compose down
docker compose down -v       # 连 postgres 数据卷一起删
```

## 7. 诚实边界

- **今天可用**：init 向导（语言优先）→ validate/compile/conformance → `buildingos dev`
  （docker compose up：CLI 容器 + postgres）。已用真实 Docker 验证。
- **待实现**：引擎 `run()` 桥（与 AI 对话——DSH ACP / Codex mcp-server，M1.5 ③）、
  know-how 热加载（M2）、动态 UI（M3）、生产伴生（M5.5）。
- **全局安装注意**：如果 `buildingos` 是全局安装的（不是从工具仓库运行），
  `buildingos dev` 无法自动定位工具仓库。要么从工具仓库跑一次 init，要么在
  `buildingos dev` 前设置 `BUILDINGOS_TOOL_DIR` 指向工具仓库路径。
