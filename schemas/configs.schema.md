# BuildingOS Configs Document Specification (DRAFT v0.1)

> Status: M0 draft, awaiting review. Machine-validatable version: [configs.schema.json](configs.schema.json).
> Field constraints based on: docs/api-contract.md Appendix A — DSH `cordis.yml` + presets + sandbox/approval knobs; Codex `config.toml` (model / sandbox_mode / approval_policy / mcp_servers).
>
> 中文版：[configs.schema_cn.md](configs.schema_cn.md)

## 1. Position

`configs/runtime.yaml` = tenant runtime parameters — **"the household registry of the tool world"** (Q3 layering: the single source of truth for MCP registration) plus engine/model/interface selection. Its relationship with rules/skills/prompts is in §7.

## 2. File layout

```
configs/runtime.yaml     # the single file (one per tenant)
```

## 3. Fields

| Field | Required | Constraints | Engine mapping |
|---|---|---|---|
| `version` | ✅ | schema version | — |
| `engine` | ✅ | `dsh` / `codex` / … (adopted adapters) | decides which adapter is enabled |
| `model` | optional | provider-agnostic handle | → Codex `model`; → DSH model configuration |
| `mcp_servers[]` | optional | `name` unique; `transport` (stdio/http); `command`/`url`; `env` | → Codex `mcp_servers` / `.mcp.json`; → DSH `dsh-mcp-client` rows |
| `sandbox` | optional | `read-only` / `workspace-write` / `danger-full-access`, default `read-only` (unified vocabulary, same names as Codex) | → Codex `sandbox_mode`; → DSH sandbox knob |
| `approval` | optional | `never` / `on-request` / `unless-trusted`, default `on-request` (unified vocabulary) | → Codex `approval_policy`; → DSH approval policy |
| `ui` | optional | `theme` / `surfaces` (web/mobile/voice) | — (BuildingOS layer, consumed by M3 dynamic UI) |
| `memory` | optional | `provider`: `mcp-memory` / `codex-native` | → DSH mcp-client overlay; → Codex memories toggle |
| `permissions` | ❌ **hand-writing forbidden** | derived from rules' hard rules (rules.schema Q1 generative) | lint errors when present |

Example:

```yaml
# configs/runtime.yaml
version: "0.1"
engine: dsh            # dsh | codex (engines are pluggable)
model: gpt-4o          # provider-agnostic handle
mcp_servers:
  - name: telemetry
    transport: stdio
    command: npx telemetry-mcp
sandbox: read-only
approval: on-request
ui:
  theme: dark
  surfaces: [web, mobile]
memory:
  provider: mcp-memory
# permissions are never hand-written here: derived from rules/ hard rules
```

> **Secret configuration (D21)**: model tokens, Git credentials, etc. **never enter this file** (every field in this file enters Git) — they go through env injection (M1) or a secret store (M2); see [runtime-bootstrap.md](../docs/runtime-bootstrap.md).

## 4. Dual-engine mapping (the basis of compile())

| BuildingOS | → Codex `config.toml` | → DSH `cordis.yml` / preset |
|---|---|---|
| `engine` / `model` | `model` / `model_provider` | model configuration |
| `mcp_servers[]` | `mcp_servers` section (or `.mcp.json`) | `dsh-mcp-client` rows |
| `sandbox` | `sandbox_mode` | sandbox knob |
| `approval` | `approval_policy` | approval policy |
| `memory` | memories toggle / mcp memory config | mcp-client overlay (e.g., mcp-reference-memory) |
| `ui` | — | — (BuildingOS layer) |
| `permissions` (derived) | — (Codex has no native permission layer; tool-level) | generates sandbox/approval entries |

## 5. Import rules

| Source | Import action |
|---|---|
| Codex `config.toml` | → `runtime.yaml` (`engine: codex`; model / sandbox_mode / approval_policy / mcp_servers mapped) |
| DSH `cordis.yml` / preset | → `runtime.yaml` (`engine: dsh`; mcp rows merged into `mcp_servers`) |

## 6. Validation and conformance

- **M0 lint**: `engine` in the adopted-adapter set; `mcp_servers[].name` unique and `transport` enum-valid; `sandbox` / `approval` enum-valid; **a `permissions` section → error "derived from rules; hand-writing forbidden."**
- **Cross-validation**: all skills' `dependencies.value` must resolve in `mcp_servers` (bidirectional); the derivation results of hard rules' `permission` match the engine views.
- **Engine-view validation**: generated `config.toml` / `cordis.yml` rows valid.
- **Round-trip consistency**: `engine` / `model` / `mcp_servers` / `sandbox` / `approval` lossless.

## 7. Boundary with adjacent documents

| Document | Answers the question | Relationship |
|---|---|---|
| `rules/` | boundaries (including `permission` fragments) | **derives** runtime.yaml permissions |
| `configs/runtime.yaml` | runtime parameters (registration / engine / model) | the single source of truth for registration |
| `skills/` `dependencies` | tool references (type+value) | **resolved** against `mcp_servers` (CI-verified) |
| `prompts/` | persona | independent |
| UI Skills (M3) | interface generation rules | the `ui` field feeds M3 |

## 8. Decision record (M0 review, settled)

| # | Topic | Decision | Where it lands |
|---|---|---|---|
| 1 | unified sandbox/approval vocabulary | **Confirmed**: `read-only / workspace-write / danger-full-access` + `never / on-request / unless-trusted` (same names as Codex, mappable to DSH; read-only by default) | §3 field table |
| 2 | permission exception channel | **No exceptions**: all permissions are rules; temporary access = a temporary rule through a PR (auditable, rollback-able) | §3, §6 lint |
| 3 | memory field shape | **Placeholder declaration**: `provider: mcp-memory / codex-native`; concrete fields after M1 research (Appendix A.7.3) | §3 |
