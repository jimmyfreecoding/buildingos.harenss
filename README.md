# BuildingOS

> **The AI-Native OS for Building Everything.**
>
> Where Enterprise AI Meets Git-Native Governance.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: Concept](https://img.shields.io/badge/Status-Concept_Phase-yellow)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

**English** | 🌐 [中文版](README_cn.md)

---

## 中文导读

BuildingOS 是一个面向企业级 AI 的开源 **Harness as a Service / Agent as a Service** 平台。一句话：**让 AI 应用像代码一样可构建、可治理、可演进**。

**关键定位：把 AI Agent 封装成企业内部的"AI Server"。** DSH、Codex 等 Harness 正在把 AI Agent 变成企业内部的 AI Server——持久运行、有工具边界、可被程序化调用。BuildingOS 在此基础上**再封装一层稳定边界**：对外暴露统一 API，对内用 Git 治理 Harness 的 Markdown 文件（Skills、Rules 等）。引擎可以是 DSH、Codex 或未来的任何 Harness，但团队面对的始终是一台稳定、可协作的服务器。**我们不造发动机，我们把发动机封装成标准接口的服务器。**

接入 BuildingOS 之后，**三步即可产出产品**：① **一键部署整套 AI Server 环境**——Docker Compose / K8s 交付件捆绑 PostgreSQL、TDengine、MQTT 等配套服务（引擎可换）；② 用 Git 快速编写与治理自己的 **know-how**——把操作规程、专家经验写成 `skill.md` / `rule.md`（本质就是 how-to 描述），像改代码一样评审、版本化、回滚；③ 预置"顶级 UI"的 Skill 与编码规则（规范文档），前端由 Harness **动态生成**——admin web、dashboard 等**开箱即用，直接出原型产品**。**整个系统没有一句代码：全部是规范文档与配置文档。**连适配器都不用手工维护——BuildingOS **钩住 DSH、Codex 等已收录引擎的开源版本发布，新版本一发布就自动构建、自动测试适配器**，引擎永远保持最新（收录新引擎仍是人工决策，属 M4 之后的社区流程）。**AI 原生的项目生命周期——连"建系统"本身也是 AI 驱动。** 新项目：向导以对话收集"你要做一个什么系统"，自动产出**交付清单**、生成 Docker 部署文件并部署；老项目：指向现有 GitHub 仓库或文件夹，自动识别前后端技术栈、由 Harness 梳理后生成（或复用）部署文件并部署；运行中：改 `skill.md` / `rule.md` → PR → 热加载，系统持续演进。**从 demo 到企业级部署，全程由 Harness 迭代出来。**

**生产环境同样是 Harness 的主场。** 部署时自动给出生产环境部署要求与防火墙开放要求，附运行与升级方案；生产/测试服务器上同时运行这套 Harness，用于日志查看分析、bug 修复等日常运维——修复走完整闭环：服务器 Harness 查日志 → 提交 Issue → 开发机改代码 → 提交 Git → PR → GitHub 验收 → Action 构建镜像 → 服务器 git pull / docker pull → docker up。

普通团队不需要追逐每周都在变的 AI 技术栈——他们要的是一台拿来就能用的服务器，和一份马上能写的 know-how。

### 一句话定义

> 我们不训练大模型，我们让模型在企业里"好好工作"；我们不开发 Harness，我们让现有的 Harness 在企业里"好好被治理"；我们封装 AI Server，让团队像用数据库一样用 AI——**你只负责写 know-how（skill.md / rule.md），开箱即出原型。**

### 为什么是 Harness，而不是 Vibe Coding？

企业级 AI 后端正在经历三个时代的演进：

1. **胶水层时代**（LangChain / 链式调用）—— 模型是被动响应的工具；
2. **自主 Agent 时代** —— Agent 有了记忆、身份和自主调度，成为"数字员工"；
3. **Harness 时代（工程化治理）** —— 模型只是"引擎"，真正决定成败的是它外围的工程体系：系统提示词、上下文管理、权限控制、工具调用边界。

Vibe Coding 追求快速原型，适合个人开发者；企业级应用需要的是**确定性、可审计性、可回滚性**——这正是 Harness 模式的价值。**未来企业级 AI 应用，必定建立在 Harness 层之上。**

### 架构一览（三层分离、以 Git 为核）

- **治理与配置层（Git-Native Brain）**：每个客户一个私有 Git 仓库，仓库里的 `Rules`（宪法）、`Skills`（技能）、`Prompts`（人格）、`Configs`（配置）就是应用的"源代码"；变更走 PR → 评审 → 合并 → 热加载，天然实现版本控制、审计与回滚。
- **集成与编排层（BuildingOS Runtime）**：不自研引擎——通过适配器接入现有 Harness（DSH、Codex 等）作为可替换的执行引擎，负责租户解析、Rules/Skills 装配、上下文构建与权限策略下发，并把各引擎**封装成一台暴露稳定 API 的 AI Server**。适配器**自动跟踪上游引擎版本并自动构建**，无需人工维护。
- **交互层（Surface）**：预置"顶级 UI"的 Skill 与编码规则（规范文档），前端由 Harness **动态生成**——admin web、dashboard 等开箱即出原型；同一后端可驱动多端界面。**整个系统没有一句代码：全部是规范文档与配置文档。**

### 开源战略

- **开源核心（Open Core）**：BuildingOS 自身的集成与治理层开源（Apache 2.0），并向上游 Harness 社区（DSH、Codex 等）做贡献，**不重复造轮子**。
- **商业增值**：HaaS 控制平面——企业级多租户管理、高级权限控制、专属支持与私有化部署。
- **社区驱动**：为医疗、金融、制造、IoT 提供行业模板包；帮助社区为更多 Harness 编写适配器。

> 当前仓库处于 **Concept 阶段**：README 描述的是愿景与目标架构，代码与 Schema 正在设计中（详见 [Roadmap](#project-status--roadmap)）。

---

## Table of Contents

- [What is BuildingOS](#what-is-buildingos)
- [The Paradigm Shift: Why Harness, Not Vibe Coding](#the-paradigm-shift-why-harness-not-vibe-coding)
- [Architecture](#architecture)
- [AI as Code: The Git-Native Governance Model](#ai-as-code-the-git-native-governance-model)
- [Comparison](#comparison)
- [Quick Start](#quick-start)
- [Project Status & Roadmap](#project-status--roadmap)
- [Open Source & Business Model](#open-source--business-model)
- [About the Name & Brand](#about-the-name--brand)
- [Community & Contributing](#community--contributing)
- [License](#license)

---

## What is BuildingOS

**BuildingOS is an open platform that turns existing AI harnesses (DeepSeek Harness / DSH, Codex harness, and more) into one standard enterprise asset: an internal AI Server with a stable API, Git-managed Markdown governance, and a dynamically generated UI (driven by preset UI skill & coding rules) — so teams ship a prototype by writing documents, never code.**

| | |
|---|---|
| **Not a model** | We do not train LLMs. We make models *work properly* inside an enterprise. |
| **Not a chat UI** | We provide the *backend operating system* and *governance framework* for AI applications. |
| **Not a library** | LangChain/LlamaIndex are dev toolchains; BuildingOS is the runtime and governance layer. |
| **Not a harness engine** | We do **not** build a harness. We integrate existing ones — DeepSeek Harness (DSH), Codex harness, and more — behind a uniform adapter interface, as pluggable execution engines. |
| **Not another framework** | We do not add to the tooling churn. We freeze a stable boundary around it: one API, one governance model, engines underneath. |
| **Know-how first** | After deployment, the work is writing your know-how: `skill.md` / `rule.md` are how-to descriptions — SOPs, expert experience — governed by Git like code. |
| **Self-maintaining adapters** | Adapters auto-track *adopted* engines only (DSH, Codex, …): upstream release hooks trigger an automated build + conformance test — engines stay current with zero manual maintenance. |
| **UI skills & dynamic front-end** | Top-tier UI ships as *documents*: preset UI Skills and coding rules. The harness generates the front-end from them per task and role — admin web, dashboards, prototype out of the box, zero front-end code. |
| **Turnkey delivery** | Ships as Docker Compose / Helm charts bundling the supporting servers the project needs (PostgreSQL, TDengine, MQTT broker, …) — one command brings up the whole AI server environment. |
| **AI-native project lifecycle** | The harness builds the system itself: a new-project wizard turns "what do you want to build?" into a **delivery manifest** → generated deploy files → auto-deploy; an existing-project wizard analyzes a repo/folder, detects the stack, and deploys; runtime changes iterate via Git. Demo to enterprise, all driven by the harness. |
| **Is an AI Server platform** | Harnesses turn agents into enterprise AI servers; BuildingOS wraps that server — a stable API boundary, Git-managed Markdown (rules/skills), pluggable engines. Teams integrate AI like they integrate a database, without chasing the stack. |
| **All documents, zero code** | Everything the team writes and governs is a document: behavior rules, UI skills, configs. No code — the kernel is the only implementation, and it is a commodity. |
| **Production ops companion** | The harness deploys alongside the app in production/test: it auto-provides deployment requirements, firewall opening requirements, and run & upgrade plans, and runs on the production server for log viewing, analysis, and bug fixing — fixes flow through the full GitOps loop (observe → issue → PR → CI build → pull → docker up). |

Core belief: **the whole system is documents — specification and configuration only.** Behavior is defined in a customer-owned Git repository (as Markdown rules/skills); the front-end is dynamically generated from preset UI skill and coding-rule documents; the AI Server — the only implementation — is the stable, swappable boundary, exposed as a stable API and surfaced through the generated UI, prototype-ready.

---

## The Paradigm Shift: Why Harness, Not Vibe Coding

Enterprise AI backends are going through a paradigm shift — from *"how to call a model"* to *"how to make a model complete enterprise work reliably, controllably, and governably."*

### Three eras

| Era | Pattern | Characteristics |
|---|---|---|
| **1. Glue Layer** | Single LLM calls & LangChain | Chain-based calls connecting LLM to tools/data. Models are *passive responders* — no long-term memory, no autonomous planning. |
| **2. Autonomous Agent** | "Claw" mode | Persistent storage, identity, autonomous scheduling (e.g. cron jobs). Agents gain *long-term memory* and *proactive execution* — from chatbot to **digital employee**. |
| **3. Harness** | Engineering governance | As models get stronger and scenarios get complex, the industry realizes the model is only the *engine*. The surrounding engineering system — **system prompts, context management, permission control, tool-call boundaries** — determines whether AI runs reliably on the production line. The harness is that *constraint engineering*: an operating system around the brain. |

### The thesis

> **Future enterprise AI applications will be built on top of a harness layer.**

The LLM is the *brain*; the harness is the *body and nervous system* that carries it.

**Why not Vibe Coding?** Vibe coding is excellent for rapid prototyping by individual developers. Enterprise AI requires determinism, auditability, and instant rollback — properties that conversation-driven development cannot provide, but that Git-native governance can.

**And why not build your own harness?** Harness engineering is deep, fast-moving, and already solved by strong open source projects (DSH, Codex, …). BuildingOS's bet is that the winning move is to **integrate the best existing harnesses** and make them enterprise-ready — not to reinvent them. This is what "Harness as a Service" means here: the engines are interchangeable commodities; the governance is the product.

### The paradigm: from agent to AI server

DSH, Codex, and their peers are converging on the same move: turning an AI agent into an **AI server** inside the enterprise — a persistent runtime with identity, tools, memory, and boundaries, callable programmatically by the rest of the organization instead of living in a chat window (Claude Agent SDK's *hosting* model and OpenAI's open *Harness* are early signals of this race).

BuildingOS sits one layer above. It **encapsulates the AI server** behind a boundary your team never has to look past:

| The team needs | Who provides it |
|---|---|
| A stable API to call AI | BuildingOS — uniform, independent of the engine |
| A way to review & audit AI behavior | Git + Markdown rules/skills, PR-based |
| A product UI to show stakeholders | BuildingOS preset UI skills → dynamically generated front-end |
| The actual agent runtime | DSH / Codex / future harnesses — pluggable |

### Why teams can't just "use the harness directly"

AI tooling moves too fast for ordinary teams. Frameworks, model APIs, and harness releases change weekly; last quarter's best practice is this quarter's deprecation notice. Individual developers can ride the wave — a team cannot standardize on a moving target.

Git, Markdown, and a stable API, by contrast, are slow, well-understood standards. BuildingOS deliberately pushes all the volatility behind the server boundary: **the engine can be swapped, upgraded, or replaced — the API and the Git governance model do not change.** Even the adapters that track upstream releases are built and tested automatically — your team never watches the upstream changelog. That is what makes team collaboration possible: everyone works against a server contract, not against the latest harness release.

### What you actually build: your know-how, operationalized

Once the AI server is deployed, the remaining — and most valuable — work is writing **how-to knowledge**: `skill.md` describes *how to do something* (a diagnostic procedure, a compliance check, a sales playbook); `rule.md` describes *how to behave within boundaries*. Together they encode the enterprise's **know-how** — the proprietary procedures and expert experience that competitors cannot copy.

BuildingOS makes this the primary activity:

- **Markdown, immediately**: know-how is written in the language your experts already use, not in framework APIs.
- **Git discipline, familiar**: PRs, reviews, versions, rollbacks — the same rigor your code already has.
- **A product appears**: the harness generates the product surface from preset UI skill and coding-rule documents — the same repo produces a working UI out of the box.

The insight: in the AI server era, the server is a commodity (pick DSH or Codex) and the API is a commodity (provided by BuildingOS) — **the only non-commodity is your know-how.** BuildingOS exists to make encoding it fast, governed, and prototype-ready.

### The AI-native lifecycle: the harness builds the system itself

BuildingOS doesn't only run your AI server — the harness also builds the system around it:

- **New-project wizard**: tell it, conversationally, what you want to build → it produces a **delivery manifest** (交付清单) → generates Docker deployment files → deploys automatically.
- **Existing-project wizard**: point it at a GitHub repo or a folder → it detects the frontend/backend stack → the harness analyzes and organizes the project → generates deployment files (or reuses existing ones) → deploys.
- **Runtime iteration**: while the system runs, change know-how (`skill.md` / `rule.md`) → open a PR → hot reload — the system evolves without downtime.
- **Demo → enterprise**: the same loop scales. Start as a demo, iterate the manifest and know-how through Git, grow into an enterprise-grade deployment — all through the harness.

Everything the wizard produces — the delivery manifest, the generated deployment files — is code in the tenant repo, subject to the same PR governance as rules and skills. The insight: **the platform is its own first user.** "AI-native" here does not mean an AI feature bolted onto software; it means AI as the *builder* of the software.

### The production loop: the harness operates what it built

The deployed environment is a Harness environment too. Because the whole system deploys from harness-generated Docker, a BuildingOS harness runs **alongside** the app in production and test:

- **Auto-generated ops documents**: deployment requirements, firewall opening requirements, run & upgrade plans are produced automatically — and, true to the model, they are *documents* in the repo, updated as the system evolves.
- **Daily ops on the production server**: the harness there reads logs, analyzes failures, and proposes fixes — no blind SSH grepping.
- **The fix loop, always through Git**:

```
Production harness observes (logs / health)
  → diagnosis & config change proposal → files an Issue
  → dev machine fixes code → git commit → open PR
  → GitHub review & acceptance → CI/Action builds image
  → server git pull / docker pull → docker up
```

The production harness observes and proposes; it never writes to production directly. Every fix — code or configuration — travels the governed GitOps path, so production changes are as auditable as development changes. **The environment that runs the AI is itself operated by the AI.**

---

## Architecture

Three layers, separated by responsibility, with **Git at the core** — and existing harness engines beneath the runtime, plugged in via adapters.

```mermaid
flowchart TB
    subgraph A [Surface Layer]
        UI[Dynamically Generated UI<br>From preset UI Skill & Coding Rules<br>Documents only - zero code]
    end

    subgraph B [BuildingOS Runtime<br>Integration & Orchestration]
        direction LR
        ORCH[Orchestration & Governance<br>Tenant / Context Assembly / Policies]
        AD[Harness Adapters<br>DSH Adapter | Codex Adapter | More]
    end

    subgraph E [Existing Harness Engines]
        DSH[DeepSeek Harness - DSH]
        CX[Codex Harness]
        ETC[... more engines]
    end

    subgraph C [Governance & Config: Git-Native Brain]
        G[(Customer Private Git Repo<br>One Tenant = One Repo)]
        subgraph G_content [Repo Content = Application Source Code]
            Rules[Rules<br>.buildingos/rules/]
            Skills[Skills<br>.buildingos/skills/]
            Prompts[Prompts<br>.buildingos/prompts/]
            Configs[Configs<br>.buildingos/configs/]
        end
    end

    A -- user intent --> ORCH
    ORCH -- read/write config & state --> G
    G -- change-driven hot reload --> ORCH
    ORCH -- dispatch via adapters --> AD
    AD -- native execution --> E
    E -- results --> ORCH
```

### C1. Governance & Config Layer — Git-Native Brain

**Idea: AI application behavior = code.**

- **Multi-tenancy**: each customer owns an isolated private Git repository — natural data & configuration isolation.
- **Declarative configuration**: `/rules` define the AI *constitution* (boundaries & constraints); `/skills` define the AI *capabilities* (tool-calling specs); `/prompts` define the AI *personality*; `/configs` define runtime behavior.
- **GitOps governance**: every change flows through a Pull Request — reviewed, compliance-checked, then merged. Full version control, audit trail, and instant rollback.

### B1. BuildingOS Runtime — Integration & Orchestration

**Idea: read the "code", dispatch the "intelligence" — to engines we don't own.**

- **Pluggable harness engines**: existing harnesses — DeepSeek Harness (DSH), Codex harness, and more — are integrated behind a uniform adapter interface. Engines are interchangeable per tenant or per workload; new engines are added by writing an adapter, not by building an engine.
- **Self-maintaining adapters (adopted engines)**: for engines already adopted (DSH, Codex, …), upstream release hooks trigger an automated adapter build + conformance test suite. Green → the adapter ships automatically; red → alert with the last-known-good version pinned. Engines stay current without manual maintenance. Adopting a brand-new engine remains a deliberate, community-reviewed act — out of the automation scope.
- **Turnkey packaging**: the runtime ships as a ready stack — Docker Compose for single-node, Helm charts for Kubernetes — bundling the supporting servers the project needs (PostgreSQL, TDengine, MQTT broker, …). Teams bring up a complete AI server environment with one command; they never assemble infrastructure.
- **Production companion**: the runtime deploys beside the app in production/test — auto-generated deployment & firewall requirements, run & upgrade plans, on-server log analysis and bug-fix orchestration, with every fix flowing through the GitOps loop (observe → issue → PR → CI build → pull → docker up).
- **Adapter layer**: each adapter maps tenant Rules / Skills / Prompts into the engine's native configuration (system prompt, context, tool / MCP registration, permission boundary) and normalizes results back into a uniform shape.
- **Dynamic context construction**: assembled from user intent + tenant repo, then delivered in each engine's native form — precise, token-efficient, higher output quality.
- **Uniform policy enforcement**: permission & sandbox policies from `.buildingos/configs` are enforced across engines, independent of engine-specific features.

### A1. Surface Layer — Dynamic UI from Documents

**Idea: top-tier UI ships as documents; the harness renders it per task and role.**

- **Preset UI skills & coding rules**: common enterprise surfaces (admin console, dashboards, skill/rule management UI) are pre-defined as *documents* — UI Skills and coding rules encoding top-tier design practices — not as hard-coded pages.
- **Dynamic generation**: the harness compiles those documents into the actual UI for the current task, user role, and repo config. Change a rule document → the UI changes. Zero front-end code anywhere in the system.
- **Governance surfaces**: the same generated UI exposes the Git loop — browse skills/rules, open a PR to change behavior, review and rollback — making "know-how as code" visible to non-engineers too.
- **Multi-surface (direction)**: the same backend drives Web, mobile, or voice interfaces.

---

## AI as Code: The Git-Native Governance Model

### Repository layout

A customer's repo is the *source code* of their AI application:

```
<customer-repo>/
└── .buildingos/
    ├── rules/        # The AI "constitution" — boundaries & constraints (.md)
    │   └── boundaries.md
    ├── skills/       # The AI "capabilities" — tool-calling specifications (.md)
    │   └── network-diagnose.md
    ├── prompts/      # The AI "personality" — system-prompt fragments (.md)
    │   └── persona.md
    └── configs/      # Runtime configuration — engine, model, permissions
        └── runtime.yaml
```

### Proposed schema (illustrative — being finalized)

> **Markdown-first**: skills, rules, and prompts are human-readable Markdown — the same format DSH and Codex harnesses already speak — with structured metadata in YAML frontmatter. Markdown is what makes a PR review readable by engineers, compliance, and business people alike. (The YAML snippets below are simplified stand-ins for the Markdown + frontmatter form.)

```yaml
# .buildingos/rules/boundaries.yaml
# Hard constraints the runtime enforces across engines.
version: 1
rules:
  - id: no-data-exfiltration
    description: Never send customer data outside the tenant boundary.
    scope: all
    enforce: hard        # hard | soft
  - id: read-only-by-default
    description: Destructive tool calls require explicit user confirmation.
    scope: tools
    enforce: hard
```

```yaml
# .buildingos/skills/network-diagnose.yaml
# How the agent invokes tools for a specific capability.
version: 1
skill:
  id: network-diagnose
  description: Diagnose switch / AP health from network telemetry.
  tools:
    - mcp://telemetry/query-switch-status
    - mcp://telemetry/query-ap-latency
  context:
    include: [topology.yaml, device-inventory.yaml]
  steps:
    - Query switch status
    - Correlate with topology
    - Report findings with confidence
```

```yaml
# .buildingos/prompts/persona.yaml
# The AI "personality" — composed into the engine's system prompt.
version: 1
persona:
  id: ops-engineer
  language: zh-CN
  tone: professional, concise
  conduct:
    - Report confidence; never fabricate data.
    - Return structured JSON for operational results.
    - Read-only by default; self-heal only with written authorization.
```

```yaml
# .buildingos/configs/runtime.yaml
# Engine selection, MCP servers, permissions, UI.
version: 1
runtime:
  engine: dsh            # dsh | codex | ... — engines are pluggable
  model: gpt-4o          # provider-agnostic model handle
  mcp_servers:
    - name: telemetry
      endpoint: mcp://telemetry.internal
  permissions:
    allow: [read:*]
    deny: [write:router]
  ui:
    theme: dark
    surfaces: [web, mobile]
```

### The change workflow (GitOps)

```
Edit Rules/Skills → Open PR → Review (engineering/compliance/business)
   → CI checks (schema lint, permission impact, dry-run)
   → Merge to main → Webhook → Runtime hot-reload → Re-dispatch to engine
```

Every AI behavior change is a first-class software change: **versioned, reviewed, auditable, and revertable with a single `git revert`.**

### Multi-tenancy

One customer = one private repository. Each tenant's AI has its own constitution, capabilities, personality, engine, and permissions — isolated by construction, customizable per business.

---

## Comparison

| | LangChain / LlamaIndex | Vibe Coding | Harness.io | BuildingOS |
|---|---|---|---|---|
| **What it is** | Dev library / toolchain | Rapid prototyping style | Software-delivery DevOps platform | AI Server platform (encapsulates harnesses) |
| **Engine** | Your code calls an LLM | Ad-hoc LLM calls | Own delivery platform | **Reuses existing harnesses** (DSH / Codex / …) |
| **Engine updates** | Manual | n/a | Vendor-managed | **Auto-tracked & auto-built** (zero manual maintenance) |
| **Delivery** | pip install | n/a | SaaS / own pipelines | **Turnkey stack** (Compose / Helm, bundled PG / TDengine / MQTT) |
| **Project onboarding** | Code from scratch | Conversation only | Pipeline config | **AI wizard**: delivery manifest → deploy files → auto-deploy |
| **Production ops** | n/a | n/a | Delivery pipelines | **Harness in production**: logs, diagnosis, upgrade loop via Git |
| **Integration surface** | Code APIs | Conversation | Delivery pipelines | Stable server API + Git |
| **Source of truth** | Your code | Conversation | YAML delivery pipelines | Git repo (rules/skills/prompts) |
| **Governance** | None built-in | None | Delivery-focused | AI *behavior* governance |
| **Auditability** | Code reviews only | None | Delivery pipelines | PR-based, every behavior change |
| **UI** | You build it | Ad-hoc generated | You build it | **Dynamically generated** from preset UI skill rules (zero code) |
| **Target** | AI developers | Individual developers | DevOps teams | Enterprise AI teams, any industry |

---

## Quick Start

> **TODO**: This section will be filled in once the MVP exists. Nothing here is runnable yet.

### Prerequisites

- [ ] TODO: an existing harness engine (e.g. DeepSeek Harness / DSH, Codex harness)
- [ ] TODO: define runtime requirements (Node / Go / Docker…)

### Install

```bash
# TODO: installation command once the BuildingOS runtime is released
```

### Run your first agent

```bash
# TODO: bootstrap a tenant repo and start the runtime against your harness engine
```

### Create your first Skill

- [ ] TODO: scaffold `.buildingos/skills/hello.md`
- [ ] TODO: open the built-in admin/dashboard and see your first prototype

---

## Project Status & Roadmap

**Current status: Concept phase.** The README defines the vision and target architecture. Code and schema are being designed.

| Milestone | Scope | Status |
|---|---|---|
| **M0** | `.buildingos/` schema specification (rules / skills / prompts / configs) | In discussion |
| **M1** | Harness adapters: integrate DeepSeek Harness (DSH) + Codex harness as pluggable engines, with **auto version tracking for adopted engines** — upstream release hooks → auto-build/conformance (no manual maintenance). New engine adoption is a deliberate, community-reviewed process (M4+) | Planned |
| **M1.5** | Turnkey delivery: Docker Compose + Helm charts bundling runtime, adapters, front-ends, and the support stack (PostgreSQL / TDengine / MQTT broker) — one command to a working prototype | Planned |
| **M2** | Git integration: webhook-driven hot reload, PR CI checks | Planned |
| **M3** | UI skill & coding-rule packs (top-tier UI as documents) + dynamic UI generation — prototype out of the box, zero front-end code | Planned |
| **M4** | HaaS control plane: multi-tenant management, SLAs + vertical template packs (healthcare / finance / manufacturing / IoT) | Planned |
| **M5** | AI-native project lifecycle: new-project wizard (delivery manifest → generated deploy files → auto-deploy), existing-project onboarding (stack detection → harness analysis → deploy), runtime iteration — demo-to-enterprise via the harness | Planned |
| **M5.5** | Production ops companion: harness runs alongside the deployment — auto deployment/firewall requirements, run & upgrade plans, on-server log analysis & bug-fix loop (observe → issue → PR → CI build → pull → docker up) | Planned |

### Proposed repository layout (subject to change)

```
buildingos/
├── runtime/          # BuildingOS runtime: orchestration & governance (Apache 2.0)
├── adapters/         # Harness adapters: dsh/, codex/, ...
├── schemas/          # .buildingos/ JSON Schema definitions
├── deploy/           # Docker Compose & Helm charts (bundles PG / TDengine / MQTT)
├── examples/         # Tenant repo examples per industry
├── docs/             # Documentation (docs.buildingos.ai)
└── web/              # Preset UI skill & coding-rule packs (docs) + dynamic UI renderer
```

### Dogfooding (planned)

BuildingOS's own development workflow will run on the DSH adapter — the project eats its own dog food from day one.

---

## Open Source & Business Model

- **Open core**: the BuildingOS runtime + adapters are open source (Apache 2.0). We integrate with — and contribute back to — existing open harnesses (DSH, Codex) instead of building our own engine. No reinventing the wheel.
- **Commercial value-add**: the HaaS control plane — enterprise multi-tenancy management, advanced permission control, dedicated support, private deployment, and SLAs on harness operations.
- **Community-driven**: industry template packs (medical, finance, manufacturing, IoT) let developers ship vertical AI-native SaaS on BuildingOS fast; contributors can add adapters for more harnesses.

---

## About the Name & Brand

- **"Building" — double meaning**: from physical *buildings* (the legacy building-IoT origin) to digital *building* (constructing AI-native software). From connecting physical devices to orchestrating AI intelligence — the evolution *is* the brand story.
- **"OS" — the ambition**: not a single tool, but the underlying infrastructure and governance system that carries all AI applications.

Slogans:

> **BuildingOS: The AI-Native OS for Building Everything.**
>
> BuildingOS: Where Enterprise AI Meets Git-Native Governance.

Domain strategy:

| Domain | Purpose |
|---|---|
| `buildingos.ai` | Primary domain (held) |
| `harness.buildingos.ai` | Harness console & docs entry |
| `docs.buildingos.ai` | Developer docs & API reference |
| `community.buildingos.ai` | Open source community & forum |
| `buildingos.dev`, `buildingos.robot` | Brand protection (recommended) |

---

## Community & Contributing

> **TODO**: links below will be activated as the project goes public.

- Community & forum: `community.buildingos.ai`
- Documentation: `docs.buildingos.ai`
- Harness console: `harness.buildingos.ai`

How to get involved:

1. **Discuss the schema** — the `.buildingos/` specification is the foundation; join the design discussion (link TODO).
2. **Write an adapter** — for DSH, Codex, or another harness (link TODO).
3. **Author industry template packs** — healthcare, finance, manufacturing, IoT (link TODO).
4. **Report a bug or request a feature** — open an issue (link TODO).

---

## License

BuildingOS runtime & adapters are released under the **Apache License 2.0**. See [LICENSE](LICENSE) (file TODO) for details.

Integrated harness engines remain under their own licenses (e.g. DeepSeek Harness, Codex).

---

*README scaffold: v0.10 — Concept phase. Sections marked TODO will be filled as the project evolves.*
