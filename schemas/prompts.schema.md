# BuildingOS Prompts Document Specification (DRAFT v0.1)

> Status: M0 draft, awaiting review. Machine-validatable version: [prompts.schema.json](prompts.schema.json).
> Field constraints based on: docs/api-contract.md Appendix A — DSH persona / preset configuration (system-prompt sections, persona assembly zone order 0–50); Codex developer instructions and personality templates (`core/templates/personalities/*.md`, e.g., `gpt-5.2-codex_friendly.md` / `gpt-5.2-codex_pragmatic.md`).
>
> 中文版：[prompts.schema_cn.md](prompts.schema_cn.md)

## 1. Position

`prompts/` = the AI's "persona": **character, tone, and response style.** Boundary criterion with rules (rules.schema §7, Q4 settled): **when the model violates it, does the user see a bug or a style preference?** bug → rules (enforceable); style preference → prompts (negotiable).

## 2. File layout

```
prompts/<prompt-id>.md       # flat files
```

## 3. frontmatter fields

| Field | Required | Constraints | Engine mapping |
|---|---|---|---|
| `id` | ✅ | kebab-case, globally unique | identifier (persona section name) |
| `title` | optional | single line | — |
| `description` | optional | purpose note (into index/review, not necessarily into the prompt) | — |
| `language` | optional | output language (simplified BCP-47, default `zh-CN`) | DSH language setting; folded into developer instructions text on Codex |
| `tone` | optional | free string (e.g., `professional, concise`) | folded into the persona body |
| `order` | optional | integer, default 100, lower first; **one global numbering space (D20)**: shared with rules, duplicates rejected by lint | DSH system-prompt persona section order; Codex developer instructions composition order |
| `enabled` | optional | bool, default true | false → skipped in compile |
| `references` | optional | related document paths | — |

Body = the persona description (Markdown: character, tone rules, response habits, taboos). Example:

```markdown
---
id: ops-engineer
title: 运维工程师人格
language: zh-CN
tone: professional, concise
order: 30
---

# 运维工程师

- 中文回答，保留英文技术术语。
- 结论先说，细节后补。
- 报告置信度；绝不编造数据。
- 运维结果以结构化 JSON 返回。
```

> Note: "never fabricate data" appearing in both the persona and a rule is **allowed duplication** — the persona owns the tone, rules own the enforceability (see §7 boundary). Unbreachable statements belong in rules, never rely on the persona alone.

> **Multi-persona (Q1 settled)**: in M0, all enabled personas are merged into one persona by `order` (conflicts settled in review); role/surface-based selection is reserved in M0 exactly like rules `applies-to` (modeled together in M5).

## 4. Dual-engine mapping (the basis of compile())

| BuildingOS | → Codex view | → DSH view |
|---|---|---|
| `prompts/*.md` (enabled=true) | compiled into **developer instructions sections** (Markdown isomorphic to collaboration-mode / personality templates) | compiled into **system-prompt sections** (persona assembly zone, `order` mapped directly) |
| `language` | folded into developer instructions text ("reply in zh-CN") | → persona / preset language setting |
| `tone` | folded into the persona body | folded into the section body |
| `enabled: false` | skipped | skipped |

> **Multi-persona merge (Q1 settled)**: multiple enabled personas are concatenated by `order` and injected as one; role/surface selection is not done in M0.
> **Granularity (Q3 settled)**: uniformly session-level — Codex injects into developer instructions (session level), DSH into persona sections (session level); Codex's model-level personality presets (friendly / pragmatic) are out of M0 scope.

## 5. Import rules

| Source | Import action |
|---|---|
| Codex personality templates (`friendly` / `pragmatic`, etc.) | → `prompts/<name>.md`, body as-is; filename → `id` |
| DSH persona / preset section config | split per section; `id` from section name; `order` from config |

## 6. Validation and conformance

- **M0 lint**: `id` kebab-case and unique; `language` in the allowed set; `order` integer.
- **Boundary check (Q4 criterion mechanized)**: unbreachable phrasing in the body ("禁止 / 必须 / 绝不"-class, without negotiating tone) → lint suggests moving to rules (a hint, not a block).
- **Multi-persona merge hint (Q1 settled)**: multiple enabled personas without role distinction → lint hints "will merge into a single persona by order."
- **Engine-view validation**: Codex developer instructions are valid Markdown sections; DSH section assembly order correct (persona zone 0–50).
- **Round-trip consistency**: `language` / `tone` / `order` (including merge order) lossless.

## 7. Boundary with adjacent documents

| Document | Answers the question | Criterion |
|---|---|---|
| `rules/` | boundaries and constraints | violation = bug → enforceable (enforce semantics) |
| `prompts/` | persona and tone | violation = style preference → negotiable |
| `skills/` | how to do something | capability (procedure) |
| `configs/runtime.yaml` | runtime parameters | engine / tools / permissions (derived from hard rules) |

## 8. Decision record (M0 review, settled)

| # | Topic | Decision | Where it lands |
|---|---|---|---|
| 1 | multi-persona model | **Merge-style**: all enabled personas merged into one by order; role/surface selection reserved in M0 exactly like rules `applies-to` (modeled together in M5); lint hints at merging | §3 note, §4, §6 |
| 2 | tone / language structured vs. body | **Semi-structured (confirmed)**: `language` machine-consumed (→ DSH language setting), `tone` folded into the body, the body is the persona's substance | §3 field table, §4 |
| 3 | persona granularity difference | **Uniform session-level injection**: Codex developer instructions + DSH persona sections; Codex model-level personality presets out of M0 scope | §4 |
