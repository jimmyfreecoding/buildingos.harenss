# BuildingOS Skill Document Specification (DRAFT v0.1)

> Status: M0 draft, awaiting review. Machine-validatable version: [skill.schema.json](skill.schema.json).
> Field constraints based on: DSH `docs/subsystems/skills.md`; Codex `skills/src/parser.rs`, `ext/skills/src/loader/metadata.rs`, `skills/src/invocation.rs` (commit `d21794d6`).
>
> 中文版：[skill.schema_cn.md](skill.schema_cn.md)

## 1. Position

`skills/*.md` is BuildingOS's know-how document primitive — **the only primitive both engines natively support in a converged format.** This spec defines its unified format (superset) and the `compile()` mapping to DSH / Codex (§4).

## 2. File layout (canonical bundle)

The standard shape in a tenant repository (directory bundle, compatible with both engines):

```
skills/<skill-name>/
├── SKILL.md            # body = instructions; frontmatter per §3
├── references/         # supplementary documents (optional), explicitly referenced from the body
└── scripts/            # scripts (optional) → TenantDocs scripts[] (N1 settled); Codex implicit invocation semantics; DSH ignores but preserves
```

- Names are `kebab-case` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), ≤64 characters.
- **The canonical shape is the bundle (the only first-class form, settled in M0)**: Codex only recognizes bundles; a unified shape is required for both engines.
- Flat `<skill-name>.md` is **import-only compatible**: auto-upgraded to a bundle on import (equivalent to a single-file bundle when there are no references/scripts), keeping the tenant repository's shape uniform.

## 3. frontmatter fields (BuildingOS unified format)

```yaml
---
name: network-diagnose                 # required: kebab-case, ≤64, single line
description: 基于网络遥测诊断交换机/AP 健康度   # required: non-empty, single line
when-to-use: 用户报告延迟升高、丢包、端口抖动时   # optional: routing hint
metadata:                               # optional: open object
  short-description: 网络健康诊断       # known key: consumed by Codex
  author: ops-team                      # open extension
  version: 1.0.0
ui:                                     # optional: display metadata (M0 settled, top-level block)
  display-name: 网络诊断                # 1:1 mapping to Codex interface
  short-description: 网络健康诊断
  brand-color: '#3B82F6'
  default-prompt: 诊断一下网络健康
invocation:                             # optional: unified invocation policy (§5 mapping)
  model: true                           # default true: model-invocable → DSH disable-model-invocation (inverse)
  user: true                            # default true: user-invocable → DSH user-invocable
  implicit: false                       # default true: Codex implicit invocation; DSH runtime-ignores, losslessly carried in metadata
products: []                            # optional: product gating (→ Codex policy.products)
dependencies:                           # optional: tool reference list (M0 settled: references only; registration in runtime.yaml)
  tools:
    - type: mcp                         # required
      value: telemetry                  # required; must resolve in runtime.yaml (CI check)
references:                             # optional: reference declarations (resources referenced from the body)
  - references/thresholds.md
data:                                   # optional: tenant data dependencies (M0 settled: distinct from references)
  - topology.yaml                       # tenant repository path; CI verifies existence
---
```

### Field detail

| Field | Required | Constraints | Anchor |
|---|---|---|---|
| `name` | ✅ | kebab-case; ≤64; single line; falls back to the directory name (on import) | DSH / Codex parser |
| `description` | ✅ | non-empty; single line (bare-colon values are auto-repaired into quotes) | DSH / Codex parser |
| `when-to-use` | optional | routing hint, single line | DSH `whenToUse` |
| `metadata` | optional | open object; known key `short-description`; `x-buildingos` reserved for cross-engine lossless carry | DSH `metadata` / Codex `metadata` |
| `ui` | optional | display metadata (see §4.1); 1:1 mapping to Codex `interface`; carried in metadata on DSH | Codex `interface` |
| `invocation.model` | optional | bool, default true | DSH `disable-model-invocation` (inverse) |
| `invocation.user` | optional | bool, default true | DSH `user-invocable` |
| `invocation.implicit` | optional | bool, default true; **DSH runtime-ignores, losslessly carried in metadata** | Codex `policy.allow_implicit_invocation` (inverse) |
| `products` | optional | string[] | Codex `policy.products` |
| `dependencies.tools[]` | optional | **references only** (type+value required); transport/auth derived by compile from runtime.yaml | Codex `dependencies.tools` (import-compatible fields kept) |
| `references[]` | optional | relative path (within the bundle) or URL | DSH resourceBase / Codex references/ |
| `data[]` | optional | tenant data file paths (within the tenant repo); distinct from references | no engine view; lint / audit / context assembly (M0 settled) |

### Body conventions

- Instructions in Markdown; make **steps**, **output shape**, **confidence requirements**, and **read-only default with authorization boundary** explicit.
- Resources referenced from the body must be declared in `references[]` (import tolerance: undeclared files under references/ are auto-declared during compile).

## 4. Dual-engine mapping (the basis of compile())

| BuildingOS field | → DSH view | → Codex view |
|---|---|---|
| `name` / `description` | as-is into frontmatter | as-is into SKILL.md frontmatter |
| `when-to-use` | → `whenToUse` | — (fold into description or drop) |
| `metadata` | → `metadata` (as-is) | → `metadata` (as-is; `short-description` consumed) |
| `ui` | → `metadata.x-buildingos.ui` (runtime-ignored, round-trip lossless) | → `openai.yaml` `interface` (key casing re-verified against the adopted version) |
| `invocation.model=false` | → `disable-model-invocation: true` | — |
| `invocation.user=false` | → `user-invocable: false` | — |
| `invocation.implicit=false` | → `metadata.x-buildingos.invocation-implicit: false` (runtime-ignored) | → `openai.yaml` `policy.allow_implicit_invocation: false` |
| `products` | — | → `openai.yaml` `policy.products` |
| `dependencies` | — (DSH tools registered via `configs/runtime.yaml`; references validated only) | → `openai.yaml` `dependencies` (references only; transport/command/url/oauth derived from runtime.yaml) |
| `references[]` | → `resourceBase` (loaded on demand, no directory enumeration) | `references/` subdirectory as-is |

### 4.1 The `ui:` block fields (M0 settled)

| Field | Description | Codex `interface` counterpart |
|---|---|---|
| `display-name` | display name | `display_name` |
| `short-description` | short description | `short_description` |
| `icon-small` / `icon-large` | icons (bundle-relative path or URL) | `icon_small` / `icon_large` |
| `brand-color` | theme color (`#RRGGBB`) | `brand_color` |
| `default-prompt` | default starter prompt | `default_prompt` |

> **M3 bridge**: UI Skill documents (the preset "top-tier UI" Skill and coding-rule documents) inherit and extend this vocabulary — `ui:` is display metadata; a UI Skill is the rule document for "how product interfaces are generated." Same source, different layer.

## 5. Import rules (engine assets → tenant repository)

| Source format | Import action |
|---|---|
| DSH `<name>/SKILL.md` or `<name>.md` | frontmatter accepted as-is: `whenToUse`→`when-to-use`, `disable-model-invocation`→`invocation.model` (inverse), `user-invocable`→`invocation.user`; unknown fields into `metadata`; **flat files auto-upgraded to bundles** |
| Codex `<name>/SKILL.md` + `openai.yaml` + `references/` | SKILL.md frontmatter accepted as-is; `openai.yaml`: `policy`→`invocation.implicit`/`products`, `dependencies`→`dependencies` (import-compatible fields such as transport kept), `interface`→`ui`; `references/` as-is |

Import is **tolerant parsing**: no known-engine file that fails the unified schema blocks the import; unknown content is preserved and flagged by lint. **The canonical shape is the bundle only (M0 settled).**

## 6. Validation and conformance

- **M0 lint (the schema-lint check in PR CI)**: `skill.schema.json` validates frontmatter; `references[]` declarations consistent with body references; `dependencies` references resolvable in `configs/runtime.yaml` (M0 settled: layered registration); `data[]` paths exist in the tenant repository (M0 settled).
- **Engine-view validation**: compile output must pass each engine's parser semantics (DSH: name ≤64, description non-empty; Codex: parser + openai.yaml valid).
- **Round-trip consistency (conformance behavioral dimension)**: BuildingOS → engine view → re-import → semantically equivalent. **Lossless rule**: `invocation.implicit` and `ui` are carried on the DSH side via `metadata.x-buildingos.*` — round-trips never lose them (M0 settled).

## 7. Complete example: network-diagnose

Unified format (tenant repository `skills/network-diagnose/SKILL.md`):

```markdown
---
name: network-diagnose
description: 基于网络遥测诊断交换机/AP 健康度，输出带置信度的结构化结论
when-to-use: 用户报告延迟升高、丢包、端口抖动时
metadata:
  short-description: 网络健康诊断
  author: ops-team
ui:
  display-name: 网络诊断
  short-description: 网络健康诊断
  brand-color: '#3B82F6'
invocation:
  model: true
  user: true
  implicit: false
dependencies:
  tools:
    - type: mcp
      value: telemetry
references:
  - references/thresholds.md
data:
  - topology.yaml
---
```

(Full body: see [examples/skills/network-diagnose/SKILL.md](../examples/skills/network-diagnose/SKILL.md) and the three-view compile demo in [examples/skills/README.md](../examples/skills/README.md).)

## 8. Decision record (M0 review, settled)

| # | Topic | Decision | Where it lands |
|---|---|---|---|
| 1 | `invocation.implicit` on DSH | **runtime-ignore + `metadata.x-buildingos.invocation-implicit` lossless carry** (round-trip safe) | §4 mapping, §6 round-trip rule |
| 2 | Codex `interface` ownership | **top-level `ui:` block** (structured, validatable; 1:1 mapping to Codex interface; the M3 UI-Skill vocabulary inherits it) | §3 field table, §4.1 |
| 3 | `dependencies` boundary | **Layered**: runtime.yaml = registration directory (transport/auth single source of truth); skill `dependencies` = reference list (type+value); CI verifies references resolve | §3, §6 lint |
| 4 | flat `<name>.md` | **import-only + auto-upgraded to a bundle on import**; the canonical shape is the bundle | §2, §5 |
| 5 | skill dependence on tenant data (surfaced by the example acceptance) | **`data:` field added**: distinct from references (references = skill resources / data = tenant data); CI verifies paths exist; dynamic context assembly uses it | §3, §4, §6 |
