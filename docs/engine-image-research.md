# BuildingOS 引擎镜像调研笔记（M1.5 引擎优先 compose）

> 目的：为"租户 compose 以所选引擎 harness 为主（BuildingOS 自建镜像），
> 项目画像驱动配套组件"这个方向，先落调研依据。明天据此对齐后开工。
> 状态：调研记录，非设计定稿。

## 【已定】D22 引擎安全基线（2026-11，已写入契约哲学）

- 引擎容器**绝不暴露非回环端口**；BuildingOS 是唯一认证入口
- 触发背景：QVD-2026-57410（dsh /api 靠可伪造 Host 头守护 → 未授权 RCE，CVSS 9.8）
- 详见 [contract-philosophy.md](contract-philosophy.md) §5 D22

## 【用户澄清后】完整流程（目标形态）

```
① 用户确定 workspace 目录
② 项目画像（选类型/行业/能力）
③ 生成 compose —— 包含：
     · 所选引擎的 harness（dsh | codex）  ← 主角
     · 按画像选出的其他服务器组件
④ harness 已内置 skill/md 等文档        ← 关键！
⑤ docker compose up → 一个能运行的"该项目 AI 框架"
```

**第④点是核心**：harness 容器直接加载租户目录 `.buildingos/` 的文档
（skills/rules/prompts/configs）。即 normalizer → adapter.compile() → engine view
喂给 harness 作为装配/能力配置——文档即配置，引擎消费这些 md。这才是
"封装 harness 作为 AI Server + 项目框架开箱即用"的完整闭环。

**验收标准**：`docker compose up` 后，得到一个带该项目 skill/knowledge 配置、
能跑起来与 AI 交互的项目 AI Server 框架。

## 结论（供明天确认的骨架）

**租户 `docker-compose.yml` 新结构：**

```
services:
  dsh              # ← 所选引擎（dsh | codex）的 harness 容器，核心服务
  postgres         # ← 配套组件，由"项目画像"勾选决定是否包含
  tdengine         #    （IoT 场景）
  mqtt             #    （IoT 场景）
  ...
```

1. **核心服务 = 所选引擎的 harness**（BuildingOS 自建镜像，封装上游仓库）
2. **配套组件 = 预定义模板库，按"项目画像"生成的子集**（不是固定 postgres）
3. **项目画像**并入 init 向导：选项目类型/行业/需要的能力 → 决定组件集合

## DSH 关键事实（已源码确认，2026-08 快照）

- **产品形态**：`dsh --profile <name>` / `dsh --profile headless "job"` / `dsh web`
  - `--profile headless "task"` = 跑一个全新持久会话，打印最终答案后退出
  - `dsh web` = `--profile web` 的别名（web 应用，`--port` 等参数是 app 的）
- **核心是 cordis 配置驱动**：`cordis.yml` / `cordis.patch.yml` 装配插件栈
  - profile 目录 = `package.json` + `dsh.profile`（有序 `bundles` 列表）+ `cordis.patch.yml`
  - bundle 顺序拼装 → profile 的 patch → `$DSH_HOME/cordis.patch.yml` → `--patch` 覆盖
  - bundles 解析顺序：dsh 安装里的 `@deepseek-ai/dsh-*` 优先，再 profile 自身 node_modules
- **构建**：生产运行需 `pnpm run build`（源码执行另看 reference），前端产物也要构建
- **headless 示例**：`examples/headless-agent/cordis.yml` 定义 DeepSeek V4 + local bash/fs tools + subagent + workflow + JSONL 持久化
- **E2B overlay**：`e2b.cordis.yml` 把本地 fs/subprocess provider 替换成共享 E2B sandbox（POC，非整体迁移）

→ **BuildingOS dsh 镜像** = node 基础 + DSH 仓库 build + `dsh` CLI + 一个 profile（默认 headless/web）作为入口。

## Codex 关键事实（此前已确认，commit d21794d6）

- **形态**：`codex` CLI 作为 coding agent；`codex mcp-server`（实验性）→ 服务器形态
- **知识模型**：`AGENTS.md`（层级）+ `SKILL.md` + `openai.yaml` + `references/`，无 ACP
- **原生记忆**：`MEMORY.md`
- 无官方 Dockerfile/官方容器化形态（需 BuildingOS 自建，参考 headless/CLI 用法）

## BuildingOS 自建镜像的形态（待明天确认细节）

- **dsh**：`FROM node:<lts>` → clone/build `deepseek-harness` → 全局装 `@deepseek-ai/dsh` →
  预置 `web` 或 `headless` profile → `ENTRYPOINT ["dsh", "--profile", "web"]`
  （web 形态面向 BuildingOS 的"AI Server"；headless 面向一次性任务）
- **codex**：`FROM rust/debian` → build codex → `ENTRYPOINT ["codex", ...]` 或 `codex mcp-server`

## 待明天澄清的点

1. **引擎容器入口**：BuildingOS 控制台连的是 DSH 的 web 端口（8080）还是 headless（一次任务）？
   → 决定自建镜像的 profile 与暴露端口
2. **引擎 run() 桥**：自建镜像要让 BuildingOS 的 `adapter.run()` 能驱动引擎
   —— dsh（web/ACP?）vs codex（mcp-server），这两个桥是"直接开发"体验的前提
3. **项目画像的字段**：组件模板库（postgres/tdengine/mqtt/...）的确切清单 + 每个画像的映射
4. **镜像构建归属**：`buildingos dev` 里 `docker build` 各引擎镜像（沿用当前逻辑），
   还是 `docker compose up` 时按需 pull/build？
