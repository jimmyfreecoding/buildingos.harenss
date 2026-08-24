# BuildingOS Rules Document Specification (DRAFT v0.1)

> Status: M0 draft, awaiting review. Machine-validatable version: [rules.schema.json](rules.schema.json).
> Field constraints based on: docs/api-contract.md Appendix A — Codex `AGENTS.md` (`agents_md.rs`: hierarchical root→cwd collection, `AGENTS.override.md` precedence, byte caps); DSH system-prompt assembly seams (named sections + order: persona=0, mode:policy=50, tool guidance=100–199).
>
> 中文版：[rules.schema_cn.md](rules.schema_cn.md)

## 1. Position

`rules/` = the AI's "constitution": **behavior boundaries and constraints.** Unlike skills ("capabilities": how to do something), rules describe how to behave, what not to do, and where the boundary lies.

## 2. File layout

```
rules/<rule-id>.md       # flat files (both engines' rule carriers are files/sections; no bundle requirement)
```

## 3. frontmatter fields

| Field | Required | Constraints | Engine mapping |
|---|---|---|---|
| `id` | ✅ | kebab-case, globally unique | identifier (AGENTS.md heading / DSH section name) |
| `title` | optional | single line | AGENTS.md section heading |
| `description` | optional | purpose note (into index/review, not necessarily into the prompt) | — |
| `scope` | optional | `all` / `tools` / `session` / `surface`, default `all` | decides assembly placement (§4) |
| `enforce` | optional | `hard` / `soft`, default `soft` | hard → must carry `permission` (generative, Q1 settled); soft → prompt guidance only |
| `permission` | required when hard | `{ effect: allow\|deny, resource: <pattern> }`; vocabulary shared with runtime.yaml `permissions` | compile derives runtime.yaml permission entries (single source of truth) |
| `order` | optional | integer, default 100, lower first; **one global numbering space (D20)**: shared with prompts, duplicates rejected by lint | AGENTS.md section order / DSH section order |
| `applies-to` | optional | applicable surface (e.g., `ops-engineer`); **reserved in M0, compile ignores** (Q3 settled) | on import: Codex subdirectory AGENTS.md → directory name |
| `enabled` | optional | bool, default true | false → skipped in compile |
| `references` | optional | related document paths | — |

> **Multi-section (Q2 settled)**: one file may contain multiple `##` sections; section order = in-file order; cross-file ordering uses the file-level `order` (compile sorts files by order, then expands sections in-file).

Body = the constraint instructions (Markdown). Example:

```markdown
---
id: no-data-exfiltration
title: 数据不出租户边界
scope: all
enforce: hard
permission:
  effect: deny
  resource: data:*:external
order: 10
---

# 数据不出租户边界

禁止将客户数据发送至租户边界之外的任何端点。
```

## 4. Dual-engine mapping (the basis of compile())

| BuildingOS | → Codex view | → DSH view |
|---|---|---|
| `rules/*.md` (enabled=true) | merged into **AGENTS.md sections** by `order` (root-level; `applies-to` targeting a subdirectory lands in that subdirectory's AGENTS.md, root→cwd nearest concatenation) | compiled into **system-prompt sections** (e.g., `rules:<id>`, `order` maps the assembly sequence) |
| `enforce: hard` + `permission` | permission note in the section + generated permission-check entry (Codex has no native permission layer) | **compile derives runtime.yaml `permissions` entries from the `permission` fragment** (generative; single source of truth, Q1 settled) |
| `enabled: false` | skipped | skipped |
| `applies-to` | **ignored in M0** (semantics await the multi-agent scenario, Q3 settled) | **ignored in M0** |
| forced override (optional output) | → `AGENTS.override.md` (takes precedence over ordinary AGENTS.md, native Codex semantics) | — |

## 5. Import rules

| Source | Import action |
|---|---|
| Codex `AGENTS.md` | split by `##` headings into `rules/*.md`; `<INSTRUCTIONS>` wrappers removed; `order` by occurrence; `AGENTS.override.md` imported as a `enforce: hard` candidate |
| DSH system-prompt section config | split per section; `order` from config; section name → `id` |

## 6. Validation and conformance

- **M0 lint**: `id` kebab-case and unique; `scope` / `enforce` enum-valid; `order` integer; `references` paths exist.
- **Hard-rule consistency (generative, Q1 settled)**: `enforce: hard` must carry a valid `permission` fragment (effect enum + resource pattern valid); `permission` alongside `enforce: soft` → lint error. runtime.yaml `permissions` is **derived** from all hard rules and never hand-written — drift is structurally impossible.
- **Engine-view validation**: Codex view is valid AGENTS.md (plain-text sections, total under the engine byte cap); DSH view section assembly order correct.
- **Round-trip consistency**: `enforce` / `order` / `scope` / `permission` semantics lossless.

## 7. Boundary with adjacent documents

| Document | Answers the question | Typical content |
|---|---|---|
| `rules/` | boundaries and constraints (constitution) | no data exfiltration, read-only default, authorization before actions |
| `skills/` | how to do something (capability) | diagnosis procedures, tool-call steps |
| `prompts/` | tone and persona (personality) | professional, concise, reply in Chinese |
| `configs/runtime.yaml` | runtime parameters (engine/tools/permissions) | mcp_servers, permissions (derived from hard rules), engine |

> **rules vs. prompts criterion (Q4 settled)**: when the model violates it, does the user see a **bug or a style preference**? bug → rules (enforceable); tone/format preference → prompts. A `scope: surface` rule is still an enforceable rule, not a persona.

## 8. Decision record (M0 review, settled)

| # | Topic | Decision | Where it lands |
|---|---|---|---|
| 1 | single source of truth for hard rules | **Generative**: hard rules carry a machine-readable `permission` fragment; compile derives runtime.yaml permissions; CI validates only the fragment | §3 field table, §4 mapping, §6 lint |
| 2 | multi-section rule files | **Allowed**: section order = in-file order; cross-file ordering via file-level `order`; no per-section syntax | §3 note, §5 import |
| 3 | `applies-to` modeling timing | **Reserved in M0**: compile ignores; on import, Codex subdirectory AGENTS.md → `applies-to` directory name; semantics await the multi-agent scenario | §3, §4 |
| 4 | rules vs. prompts boundary | **Bug-vs-style criterion**: violation is a bug → rules; style preference → prompts; `scope: surface` is still an enforceable rule | §7 boundary table |
