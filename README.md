# BuildingOS

> **The AI-Native OS for Building Everything.**
>
> Where Enterprise AI Meets Git-Native Governance.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: Concept](https://img.shields.io/badge/Status-Concept_Phase-yellow)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

**English** | 🌐 [中文版](README_cn.md)

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

- **New-project wizard**: tell it, conversationally, what you want to build → it produces a **delivery manifest** → generates Docker deployment files → deploys automatically.
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

### Schema family

> **Finalized in this repository.** The machine-validatable schemas live in [`schemas/`](schemas/README.md): Skill, Rules, Prompts, Configs — plus `adapter-contract/v1` type definitions under `schemas/contract/`. The YAML snippets below are simplified previews of the frontmatter concepts (the canonical documents are Markdown + YAML frontmatter).

```yaml
# rules/*.md frontmatter (simplified preview; see schemas/rules.schema.md)
---
id: no-data-exfiltration
scope: all
enforce: hard
permission: { effect: deny, resource: data:*:external }
order: 10
---
```

```yaml
# skills/network-diagnose/SKILL.md frontmatter (simplified preview; see schemas/skill.schema.md)
---
name: network-diagnose
description: Diagnose switch / AP health from network telemetry.
when-to-use: When the user reports latency, packet loss, or port flapping
invocation: { model: true, user: true, implicit: false }
dependencies: { tools: [ { type: mcp, value: telemetry } ] }
references: [ references/thresholds.md ]
data: [ topology.yaml ]
---
```

```yaml
# prompts/ops-engineer.md frontmatter (simplified preview; see schemas/prompts.schema.md)
---
id: ops-engineer
language: zh-CN
tone: professional, concise
order: 30
---
```

```yaml
# configs/runtime.yaml (simplified preview; see schemas/configs.schema.md)
version: "0.1"
engine: dsh            # dsh | codex — engines are pluggable
model: gpt-4o          # provider-agnostic model handle
mcp_servers:
  - name: telemetry
    transport: stdio
    command: npx telemetry-mcp
sandbox: read-only
approval: on-request
# permissions are never hand-written: derived from hard rules (schemas/rules.schema.md)
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

**Current status: Concept phase.** The README defines the vision and target architecture; the M0 design baseline (contracts, schemas, examples) is committed in this repository.

| Milestone | Scope | Status |
|---|---|---|
| **M0** | `.buildingos/` schema family (skills / rules / prompts / configs) + decision memo — see [`schemas/`](schemas/README.md) and [Contract Philosophy](docs/contract-philosophy.md) | ✅ Settled |
| **M1** | Harness adapters: integrate DeepSeek Harness (DSH) + Codex harness as pluggable engines, with **auto version tracking for adopted engines** — upstream release hooks → auto-build/conformance (no manual maintenance). New engine adoption is a deliberate, community-reviewed process (M4+) | In progress (design draft in `docs/`) |
| **M1.5** | Turnkey delivery: Docker Compose + Helm charts bundling runtime, adapters, front-ends, and the support stack (PostgreSQL / TDengine / MQTT broker) — one command to a working prototype | Planned |
| **M2** | Git integration: webhook-driven hot reload, PR CI checks | Planned |
| **M3** | UI skill & coding-rule packs (top-tier UI as documents) + dynamic UI generation — prototype out of the box, zero front-end code | Planned |
| **M4** | HaaS control plane: multi-tenant management, SLAs + vertical template packs (healthcare / finance / manufacturing / IoT) | Planned |
| **M5** | AI-native project lifecycle: new-project wizard (delivery manifest → generated deploy files → auto-deploy), existing-project onboarding (stack detection → harness analysis → deploy), runtime iteration — demo-to-enterprise via the harness | Planned |
| **M5.5** | Production ops companion: harness runs alongside the deployment — auto deployment/firewall requirements, run & upgrade plans, on-server log analysis & bug-fix loop (observe → issue → PR → CI build → pull → docker up) | Planned |

### Repository layout

```
buildingos/
├── runtime/          # BuildingOS runtime: orchestration & governance (Apache 2.0)
├── adapters/         # Harness adapters: dsh/, codex/, ...
├── schemas/          # .buildingos/ document schemas + adapter-contract/v1 types
├── deploy/           # Docker Compose & Helm charts (bundles PG / TDengine / MQTT)
├── examples/         # Tenant repo examples + dual-engine compile views
├── docs/             # Contracts, design drafts, decision memo (docs.buildingos.ai)
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

*README scaffold: v0.11 — Concept phase. Sections marked TODO will be filled as the project evolves.*
