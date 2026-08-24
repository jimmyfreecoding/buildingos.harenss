# schemas/contract — Adapter Contract v1 type definitions

> Status: M1 design draft v0.1. The **machine-validatable** version corresponding to [docs/adapter-contract.md](../../docs/adapter-contract.md) §2–§5 (TenantDocs / EngineView / RunRequest / AgentEvent).
> Relationship with the tenant-document schemas: **tenant documents (kebab-case frontmatter) → normalization → this contract model (camelCase)** — normalization happens in stage 2 of the three-stage compile pipeline.
>
> 中文版：[README_cn.md](README_cn.md)

## Files

| File | Content |
|---|---|
| `adapter-contract.schema.json` | all $defs: SkillDoc / RuleDoc / PromptDoc / RuntimeConfig / KnowledgeDoc / TenantDocs / GeneratedFile / EngineView / RunRequest / AgentEvent (9 event types) |

## Usage

- **Compile input validation**: after parsing and normalizing the tenant documents, validate the resulting TenantDocs against this schema (the root is `$ref: TenantDocs`).
- **Compile output validation**: validate EngineView separately (`$ref: #/$defs/EngineView`).
- **run event validation**: validate AgentEvent as a discriminated union (`$ref: #/$defs/AgentEvent`).
- **TypeScript types**: generated from this JSON Schema (tooling TODO — avoid hand-written duplicate drift).

## What the schema can express vs. what CI must add

| Rule | Where it lives |
|---|---|
| Field structure, enums, formats (kebab-case, #RRGGBB, BCP-47) | ✅ schema |
| `enforce: hard` requires `permission` | ✅ schema (if-then) |
| order globally unique (D20) | ⚠️ impossible across instances in a schema → **CI lint** (set-level check) |
| dependencies references resolvable in mcpServers | ⚠️ cross-document → **CI lint** |
| permissions derived from hard rules, hand-writing forbidden | ⚠️ derivation relationship → **CI lint** |
| persona merge ordering (D10) | ⚠️ set-level → **CI lint** |

## Versioning

- Contract versioned independently: `adapter-contract/v1` (independent of the Server API version).
- Breaking changes → v2 + migration window; the schema's `$id` embeds the version path.

## Validation entry (for CI)

```bash
# TODO: M1 provides the schema validation command (reusing the tenant-document lint toolchain)
# Input: TenantDocs JSON; Output: the violation list
```
