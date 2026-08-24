# BuildingOS Adapter Contract (M1 detailed design)

> Status: M1 design draft v0.4 — the **field-level elaboration** of api-contract §6, aiming to make `compile()` / `run()` actually implementable.
> v0.2: first live compile verification; v0.3: type definitions as JSON Schema + D20; v0.4: validation & normalization module design ([normalizer-design.md](normalizer-design.md)).
> Related: [api-contract.md](api-contract.md) §6 (framework), [tenancy-model.md](tenancy-model.md) (where data comes from), [schemas/](../schemas/README.md) (document schema family), [Contract Philosophy](../docs/contract-philosophy.md) (D1–D21).
> This draft contains no adapter implementations; the concrete DSH / Codex integrations happen in the M1 implementation phase.
>
> 中文版：[adapter-contract_cn.md](adapter-contract_cn.md)

## 1. Goals and non-goals

**Goals**
- Field-level definitions of `compile()`'s input (TenantDocs) and output (EngineView);
- Four mapping tables (skills / rules / prompts / configs × DSH / Codex) with **per-field transformation rules**;
- Engine mapping for event normalization (BuildingOS AgentEvent ↔ DSH ↔ Codex);
- Conformance criteria (golden task set + permission matrix + update gate) as concrete items.

**Non-goals**
- No adapter code, no language/framework selection;
- No decision on the DSH / Codex integration bridge form (ACP vs. codex mcp-server vs. in-process) — decided at implementation time (§9).

## 2. TenantDocs (compile input)

> The type definitions are materialized as a machine-validatable JSON Schema: [schemas/contract/adapter-contract.schema.json](../schemas/contract/adapter-contract.schema.json) (the TypeScript below is its readable mirror; the schema is authoritative).

```ts
// adapter-contract/v1 —— the engine-agnostic normalized document model
interface TenantDocs {
  skills:     SkillDoc[];        // schemas/skill.schema.json (D1–D5)
  rules:      RuleDoc[];         // schemas/rules.schema.json (D6–D9)
  prompts:    PromptDoc[];       // schemas/prompts.schema.json (D10–D12)
  config:     RuntimeConfig;     // schemas/configs.schema.json (D13–D15)
  knowledge:  KnowledgeDoc[];    // free-form (D19, t3)
}

interface SkillDoc {
  name: string;                  // kebab-case ≤64
  description: string;
  whenToUse?: string;
  metadata: Record<string, unknown>;   // open object (short-description; x-buildingos lossless-carry namespace)
  ui?: { displayName?: string; shortDescription?: string; iconSmall?: string;
         iconLarge?: string; brandColor?: string; defaultPrompt?: string };
  invocation: { model: boolean; user: boolean; implicit: boolean };  // normalized (default true)
  products: string[];
  dependencies: ToolRef[];       // references (type+value), registered in config.mcpServers
  references: string[];          // bundle-internal resources
  scripts: string[];             // scripts/ paths (N1: Codex implicit invocation; DSH ignores but preserves)
  data: string[];                // tenant knowledge/data paths (D5, D19)
  body: string;                  // Markdown body
}

interface RuleDoc {
  id: string; title?: string; description?: string;
  scope: 'all' | 'tools' | 'session' | 'surface';
  enforce: 'hard' | 'soft';
  permission?: { effect: 'allow' | 'deny'; resource: string };  // required for hard (D6 generative)
  order: number;                 // normalized (default 100)
  appliesTo?: string;            // reserved in M0 (D8)
  enabled: boolean;
  sections: { heading: string; body: string }[];  // multi-section (D7)
}

interface PromptDoc {
  id: string; language: string;  // default zh-CN
  tone?: string; order: number; enabled: boolean;
  body: string;                  // persona body (merged by order, D10)
}

interface RuntimeConfig {
  version: string; engine: 'dsh' | 'codex';
  model?: string;
  mcpServers: McpServerReg[];    // registration (D3 layering)
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  approval: 'never' | 'on-request' | 'unless-trusted';
  ui?: { theme?: string; surfaces?: string[] };
  memory?: { provider: 'mcp-memory' | 'codex-native' };  // placeholder (D15)
  // permissions are NOT here: derived from hard rules (D6, D14)
}

interface KnowledgeDoc { path: string; content: string; }  // free-form (D19)
```

**The compile pipeline (three stages)**:

```
TenantDocs → [1 parse & validate] → [2 normalize] → [3 render] → EngineView
```

1. **Parse & validate** (engine-agnostic): each document passes its JSON Schema + lint rules (references resolvable, permissions derived, etc.);
2. **Normalize** (engine-agnostic): ordering (order), same-name skill conflicts (D17 layer nearest-wins), persona merging (D10), permission derivation (D6);
3. **Render** (engine-specific): generate the EngineView against the target engine's templates.

## 3. EngineView (compile output)

```ts
interface EngineView {
  engine: 'dsh' | 'codex';
  // materialized mode: files written into the engine workspace (.dsh/ or .codex/ etc.)
  files: GeneratedFile[];
  // in-memory mode: structured config passed directly to a headless API (no files written)
  runtimeConfig?: Record<string, unknown>;
}

interface GeneratedFile {
  path: string;      // relative to the engine workspace (e.g., .codex/skills/network-diagnose/SKILL.md)
  content: string;   // rendered text (.md / .yaml / .toml)
  kind: 'skill' | 'rule' | 'prompt' | 'config' | 'knowledge';
}
```

- **DSH adapter**: `files` writes `.dsh/skills/...` + cordis.yml rows / preset config; or `runtimeConfig` via in-process registration (`ctx.skills` / system-prompt sections) — chosen at implementation time (§9).
- **Codex adapter**: `files` writes `.codex/skills/<name>/SKILL.md` + `openai.yaml` + `AGENTS.md` + `config.toml`; or `runtimeConfig` via `codex mcp-server` (experimental) — chosen at implementation time (§9).

## 4. The four mapping tables (per-field)

> **Cross-family assembly (D20)**: `order` is one **global numbering space** (shared by rules and prompts); numeric conflicts are rejected by lint; rendering lines everything up in a single sequence (AGENTS.md sections / system-prompt sections).

### 4.1 Skill mapping (D1–D5)

| TenantDocs field | → DSH | → Codex |
|---|---|---|
| `name` / `description` | As-is (parser checks: ≤64 / non-empty single line) | As-is into SKILL.md frontmatter |
| `whenToUse` | → frontmatter `whenToUse` | Dropped (or folded into description, configurable) |
| `metadata` | As-is (open object) | As-is; `short-description` is consumed |
| `ui` | → `metadata.x-buildingos.ui` (runtime-ignored) | → `openai.yaml interface` (key casing re-verified against the adopted version) |
| `invocation.model=false` | → `disable-model-invocation: true` | — |
| `invocation.user=false` | → `user-invocable: false` | — |
| `invocation.implicit=false` | → `metadata.x-buildingos.invocation-implicit: false` | → `openai.yaml policy.allow_implicit_invocation: false` |
| `products` | — | → `openai.yaml policy.products` |
| `dependencies` | Validation only (references must resolve in runtime.yaml) | → `openai.yaml dependencies` (transport/command/url derived from config) |
| `references[]` | → `resourceBase` (loaded on demand) | `references/` subdirectory as-is |
| `scripts[]` | As-is (DSH ignores but preserves) | As-is under `.codex/skills/<name>/scripts/` (implicit invocation) |
| `data[]` | Not in the view (body references; tenant filesystem readable) | Not in the view (same) |

### 4.2 Rules mapping (D6–D9)

| TenantDocs field | → DSH | → Codex |
|---|---|---|
| `sections[]` (ordered by `order`) | → system-prompt section (e.g., `rules:<id>`, order maps the assembly sequence) | → AGENTS.md sections (root-level, by order; `appliesTo` targeting a subdirectory lands in that subdirectory's AGENTS.md) |
| `enforce=hard` + `permission` | → derive sandbox / approval config entries | → permission note in the section + generated permission-check entry (Codex has no native permission layer; tool-level) |
| `enabled=false` | Skipped | Skipped |
| `appliesTo` | Ignored in M0 | Ignored in M0 |

### 4.3 Prompts mapping (D10–D12)

| TenantDocs field | → DSH | → Codex |
|---|---|---|
| `body` (multi-file merged by order) | → system-prompt persona section (persona zone order 0–50) | → developer instructions section (session level) |
| `language` | → persona / preset language setting | Folded into developer instructions text ("reply in zh-CN") |
| `tone` | Folded into section body | Folded into section body |

### 4.4 Configs mapping (D13–D15)

| TenantDocs field | → DSH | → Codex |
|---|---|---|
| `engine` / `model` | Model configuration | `model` / `model_provider` |
| `mcpServers[]` | cordis.yml `dsh-mcp-client` rows | `config.toml mcp_servers` section (or `.mcp.json`) |
| `sandbox` | Sandbox knob | `sandbox_mode` (same name) |
| `approval` | Approval policy | `approval_policy` (same name) |
| `memory` | mcp-client overlay (e.g., mcp-reference-memory) | memories toggle / mcp memory config |
| `ui` | — | — (BuildingOS layer) |
| permissions (derived) | Generates sandbox/approval entries | — (tool-level) |

## 5. run() and event normalization

`run(req: RunRequest, cfg: EngineConfig) → AsyncStream<AgentEvent>`.

**AgentEvent type extension** (relative to api-contract §6's seven types, two more — plan and approval are real event surfaces on both engines):

```ts
type AgentEvent =
  | { type: 'thought'; ts: string; payload: { text: string } }
  | { type: 'tool.call';   ts: string; payload: { tool: string; args: unknown } }
  | { type: 'tool.result'; ts: string; payload: { tool: string; ok: boolean; result?: unknown } }
  | { type: 'step';        ts: string; payload: { step: string; summary?: string } }
  | { type: 'message';     ts: string; payload: { text: string } }
  | { type: 'artifact';    ts: string; payload: { type: string; data: unknown } }
  | { type: 'error';       ts: string; payload: { code: string; message: string } }
  | { type: 'approval.request'; ts: string; payload: { id: string; description: string; options?: string[] } }
  | { type: 'user.input.request'; ts: string; payload: { id: string; question: string; options?: string[] } };
```

**Engine event mapping** (calibrated against the locked version at implementation):

| BuildingOS AgentEvent | DSH event surface | Codex event surface |
|---|---|---|
| `thought` | Thinking segments in session events (calibrate) | `PlanDelta` / `AgentMessageContentDelta` (protocol_v1) |
| `tool.call` / `tool.result` | `tool/call` + tool presentation (generic/terminal/diff) | Tool events in the codex/event stream (calibrate) |
| `step` | Step boundaries such as `agent/pre-step` | Steps between `TurnStarted` / `TurnComplete` |
| `message` | Message events | `AgentMessage` |
| `artifact` | Structured tool results (normalized) | Same (structured content) |
| `error` | `turn/end` errors | `Error` / `Warning` |
| `approval.request` | user-approval seam (`approval/request`) | `ExecApprovalRequest` / `applyPatchApproval` (mcp-server) |
| `user.input.request` | `ask_user_question` (user-interaction seam) | `RequestUserInput` |

## 6. Conformance criteria (M1 core)

| Dimension | Criterion | Failure handling |
|---|---|---|
| **Interface conformance** | Adapter passes `adapter-contract/v1` contract tests (type checks + boundary cases) | Build failure → not published |
| **Behavioral conformance** | Golden task set (below) passes all assertions | Any red → alert + pin last-known-good |
| **Policy conformance** | Permission matrix: tools denied by tenant policy must be refused with `POLICY_DENIED` on **both** engines | Any leakage → publish blocked |
| **Update gate** | Upstream release → auto-build → full conformance | All green auto-publish / red → pin |

**Golden task set (G1–G4, initial)**:

| Task | Input | Assertions |
|---|---|---|
| G1 `network-diagnose` | Golden skill (examples/skills/network-diagnose) + knowledge/ data + runtime.yaml (telemetry registered) | Event stream shape valid; `artifact` includes `confidence`; no fabricated fields; `mcp://telemetry/*` tool calls appear as `tool.call` |
| G2 Read-only knowledge Q&A | Q&A answered from `knowledge/network.md` | Answer traceable to the knowledge document (referenced path appears); `message` events non-empty |
| G3 Permission denial | Request a tool denied by `permissions` (e.g., `write:router`) | Returns a `POLICY_DENIED` error event; no actual execution on the engine side |
| G4 Plan scenario | Plan-mode session (DSH `exit_plan_mode` / Codex `<proposed_plan>`) | `approval.request` (or equivalent plan review surface) appears; no mutation executed |

**Round-trip consistency** (compile layer): BuildingOS → engine view → re-import → semantically equivalent (the D1–D21 lossless rules, including the `x-buildingos` carry namespace).

## 7. Adapter lifecycle (the self-maintaining pipeline)

```
Upstream release/tag (DSH, Codex)
  → release hook triggers the build
  → conformance suite (§6)
  → all green → auto-publish (emits adapter.updated; tenants may hot-reload opt-in)
  → any red → alert + pin last-known-good version
```

- Adopting a new engine is a deliberate community review (M4+), outside automatic tracking (per the README).
- Each adapter is versioned independently (`adapter:<engine>:<version>`), pinned with the engine version.

## 8. Implementation checklist (M1 deliverables)

- [x] `adapter-contract/v1` type definitions ([schemas/contract/](../schemas/contract/README.md))
- [x] Validation & normalization module **design** ([normalizer-design.md](normalizer-design.md)) — implementation is the #4 work item
- [ ] **DSH adapter**: compile (skills→.dsh/skills, rules→system-prompt sections, prompts→persona, configs→cordis.yml) + run (event bridge, §9 selection)
- [ ] **Codex adapter**: compile (skills→.codex/skills+openai.yaml, rules→AGENTS.md, prompts→developer instructions, configs→config.toml) + run (event bridge, §9 selection)
- [ ] Conformance suite: golden task set G1–G4 + permission matrix + round-trip tests
- [ ] Auto-tracking pipeline: release hook → build → conformance → publish/pin
- [ ] Dogfooding: the BuildingOS documentation repository itself runs as the first tenant on the DSH adapter (per the README)

## 9. Open items (decided during M1 implementation)

| # | Topic | Notes |
|---|---|---|
| 1 | DSH `run()` bridge form | ACP (automation-only) vs. in-process cordis ctx invocation — evaluated at implementation |
| 2 | Codex `run()` bridge form | `codex mcp-server` (experimental, thread/turn RPCs) vs. protocol v1 (SQ/EQ, not a stable wire contract) — leaning mcp-server; requires locked-version validation |
| 3 | EngineView materialized vs. in-memory | Per-adapter choice (DSH leans in-memory registration; Codex leans materialized + mcp-server) |
| 4 | Event field naming | §5 normalized field names frozen after golden-task validation (G1–G4) |
| 5 | **C1: Codex `interface` key casing** ([compile-verification.md](compile-verification.md) §3) | openai.yaml interface generated in snake_case, but the serde rename is not explicitly visible — validate against real loading at the adopted version, then freeze |
| 6 | **C2: cross-family merge ordering** | ✅ Resolved (D20): order is one global numbering space, duplicates rejected by lint; examples re-ordered 10/20/30 |
| 7 | **C3: DSH cordis.yml config key shapes** | system-prompt / mcp-client wiring keys; calibrated against real cordis config when implementing the DSH adapter |

## 10. Changelog

| Version | Summary |
|---|---|
| v0.1 | M1 design draft: TenantDocs / EngineView field-level definitions, four mapping tables, event normalization (AgentEvent extended to 9 types), conformance criteria (G1–G4), adapter lifecycle, implementation checklist, open items |
| v0.2 | First live compile verification ([compile-verification.md](compile-verification.md)): skill mapping validated; calibration points C1–C3 registered |
| v0.3 | C2 closed (D20: order global numbering space); `adapter-contract/v1` type definitions as JSON Schema ([schemas/contract/](../schemas/contract/README.md)) |
| v0.4 | Validation & normalization module design ([normalizer-design.md](normalizer-design.md)): pipeline stages 1–2 + set-level lint catalog + module interface + round-trip test cases |
| v0.5 | N1 decision: SkillDoc models `scripts[]` (contract schema synced); normalizer N3 decision (lint severity hard-coded in M1, configurable in M2) |
