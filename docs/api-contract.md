# BuildingOS API Contract

> **Status: DRAFT v1.9** — this document is the concrete embodiment of the *stable boundary*. v1.8: N1/N3; v1.9: runtime bootstrap & configuration design ([runtime-bootstrap.md](runtime-bootstrap.md)); the three-layer configuration split (D21) is settled.
> All endpoints, fields, and names are subject to change; principles locked by the README positioning are marked 【Decided】, everything else is 【Under discussion】.
>
> Related: [README](../README.md) (positioning), [README_cn](../README_cn.md) (Chinese), Roadmap M0 / M1 / M1.5.
>
> 中文版：[api-contract_cn.md](api-contract_cn.md)

---

## 1. Purpose and Principles

### 1.1 What this contract is

BuildingOS's core promise: **the engine can change (DSH / Codex / any future harness), but the API and the Git governance model do not.** This contract is the concrete definition of that immutable boundary, and it has three parts:

| Part | Boundary | Between |
|---|---|---|
| **Server API** | Team applications ↔ BuildingOS AI Server | Stable, engine-agnostic |
| **Adapter Contract** | BuildingOS Runtime ↔ Harness engine | Versioned, pluggable |
| **Conformance Suite** | Automated criteria that define "adapted successfully" | CI / release gate |

### 1.2 Design principles

1. 【Decided】**Stable boundary**: the contract evolves slowly and additively; changes in engine or model versions never penetrate this contract.
2. 【Decided】**Engine-agnostic**: the same tenant documents (rules/skills/prompts/configs) behave equivalently on any adopted engine (guaranteed by conformance).
3. 【Decided】**Document-native**: requests may reference Skill/Rule documents in the repository; behavior changes are never written through the API — they go through Git (PR).
4. 【Decided】**Read-only by default**: destructive operations are denied by default and require explicit confirmation or tenant-policy authorization (consistent with the `read-only-by-default` persona example).
5. 【Decided】**Honest output**: responses carry `confidence`; fabricating data is forbidden; failures carry a traceable `correlationId`.
6. 【Under discussion】Transport leans toward REST + JSON + SSE streaming; the alignment strategy with MCP (JSON-RPC 2.0) is discussed in §9.

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Tenant** | One customer = one private Git repository. All APIs hang off `tenantId`. |
| **User** | A user within a tenant (C-end consumer / B-end employee). Private state lives in the runtime state store; business data is accessed through tools — see [tenancy-model.md](tenancy-model.md) for the three-layer data boundary. |
| **Session** | A conversation/task context with persistent state (conversation history, memory, plans with the engine). |
| **Message** | One user or agent message within a session. |
| **Run** | One autonomous execution (agentic run): triggered by a message, composed of steps and tool calls. |
| **Artifact** | Structured output of a Run (diagnosis reports, JSON, generated UI descriptions, etc.). |
| **Document** | A specification/configuration document in the tenant repository: `rules/`, `skills/`, `prompts/`, `configs/` (.md + YAML frontmatter). |
| **Skill** | A capability definition (how-to), `skills/*.md`. |
| **Proposal** | A behavior-change proposal: materialized as a branch + PR, governed by GitOps review. |
| **Event** | Streaming events of a session/run (SSE or webhook push). |
| **Adapter** | The implementation that compiles tenant documents into an engine and normalizes engine behavior (see §6). |

---

## 3. Transport and Conventions

- **Base URL**: `https://<harness-host>/api/v1` (production-companion network zoning is described in §4.4).
- **Authentication**: `Authorization: Bearer <tenant-scoped-api-key>`; keys are scoped to `read` / `write` levels (【Decided】read-only by default).
- **Versioning**: path `v1`. The contract version is independent of engine versions; breaking changes require a `v2` migration with a transition window (【Decided】).
- **Idempotency**: `POST` creation operations support the `Idempotency-Key` header; replays return the first result (【Under discussion】whether all endpoints support it).
- **Streaming**: requests that need streaming set `"stream": true`; the response switches to `text/event-stream` (SSE), see §5.
- **Error envelope**: every non-2xx response uses a uniform structure:

```json
{
  "error": {
    "code": "POLICY_DENIED",
    "message": "write:router is denied by tenant policy",
    "details": { "rule": "read-only-by-default" },
    "correlationId": "corr_9f2c..."
  }
}
```

Common error codes: `TENANT_NOT_FOUND`, `AUTH_INSUFFICIENT_SCOPE`, `POLICY_DENIED`, `DOC_NOT_FOUND`, `ENGINE_UNAVAILABLE` (engine or adapter failure, includes `adapterStatus`), `RUN_FAILED` (includes `confidence: null` and a failure summary), `RATE_LIMITED`.

---

## 4. Endpoints

### 4.1 Sessions — the primary AI Server interface

**Create a session**

```
POST /v1/sessions
```

```json
{
  "tenantId": "acme-factory",
  "surface": "web",
  "role": "ops-engineer",
  "engine": "dsh"
}
```

```json
// 201
{
  "id": "sess_01J4X...",
  "status": "ready",
  "engine": "dsh",
  "engineVersion": "2025.11.1",
  "contractVersion": "v1"
}
```

When `engine` is omitted, the tenant's `configs/runtime.yaml` decides (【Decided】engines are pluggable).

**Session state**

```
GET /v1/sessions/{sessionId}
```

Returns status (`ready` / `running` / `ended`), recent messages, active run, associated artifacts, `engine`, and `adapterStatus`.

**Send a message (triggers a Run)**

```
POST /v1/sessions/{sessionId}/messages
```

```json
{
  "content": "交换机 SW-03 延迟升高，帮我诊断",
  "stream": true
}
```

With `stream: true`, the response is SSE (§5); with `stream: false`, it returns the final aggregated result:

```json
// 200
{
  "messageId": "msg_88d...",
  "runId": "run_007",
  "status": "completed",
  "answer": "SW-03 上行口丢包率 2.3%，接近阈值……",
  "artifact": { "type": "diagnosis", "switches": ["SW-03"], "findings": [] },
  "confidence": 0.82,
  "stepsUsed": ["network-diagnose"]
}
```

**Event stream (SSE subscription to the current session)**

```
GET /v1/sessions/{sessionId}/events
```

**End a session**

```
DELETE /v1/sessions/{sessionId}
```

### 4.2 Documents & Skills — read side of the Git Brain

```
GET /v1/tenants/{tenantId}/docs?kind=rules|skills|prompts|configs
GET /v1/tenants/{tenantId}/docs/{path}          # raw document (.md)
GET /v1/tenants/{tenantId}/skills/{skillId}     # compiled view (what the engine actually sees)
```

`{path}` examples: `skills/network-diagnose.md`. The compiled view lets you verify "what the document says vs. what the engine sees" — this is the basis of auditability (【Decided】documents are source code).

### 4.3 Governance — the GitOps surface

**File an Issue (one of the production-companion diagnosis actions)**

```
POST /v1/tenants/{tenantId}/issues
```

```json
{
  "title": "[prod] SW-03 丢包率持续超阈值",
  "body": "观测：……\n假设：……\n建议：检查上行光模块/重启 PoE（需授权）",
  "labels": ["production", "diagnosis"],
  "sourceRunId": "run_007"
}
```

**Propose a behavior change (creates a PR; never mutates production directly)**

```
POST /v1/tenants/{tenantId}/proposals
```

```json
{
  "type": "skill-update",
  "target": "skills/network-diagnose.md",
  "description": "增加对上行口丢包率的阈值判断",
  "draft": "新增步骤：若丢包率 > 2% 则建议检查光模块…"
}
```

```
GET /v1/tenants/{tenantId}/proposals/{proposalId}
// { "status": "pr_open", "branch": "proposal/ops-123", "prUrl": "https://github.com/.../pull/42", "ciChecks": { "schema-lint": "pass", "permission-impact": "pass", "dry-run": "pending" } }
```

【Decided】Guardrail: **no behavior change may write live configuration bypassing Git.** A Proposal only creates a branch/PR; merging is gated by CI checks plus human/policy review.

### 4.4 Ops — the production companion

> 【Decided】The production-companion harness is deployed in the same network domain as the application, but its API surface is exposed only to the internal network and controlled jump hosts; outbound traffic is limited to Git-related activity (branch push, PR, webhook). Exact ports and network ranges are documented in the auto-generated deployment/firewall requirements (`GET /v1/ops/deployment-requirements`).

```
GET  /v1/ops/health                    # health of runtime, adapters, engines, bundled services (PG/TDengine/MQTT)
GET  /v1/ops/logs?service=*&since=…    # structured log query / streaming
POST /v1/ops/diagnose                  # failure signature in → root-cause hypotheses + fix suggestions (filed as an Issue draft, never applied directly)
GET  /v1/ops/deployment-requirements   # auto-generated deployment requirements document (includes firewall opening requirements)
GET  /v1/ops/upgrade-plan              # auto-generated run & upgrade plan document
```

`/v1/ops/diagnose` example:

```json
{
  "symptom": "SW-03 latency p95 3s, packet loss 2.3%, PoE port 12 flapping",
  "mode": "propose-only"
}
```

```json
// 200 —— observes and proposes only; never writes to production
{
  "hypotheses": [
    { "rank": 1, "cause": "上行光模块劣化", "evidence": ["loss>2%", "CRC errors"], "confidence": 0.71 },
    { "rank": 2, "cause": "PoE 端口环路", "evidence": ["port12 flapping"], "confidence": 0.58 }
  ],
  "proposedFix": {
    "kind": "skill-update",
    "target": "skills/network-diagnose.md",
    "summary": "新增光模块检查步骤",
    "issueDraft": "https://…/issues/new"
  },
  "authorizationRequired": true
}
```

### 4.5 Webhooks — event subscription

```
POST /v1/tenants/{tenantId}/webhooks
{ "url": "https://…/events", "events": ["doc.hot-reloaded", "run.completed", "proposal.pr_merged"], "secret": "…" }
```

The event catalog is in §5.

### 4.6 Tool governance (the four MCP states) 【Decided framework】

| Action | Mechanism | Notes |
|---|---|---|
| **Use** | Engine MCP client (runtime invocation) | Natively supported by both engines (DSH stdio / Streamable HTTP; Codex config.toml / `.mcp.json` / plugin mcpServers) |
| **Select** | The model chooses per task | The selectable set = registered tools ∩ permission-allowed (permissions derived from hard rules; D14, no exceptions) |
| **Designate** | skill `dependencies.tools[]` | A reference (type+value); registration lives in runtime.yaml (D3 layering); CI verifies the reference resolves |
| **Install** | **Governed form**: the AI proposes → a runtime.yaml change PR → review and merge → hot reload takes effect | A new tool is a new permission surface and must pass a PR (auditable, rollback-able); **no runtime installation in M0/M1**. Codex's `request_plugin_install` (agent-requested install) is an M1 research item, evaluated as a mapping onto the governed PR flow |

Data flow: `skill.dependencies → runtime.yaml mcp_servers (registration) → engine MCP client → business system (user-level authorization)`. Tenancy model and data boundaries: see [tenancy-model.md](tenancy-model.md).

---

## 5. Event stream (SSE) and event types

SSE format: `event: <type>` + `data: <json>`. Core event types:

| Event | Description |
|---|---|
| `session.created` / `session.ended` | Session lifecycle |
| `run.started` | A Run begins, carrying the matched skillId |
| `tool.call` / `tool.result` | Tool invocation (MCP-aligned) |
| `step.completed` | An agentic step completes, carrying a summary |
| `message.created` | Agent message delta |
| `artifact.created` | Structured artifact |
| `run.completed` / `run.failed` | Run termination (includes `confidence`) |
| `doc.hot-reloaded` | A Git change merged → hot reload takes effect (commonly used with webhooks) |
| `proposal.pr_merged` | A behavior-change PR merged |
| `adapter.updated` | Adapter auto-updated or rolled back (includes `fromVersion` / `toVersion` / `pinned`) |

---

## 6. Adapter Contract (BuildingOS Runtime ↔ engine) 【Decided framework; details in adapter-contract.md】

The entire secret of engine pluggability lives in this small interface. **Contract versioned independently: `adapter-contract/v1`.** Field-level definitions, the four mapping tables, event normalization, and the conformance criteria are in **[adapter-contract.md](adapter-contract.md)** (M1 design draft v0.4).

```ts
// adapter-contract/v1 —— one implementation per adopted engine
interface HarnessAdapter {
  // 1. Compile tenant documents into engine-native configuration (system prompt / context / tool registration / permission boundary)
  compile(docs: TenantDocs): EngineConfig;

  // 2. Uniform Run interface: hand RunRequest to the engine, return a normalized event stream
  run(req: RunRequest, cfg: EngineConfig): AsyncStream<AgentEvent>;

  // 3. Tool surface (MCP-aligned): tools the engine can expose to the agent
  tools(): ToolDescriptor[];

  // 4. Engine status: version, health, capabilities
  status(): AdapterStatus;

  // 5. Self-check: local entry point for conformance, called by CI
  selfcheck(): ConformanceReport;
}

interface RunRequest {
  sessionId: string;
  tenantId: string;
  intent: string;              // user intent or message
  skills: string[];            // matched skills/*.md
  context: ContextSlice;       // dynamic context (from the tenant repository, trimmed on demand)
  permissions: PermissionSet;  // policy enforced uniformly at runtime
}

type AgentEvent = {
  type: "thought" | "tool.call" | "tool.result" | "step" | "message" | "artifact" | "error"
      | "approval.request" | "user.input.request";   // the last two are M1 extensions (plan & approval event surfaces; see adapter-contract.md §5)
  ts: string;
  payload: unknown;            // normalized payload (event types in §5)
};
```

Key points:

- **Normalization**: `run()` emits only the event types above; engine-specific flourishes (thought formats, internal step names) are flattened inside the adapter.
- **Policy lives on the Runtime side**: permissions/sandbox are enforced uniformly by the Runtime (`permissions` flows into `RunRequest`); engine-native permission implementations are not trusted — this is the foundation of cross-engine equivalence.
- **New engines**: write an adapter + pass the conformance suite = adopted. **Adoption is a deliberate community review, outside automatic tracking (【Decided】).**

---

## 7. Conformance Suite (automated criteria for "adapted successfully")

Automated builds are only possible if "success" has machine-judgeable criteria. Four dimensions:

| Dimension | Criterion |
|---|---|
| **Interface conformance** | The adapter passes `adapter-contract/v1` type checks and contract tests |
| **Behavioral conformance** | The golden task set (e.g., `network-diagnose`, knowledge Q&A, read-only inspection) runs on the target engine and outputs satisfy assertions: valid structure, includes `confidence`, no fabricated fields |
| **Policy conformance** | Permission matrix: tools forbidden by tenant policy must be refused with `POLICY_DENIED` on **any** engine |
| **Update gate** | Upstream releases → auto-build + full conformance: all green → auto-publish; any red → alert + pin last-known-good (【Decided】) |

---

## 8. Worked example: the full network-diagnose flow

```
POST /v1/sessions
{ "tenantId": "acme-factory", "surface": "web", "role": "ops-engineer" }
→ sess_01J4X...

POST /v1/sessions/sess_01J4X.../messages
{ "content": "交换机 SW-03 延迟升高，帮我诊断", "stream": true }
```

SSE event stream:

```
event: run.started
data: {"runId":"run_007","skill":"network-diagnose","engine":"dsh"}

event: tool.call
data: {"tool":"mcp://telemetry/query-switch-status","args":{"switches":["SW-03"]}}

event: tool.result
data: {"tool":"mcp://telemetry/query-switch-status","ok":true,"latencyMs":38}

event: step.completed
data: {"step":"Query switch status","summary":"SW-03 上行口丢包率 2.3%，CRC 错误持续增长"}

event: run.completed
data: {"runId":"run_007","artifact":{"type":"diagnosis","switches":["SW-03"],"findings":[{"metric":"uplink.packet_loss","value":"2.3%","threshold":"2%"}]},"confidence":0.82,"nextActions":["建议检查上行光模块；如授权可执行 PoE 端口重启"]}
```

(If the engine were Codex, the event stream would be byte-identical except the `engine` field — this is the acceptance criterion for conformance behavioral equivalence.)

---

## 9. Open questions (M0 discussion items)

1. **Protocol alignment**: should the Server API be exposed directly in MCP form (JSON-RPC 2.0), or REST-first with MCP as the tool surface? Leaning: REST as the tenant integration surface, MCP as the tool standard (they do not conflict).
2. **Streaming channel**: is SSE sufficient, or is bidirectional WebSocket needed (reverse push when the agent asks the user mid-run)?
3. **Tenant resolution**: path parameter vs. `X-Tenant-Id` header (multi-tenant gateway scenarios).
4. **Run idempotency**: retry semantics and the coverage of `Idempotency-Key`.
5. **Proposal automation boundary**: is policy-whitelisted auto-merge allowed (e.g., documentation-only fixes), with everything else human-reviewed?
6. **Ops API network zoning**: production-companion harness exposure, jump hosts, and audit requirements (linked to the auto-generated firewall requirements document).
7. **UI Skill document schema**: what the preset "top-tier UI" Skill/coding-rule documents look like (see M3 / examples plan).

---

## 10. Appendix A: Engine compatibility research (DSH × Codex current state)

> Research date: 2026. **DSH findings come from the local source code and design documents** (deepseek-harness checkout, primary source); **Codex findings come from a local git clone (openai/codex, commit `d21794d6`, 2026-08-24) verified against the primary source** + public docs (docs/skills.md external link, docs/config.md, etc.).
> This appendix calibrates the §6 Adapter Contract `compile()` mappings and §7 conformance criteria. Codex items marked 【Source-confirmed】 are pinned to that commit.

### A.1 Document primitive comparison: what each engine natively supports

| Primitive | DSH (DeepSeek Harness) | Codex (OpenAI Codex CLI) | Conclusion |
|---|---|---|---|
| **Skill** | ✅ First-class: `<name>/SKILL.md` or `<name>.md` + YAML frontmatter | ✅ Isomorphic: `.codex/skills/<name>/SKILL.md` + frontmatter + `references/` subdirectory【Source-confirmed】 | **The one document primitive both engines converged on** — BuildingOS `skills/*.md` aligns directly |
| **Rule** | ⚠️ No standalone rule.md: rules are carried by system-prompt plugins / preset configuration (cordis.yml); follows the `.agents` convention | ✅ **AGENTS.md**: collected hierarchically from project root to cwd; `AGENTS.override.md` takes precedence; user-level AGENTS.md also exists【Source-confirmed】 | Different shapes (hierarchical concatenation vs. config injection) — BuildingOS `rules/` unifies them |
| **Plan** | ⚠️ Not a file: plan mode is a session state (`mode/set` event + `exit_plan_mode` tool), configured in cordis.yml | ⚠️ A **template document**: collaboration-mode-template (plan.md) drives the `<proposed_plan>` block + `request_user_input`; the Plan preset sets reasoning_effort=medium【Source-confirmed】 | Codex's plan is a document template — closest to "the system is documents" |
| **Memory** | ❌ No native memory.md: explicitly via third-party MCP memory servers (Memorix / MCP Reference Memory / Engram examples) | ✅ **Native memories subsystem**: Phase 1 extraction → Phase 2 consolidation produces `MEMORY.md` / `memory_summary.md` / `skills/` under `~/.codex/memories/` (a **git-baseline directory**)【Source-confirmed】 | Codex already implements "memory as Git documents" — aligned with BuildingOS philosophy |
| **Config** | ✅ `cordis.yml` (plugin composition) + presets + sandbox/approval knobs | ✅ `.codex/config.toml` (model / sandbox_mode / approval_policy / mcp_servers …, [docs/config.md](https://github.com/openai/codex/blob/main/docs/config.md)) | Each engine does its own thing — BuildingOS `configs/runtime.yaml` unifies them |

### A.2 Skill format details (DSH primary source)

From DSH `docs/subsystems/skills.md`:

- File naming: directory bundle `<name>/SKILL.md` or flat `<name>.md`; names are kebab-case.
- YAML frontmatter required: `name`, `description`; optional: `whenToUse`, `metadata` (open object), `disable-model-invocation`, `user-invocable`.
- **Progressive disclosure**: the session catalog injects only name + description (description capped at 500 characters); the body is loaded on demand by the `skill({name})` tool, returning `<skill_content>` / `<skill_resources>` / `<skill_instructions>`.
- Discovery roots (ranked, nearest-first): project `.dsh/skills` → project `.agents/skills` → customSkillDirs → user `.dsh/skills` → user `.agents/skills` → bundled.
- Layered registry: global layer + per-preset layers, nearest same-name wins.
- DSH explicitly acknowledges: Codex, Claude Code, OpenCode, and Kimi Code have converged on the same skill pattern (progressive disclosure).

Codex side (source-confirmed): the skills crate implements parse / select / load (parser / selection / loading / invocation); **user input can explicitly carry `skill` (name + SKILL.md path)** (protocol_v1.md); the repo itself organizes skills as `.codex/skills/<name>/SKILL.md`, and bodies reference supplementary documents via a **`references/` subdirectory** (e.g., `babysit-pr/references/heuristics.md`). The full frontmatter field set is defined by the official docs (developers.openai.com/codex/skills) — `docs/skills.md` is an external link; the repository contains no full schema text.

### A.3 Reference mechanisms: "are other documents ref'd from within these documents?"

- **Skill → references** (both engines have it, different shapes):
  - DSH: `resourceBase` points to a directory / URL / managed resource; scripts, references, and assets explicitly referenced in the body are **loaded on demand, no directory enumeration**【Source-confirmed】.
  - Codex: the SKILL.md body directly references **`references/*.md`** supplementary documents in the same skill directory (e.g., babysit-pr references `references/heuristics.md`, `references/github-api-notes.md`)【Source-confirmed, in-repo example】.
- **Skill → Skill, Skill → Rule, Rule → other files**: currently **no standard** — DSH's deferred list explicitly excludes `context: fork`, `arguments`, `allowed-tools` and other extension fields from the contract; Codex shows no cross-document reference protocol either.
- **Conclusion**: skill → supplementary-document references exist on both sides (DSH `resourceBase` / Codex `references/`); general cross-document references remain a blank area — BuildingOS's know-how model can unify them (the `references:` convention, see A.6), and adapters only need to map the two resource bases.

### A.4 Plugin / extension standards

| | DSH | Codex |
|---|---|---|
| **Framework** | **Cordis**: npm packages export `apply(ctx)` (function / object / Service forms); composed via `cordis.yml`; `inject` declares service dependencies | **plugin.json manifest + marketplace.json**: `.codex-plugin/plugin.json` (name / version / description / author / skills / hooks / mcpServers / apps / interface metadata); marketplace `~/.agents/plugins/marketplace.json` (personal) or `<repo>/.agents/plugins/marketplace.json` (team), entries carry install policy (NOT_AVAILABLE / AVAILABLE / INSTALLED_BY_DEFAULT) and auth timing (ON_INSTALL / ON_USE)【Source-confirmed】 |
| **Extension surface** | `ctx.skills` / `ctx.tools` / `ctx.bash` / `ctx.fs` / `ctx.modes` / `ctx.userInteraction` / `ctx.agents` / session events / system-prompt assembly seams | Component-based: skills + hooks + mcpServers + apps (connectors) + interface (UX); `ext/*` built-in extensions (goal / guardian / memories / image-generation / web-search), contribution model split into Context / Tool / Request / Output / Runtime / Turn【Source-confirmed】 |
| **Interoperability** | ❌ Incompatible | ❌ Incompatible |

### A.5 Protocol support (what exists beyond MCP)

| Protocol | DSH | Codex | Notes |
|---|---|---|---|
| **MCP (as client)** | ✅ stdio + Streamable HTTP (tools registered as `mcp__<server>__<tool>`) | ✅ config.toml / `.mcp.json` / plugin-embedded mcpServers | Consensus on both sides; de-facto standard |
| **MCP (as server)** | ⚠️ Not confirmed | ✅ **`codex mcp-server`** (experimental): JSON-RPC 2.0 over stdio; v2 RPCs: `thread/start・resume・fork・read・list`, `turn/start・steer・interrupt`, `config/*`, `model/list`, `collaborationMode/list`; notifications `codex/event/*`; approval callbacks `applyPatchApproval` / `execCommandApproval`【Source-confirmed】 | **Codex can be driven as an MCP client's server** — BuildingOS's Server API can wrap this |
| **ACP (Agent Client Protocol)** | ✅ JSON-RPC 2.0 over stdio (initialize / session/new / prompt / cancel / request_permission …); positioned as an **automation-only** protocol since 2026 | ❌ **Confirmed unsupported at source level** (no ACP implementation in codex-rs) | A clear difference: the Codex adapter needs no ACP |
| **Internal protocol** | Session event log (own event domain) | **protocol v1**: SQ/EQ dual queues; Ops (ConfigureSession / UserTurn / Interrupt / ExecApproval / UserInputAnswer) + Events (AgentMessage / PlanDelta / ExecApprovalRequest / RequestUserInput / TurnStarted / TurnComplete); newline-delimited JSON, any bidirectional streaming transport (stdin/stdout, TCP, HTTP2, gRPC)【Source-confirmed】 | Codex's protocol surface is primarily in-process types, not a stable wire contract |

### A.6 Implications for BuildingOS: compile() mapping draft (calibrating §6)

| BuildingOS document (tenant repository) | → DSH native form | → Codex native form |
|---|---|---|
| `skills/*.md` (frontmatter: name / description / whenToUse / metadata) | Place into project `.dsh/skills/` or `.agents/skills/` (**compatible as-is**); `references/` → same-directory resources | Place into `.codex/skills/<name>/SKILL.md`; `references/` subdirectory kept as-is【Source-confirmed】 |
| `rules/*.md` (behavior boundaries) | Compile into a system-prompt plugin section or preset configuration (cordis.yml) | Compile into **hierarchical AGENTS.md sections** (root→cwd nearest concatenation; `AGENTS.override.md` for forced override)【Source-confirmed】 |
| `prompts/*.md` (persona) | Merge into persona / preset configuration | Merge into collaboration-mode template / developer instructions |
| `plan/*.md` (plan paradigm, when enabled) | Generate plan-mode section configuration (cordis.yml `modes.plan.section`) | **Generate the collaboration-mode-template directly (a document isomorphic to plan.md)**【Source-confirmed】 |
| `configs/runtime.yaml` (engine / model / permissions / MCP) | Map to cordis.yml rows + sandbox / approval knobs | Map to config.toml (model / sandbox_mode / approval_policy / mcp_servers) |
| `configs/memory.yaml` (memory service, when enabled) | Generate a dsh-mcp-client overlay (e.g., mcp-reference-memory) | Enable native memories (produces `MEMORY.md` under the `~/.codex/memories` git directory) or MCP memory【Source-confirmed】 |

### A.7 Open verification items (re-verify against the adopted engine version)

1. **Version drift**: Codex items in this appendix are pinned to commit `d21794d6` (2026-08-24); `codex mcp-server`, skills, and plugins are all marked experimental — re-verify against the locked version at adoption.
2. **~~Full skills frontmatter schema~~ Resolved (v0.4)**: source-level schema in A.8 (`skills/src/parser.rs` + `ext/skills/src/loader/metadata.rs`, companion metadata file `openai.yaml`). The official site docs (developers.openai.com/codex/skills) serve as cross-check reference at adoption.
3. **Codex native memories enable/disable conditions** (ephemeral / sub-agent sessions / feature flags) and how `MEMORY.md` is referenced — affects the defaults of `configs/memory.yaml`.
4. **M5.5 production-companion automation bridge choice**: DSH via ACP (automation-only) or its own Server API; Codex via `codex mcp-server` (experimental) — the two event models (DSH session events vs. Codex codex/event) must be normalized at the Server API event layer.

### A.8 Codex skill document schema (source-confirmed, commit `d21794d6`)

A Codex skill bundle has four parts (`ext/skills/src/loader/`):

```
<skill-name>/
├── SKILL.md          # body = instructions; frontmatter below
├── openai.yaml       # companion metadata: interface / dependencies / policy
├── references/       # supplementary documents, explicitly referenced from the body (e.g., references/heuristics.md)
└── scripts/          # scripts; running a script or reading a document can trigger implicit invocation
```

**SKILL.md frontmatter** (`skills/src/parser.rs` — the parser consumes exactly these three fields):

| Field | Required | Constraint |
|---|---|---|
| `name` | ✅ (falls back to the directory name) | ≤64 characters; single line; kebab-case convention |
| `description` | ✅ | Non-empty, single line (the parser auto-repairs bare-colon values like `Build for AWS: ECS`) |
| `metadata.short-description` | Optional | Single line |

**openai.yaml** (`ext/skills/src/loader/metadata.rs`; **fail-open**: a missing or malformed file does not block SKILL.md loading):

```yaml
interface:                # display metadata
  display_name: ...
  short_description: ...
  icon_small: ...
  icon_large: ...
  brand_color: ...
  default_prompt: ...
dependencies:
  tools:                  # tool dependencies declared by the skill
    - type: mcp           # required
      value: deployer     # required
      description: ...    # optional; every field has a length cap
      transport: ...
      command: ...
      url: ...
      oauth: { callback_port: ... }
policy:
  allow_implicit_invocation: false   # default true; false disables implicit invocation
  products: [codex]                  # product gating (parsed and stored only; not enforced at selection — model.rs TODO)
```

**Implicit invocation** (`skills/src/invocation.rs`): running a script inside the skill directory, or reading a document inside it, is recognized as an **implicit invocation** of that skill — this is the progressive-disclosure trigger surface on the Codex side; `policy.allow_implicit_invocation: false` disables it.

> **Comparison with DSH (affects the BuildingOS unified schema)**: DSH puts invocation policy in the SKILL.md frontmatter (`disable-model-invocation` / `user-invocable`); Codex puts it in the companion `openai.yaml` `policy`. BuildingOS internally uses one `invocation:` concept (modelInvocable / userInvocable / allowImplicit), mapped bidirectionally by compile(): → DSH frontmatter fields, → Codex openai.yaml policy fields.

> **References**
> - DSH (local checkout, primary source): `docs/subsystems/skills.md`, `.agents/notes/implemented/feature/2026-07-05-skill-system.md`, `implemented/architecture/2026-08-09-layered-skill-registry.md`, `archived/feature/2026-06-14-acp-agent-client-protocol.md`, `archived/feature/2026-07-07-plan-mode.md`, `implemented/feature/2026-07-31-third-party-memory-mcp-examples.md`, `docs/cordis-tutorial/01-first-plugin.md`
> - Codex (local clone, primary source, commit `d21794d6`, 2026-08-24): `codex-rs/core/src/agents_md.rs`, `codex-rs/core/src/agents_md_manager.rs`, `codex-rs/docs/protocol_v1.md`, `codex-rs/docs/codex_mcp_interface.md`, `codex-rs/collaboration-mode-templates/templates/{default,plan}.md`, `codex-rs/memories/README.md`, `codex-rs/skills/src/`, `codex-rs/ext/extension-api/notes.md`, `.codex/skills/babysit-pr/SKILL.md`, `codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md`
> - Codex (public docs): [docs/skills.md (external link to developers.openai.com/codex/skills)](https://github.com/openai/codex/blob/2c6995ca4dfc23b93db311b59c1b4ead464658b1/docs/skills.md), [docs/config.md](https://github.com/openai/codex/blob/65cc12d72e25723aece48edd6ff93dd288b6c042/docs/config.md), [CodexGuide: AGENTS.md](https://github.com/freestylefly/CodexGuide/blob/main/docs/advanced/02-agents-md.md), [codex-cli-best-practice: SKILLS.md](https://github.com/shanraisshan/codex-cli-best-practice/blob/main/docs/SKILLS.md), [Vercel: 6 best Codex plugins](https://vercel.com/i/codex-plugins), [mem0: Codex CLI memory](https://mem0.ai/blog/how-memory-works-in-codex-cli), [qwen-code-rust: ACP reference](https://github.com/hscale/qwen-code-rust/blob/main/docs/acp.md)

---

## 11. Changelog

| Version | Summary |
|---|---|
| v0.1 | Draft: three-boundary framework (Server API / Adapter Contract / Conformance), endpoint skeleton, event model, worked example, discussion items |
| v0.2 | Appendix A added: DSH × Codex engine compatibility research (document primitives / plugin standards / protocols / compile mapping draft) |
| v0.3 | Appendix A re-verified against the local Codex clone (commit d21794d6): confirmed AGENTS.md hierarchical discovery, SKILL.md + references/, plugin.json / marketplace.json, `codex mcp-server`, native memories (`MEMORY.md`), no ACP; compile mapping updated |
| v0.4 | Codex skill document schema completed at source level (A.8): SKILL.md frontmatter (parser.rs) + companion `openai.yaml` (metadata.rs) + references/ + scripts/ implicit invocation; A.7 item 2 closed |
| v0.5 | M0 output [schemas/](../schemas/README.md): skill document schema draft (`skill.schema.md` + `skill.schema.json`), landing A.6 compile mapping (unified format → DSH view / Codex view) |
| v0.6 | M0 review: 4 open decisions settled and synced to schemas/ — implicit ignore + metadata lossless carry / top-level `ui:` block / dependencies layered references / flat-form import-only + auto-upgrade |
| v0.7 | M0 outputs: [examples/skills/network-diagnose](../examples/skills/network-diagnose/SKILL.md) (skill schema acceptance case, with three-view compile demo) and [rules.schema.*](../schemas/rules.schema.md) (rule document spec: AGENTS.md hierarchical mapping + hard/soft landing) |
| v0.8 | rules review: 4 decisions settled (generative permission / multi-section files / applies-to reserved / bug-vs-style criterion); skill `data:` field added (tenant data dependency, surfaced by the example acceptance); [prompts.schema.*](../schemas/prompts.schema.md) added |
| v0.9 | prompts review: 3 decisions settled (merged multi-persona / semi-structured / session-level injection); [configs.schema.*](../schemas/configs.schema.md) and [examples/configs/runtime.yaml](../examples/configs/runtime.yaml) added — **M0 schema family complete** |
| v1.0 | **M0 wrap-up**: configs review — 3 decisions settled (unified vocabulary / no exception channel / memory placeholder); [contract-philosophy.md](contract-philosophy.md) added (plain-language memo of all M0 decisions, D1–D21) |
| v1.1 | [tenancy-model.md](tenancy-model.md) added (three-layer data boundary / skill layering / tool four states, D16–D18); §2 Core Concepts adds User; §4.6 tool governance added |
| v1.2 | tenancy-model refined with world-knowledge documents (D19: repository = brain + world model; toB `knowledge/` / toC `users/<uid>/` + mass-user degradation; knowledge documents free-form, schema after M1 validation) |
| v1.3 | **M1 kickoff**: [adapter-contract.md](adapter-contract.md) added (§6 field-level detail: TenantDocs / EngineView / four mapping tables / event normalization / conformance criteria G1–G4 / adapter lifecycle / implementation checklist); AgentEvent extended to 9 types (approval.request, user.input.request) |
| v1.4 | First live compile verification: [compile-verification.md](compile-verification.md) + [engine-views/](../examples/engine-views/README.md) (dual-engine views as golden outputs); adapter-contract registers calibration points C1–C3 |
| v1.5 | D20 decision: order is one global numbering space (cross-family duplicates rejected by lint); examples re-ordered (persona order 20→30); calibration point C2 closed |
| v1.6 | `adapter-contract/v1` type definitions as machine-validatable JSON Schema ([schemas/contract/](../schemas/contract/README.md)): TenantDocs / EngineView / RunRequest / AgentEvent (9 types) |
| v1.7 | Validation & normalization module design ([normalizer-design.md](normalizer-design.md)): compile pipeline stages 1–2 (parse-validate + normalize + set-level lint), implementation blueprint and round-trip test cases |
| v1.8 | N1/N3 decisions: SkillDoc models `scripts[]` (contract schema synced); lint severity hard-coded in M1, configurable in M2; example skill gains `scripts/telemetry-snapshot.py` |
| v1.9 | Runtime bootstrap & configuration design ([runtime-bootstrap.md](runtime-bootstrap.md)): three-layer configuration split (D21: documents in Git, secrets injected via env), 7-step CLI bootstrap, dev/prod dual posture |
