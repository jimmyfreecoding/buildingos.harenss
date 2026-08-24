# BuildingOS Schemas (M0 deliverables)

> Status: M0 settled. The "documents as code" schema family for the tenant repository `.buildingos/`.
> Based on the engine-compatibility research in [docs/api-contract.md](../docs/api-contract.md) Appendix A (DSH primary source + Codex source-confirmed, commit `d21794d6`).
>
> 中文版：[README_cn.md](README_cn.md)

## Design principles

1. **Unified superset**: BuildingOS document formats are the common superset of DSH's and Codex's support surface (plus the blank areas we fill); one document, two engines.
2. **Import-tolerant, compile-generative**:
   - **Import** (engine assets → tenant repository): native DSH / Codex formats are accepted directly; known fields are mapped; unknown fields are kept in `metadata`.
   - **Compile** (tenant repository → engine views): the adapter's `compile()` generates the DSH view (frontmatter + resourceBase) and the Codex view (SKILL.md frontmatter + companion `openai.yaml` + references/).
3. **Source code is the source of truth**: field constraints are pinned to each engine's parser source (DSH `skills/src/...`; Codex `skills/src/parser.rs` + `ext/skills/src/loader/metadata.rs`), not external docs.
4. **Machine-validatable**: every schema ships a JSON Schema (`*.schema.json`) for the GitOps CI `schema-lint` check.

## M0 decision record (2026, settled)

| Topic | Decision |
|---|---|
| `invocation.implicit` on DSH | runtime-ignored + `metadata.x-buildingos.*` lossless carry (round-trip safe) |
| Codex `interface` ownership | top-level `ui:` block (1:1 mapping; the M3 UI-Skill vocabulary inherits it) |
| `dependencies` boundary | layered: runtime.yaml = registration directory / skill = reference list; CI verifies references resolve |
| Flat `<name>.md` | import-only compatible, auto-upgraded to a bundle on import; the canonical shape is the bundle |

> The plain-language memo of **all M0 decisions (D1–D21)** is [docs/contract-philosophy.md](../docs/contract-philosophy.md) (with per-decision "why" and trade-offs).

## Schema family

| Schema | Files | Status | Engine primitive |
|---|---|---|---|
| **Skill** | `skill.schema.json` / `skill.schema.md` | ✅ Settled (M0 review, 5 decisions) | DSH `<name>/SKILL.md`; Codex SKILL.md + `openai.yaml` |
| **Rules** | `rules.schema.json` / `rules.schema.md` | ✅ Settled (M0 review, 4 decisions: generative permission / multi-section / applies-to reserved / bug-vs-style) | DSH system-prompt plugins / presets; Codex hierarchical AGENTS.md |
| **Prompts** | `prompts.schema.json` / `prompts.schema.md` | ✅ Settled (M0 review, 3 decisions: merged multi-persona / semi-structured / session-level injection) | DSH persona/presets; Codex personality templates / developer instructions |
| **Configs** | `configs.schema.json` / `configs.schema.md` | ✅ Settled (M0 review, 3 decisions: unified vocabulary / no exception channel / memory placeholder) | DSH cordis.yml rows; Codex config.toml |
| UI Skills | `ui-skill.schema.json` (to build) | 📋 M3 | preset "top-tier UI" Skill/coding-rule documents (dynamically generated front-end) |
| World Knowledge | free-form Markdown (t3: no schema in M0) | 📋 after M1 validation | no engine-native primitive (Codex memories' `MEMORY.md` is an isomorphic precedent); toB `knowledge/` / toC `users/<uid>/` |
| **Adapter Contract** | [contract/](contract/README.md) | ✅ M1 draft | `adapter-contract/v1` machine-validatable types (TenantDocs / EngineView / RunRequest / AgentEvent) |

## Example acceptance (examples/)

- `examples/skills/network-diagnose/`: the skill-schema acceptance case (a real skill + references + three-view compile demo + checklist), see [examples/skills/README.md](../examples/skills/README.md).

## Versioning strategy

- Schema semantic versions are independent of the API contract (namespace `schema/v1`; the version is embedded in each file's `$id`).
- `v0.x` during M0 discussion; the first stable `v1.0` is locked after M0 review.
- Fields are additive only; breaking changes require a version bump plus a migration note.

## Validation entry (for CI)

```bash
# TODO: M1 provides a schema validation command (reusing the tenant-document lint toolchain)
# Input: the tenant repository's .buildingos/ directory; Output: the violation list
```
