# TenantDocs Normalizer Design (M1 design draft v0.2)

> Position: stages 1–2 of the three-stage compile pipeline (parse & validate → normalize → render) — turning tenant repository documents (kebab-case frontmatter) into the normalized TenantDocs model (camelCase, adapter-contract/v1).
> **Engine-agnostic, pure functions, no side effects** — stage 3 (render) belongs to the per-engine adapters.
> Related: [adapter-contract.md](adapter-contract.md) §2, [schemas/](../schemas/README.md), [Contract Philosophy](../docs/contract-philosophy.md) D1–D21, [compile-verification.md](compile-verification.md).
>
> 中文版：[normalizer-design_cn.md](normalizer-design_cn.md)

## 1. Boundary

| | Does | Does not |
|---|---|---|
| Input | Tenant repository `.buildingos/` + `knowledge/` (or `users/` subdirectories) | — |
| Output | `TenantDocs` (validated against adapter-contract.schema.json) | Does not render engine views (stage 3) |
| Side effects | None (pure functions) | No file writes, no network, no engine calls |

## 2. Processing pipeline

```
Tenant repository files
  → [1a parse] frontmatter extraction (YAML) + body split
  → [1b validate] each document against its schema (skill/rules/prompts/configs) + cross-field rules
  → [2  normalize] key mapping (kebab→camel), defaults, structural transforms, composition rules
  → [2b set-level lint] cross-document rules (order uniqueness, reference resolution, derivation checks)
  → TenantDocs (output)
```

### 2.1 Parse (1a)

- **Frontmatter extraction**: `---`-delimited YAML block + Markdown body split. Tolerance semantics follow DSH skill-filesystem: **bad files warn-and-skip, never block the whole load** (one bad source must not fail every agent request).
- **Skill bundle scanning**: `skills/<name>/SKILL.md` (canonical, D1) + same-directory `references/`, `scripts/` (scripts collected as relative path lists, N1 settled); flat `<name>.md` auto-upgraded to a bundle on import (D1).
- **Rules multi-section split** (D7): `##` headings → `sections[]`; file-level frontmatter is the default.
- **Knowledge**: free-form Markdown (D19/t3); only path+content collected, no structural validation.

### 2.2 Validate (1b)

Each document passes its JSON Schema (`schemas/*.schema.json`): field structure, enums, formats (kebab-case, `#RRGGBB`, BCP-47), and `enforce: hard → permission required` (schema if-then).

### 2.3 Normalize (2)

| Transform | Notes |
|---|---|
| Key mapping | kebab-case → camelCase: `when-to-use`→`whenToUse`, `short-description`→`shortDescription`, `display-name`→`displayName`, `mcp_servers`→`mcpServers`, etc. |
| Defaults | invocation (model/user/implicit default true), order (default 100), enabled (default true), language (default zh-CN), sandbox (read-only), approval (on-request) |
| Structural transforms | skill metadata open object carried as-is (including the `x-buildingos` lossless namespace, D2/D4/D19); rule sections merged into `sections` |
| Persona merge (D10) | prompts sorted by order, bodies merged (id-boundary comments preserved) |
| Permission derivation (D6/D14) | all hard-rule `permission` fragments → normalized PermissionSet (for rendering and run) |
| Skill layering (D17) | same-name skills: tenant-owned > industry template > platform-bundled (template layer from M4) |
| Reference completion | files under references/ referenced from the body are auto-added to `references[]` (import tolerance, D5) |
| Scripts preservation | `scripts/` relative paths → SkillDoc.scripts[] (N1; paths only — never executed, never in context) |

### 2.4 Set-level lint (2b)

Rules that schemas cannot express — **cross-document / set-level** (matching the "needs CI" catalog in schemas/contract/README.md):

| Rule | Severity | Basis |
|---|---|---|
| order globally unique (rules + prompts in one numbering space) | error | D20 |
| `dependencies[].value` resolvable in `mcpServers` | error | D3 |
| `permissions` section present in runtime.yaml | error | D14 (derivation forbids hand-writing) |
| `references[]` / `data[]` paths exist | warning→error (warning in M1) | D5/D19 |
| Multiple enabled prompts without role distinction | info (merge will occur) | D10 |
| Unknown frontmatter fields | warning (into metadata or ignored; never blocking) | import tolerance |

## 3. Module interface (implementation blueprint)

```ts
// @buildingos/normalizer —— engine-agnostic
interface LoadTenantDocsOptions {
  repoRoot: string;          // tenant repository root (where .buildingos/ lives)
  skillLayers?: SkillLayer[]; // D17 layers (platform/industry templates), used from M4
}

interface LoadResult {
  docs: TenantDocs;          // validated against adapter-contract.schema.json
  diagnostics: Diagnostic[]; // lint catalog (error/warning/info)
  ok: boolean;
}

interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;              // e.g., ORDER_DUPLICATE, DEP_UNRESOLVED
  file?: string;
  message: string;
}

async function loadTenantDocs(opts: LoadTenantDocsOptions): Promise<LoadResult>
```

- The emitted `docs` **must** pass adapter-contract.schema.json validation (`ok=false` lets the caller decide whether to block).
- Failure strategy: 1b schema violations → error (blocking); bad files / unknown fields → warn-and-skip (non-blocking, matching DSH semantics).

## 4. Round-trip test design (conformance preparation)

**Goal**: normalizer (unified format → TenantDocs) and import (engine view → unified format) are mutual inverses, lossless (D1–D21 lossless rules).

```
[unified format] → normalizer → TenantDocs → render → [engine view]
                       ↑                                        ↓
                  [import] ← unified format ← [import parse] ← [engine view]
```

Cases (fixtures from examples/):

| Case | Assertions |
|---|---|
| Full examples/ load | `ok=true`; TenantDocs passes the contract schema; no error diagnostics |
| network-diagnose normalization | frontmatter kebab→camel correct; invocation defaults; `metadata.x-buildingos` preserved; dependencies/data complete |
| Persona merge | multiple prompts merged by order, boundary comments preserved |
| Hard-rule derivation | PermissionSet contains `deny data:*:external`, `deny write:*`; runtime.yaml has no permissions section (reverse case asserts the lint error) |
| Duplicate order | construct rules=20 + prompts=20 → `ORDER_DUPLICATE` error |
| Engine-views reverse compile | dsh/.codex views → unified format → normalizer → TenantDocs semantically equivalent to the original input (D2/D4 lossless namespace verified) |
| Scripts round-trip | example skill `scripts/telemetry-snapshot.py` → scripts[] → engine view as-is → import back to scripts[] (N1) |

## 5. Dependencies and tooling

| Item | Choice | Basis |
|---|---|---|
| YAML frontmatter | DSH's `yaml` package + a hand-written frontmatter extractor | DSH precedent ("yaml is the modern parser") |
| JSON Schema validation | ajv (standard in the TS ecosystem) | same toolchain as the schemas/ family |
| Implementation language | TypeScript (DSH ecosystem alignment; dogfooding-friendly) | Dogfooding per the README |
| Packaging | `@buildingos/normalizer` standalone package (pure functions, no engine dependency) | clean module boundary |

## 6. Implementation breakdown (M1 #4 deliverable)

- [ ] Frontmatter extractor (`---` delimited + tolerance + bad-file warn-and-skip)
- [ ] Five-family loaders (skill bundles / rules multi-section / prompts / configs / knowledge)
- [ ] Normalizer (key mapping + defaults + structural transforms + persona merge + permission derivation + layering)
- [ ] Set-level lint (order uniqueness, reference resolution, permissions no-hand-write, etc.)
- [ ] Round-trip test suite (§4 cases)
- [ ] Contract-schema validation wiring (output gate)

## 7. Decision record (M1 review, settled)

| # | Topic | Decision | Where it lands |
|---|---|---|---|
| N1 | skill `scripts/` modeling | **Model `scripts: string[]`**: symmetric with references; lintable / auditable / round-trip assertable; Codex implicit invocation only needs the files in place, DSH ignores but preserves (D2 philosophy) | §2.1, §2.3, §4; contract schema SkillDoc |
| N2 | knowledge light-frontmatter timing | **Keep t3**: knowledge loader collects path+content first; upgrade when real needs appear (still under observation) | §2.1 |
| N3 | tenant-configurable lint severity | **Hard-coded in M1 + configurable in M2**: security-class rules all error, existence-class warning; do not guess requirements without real usage data | §2.4 |

## 8. Changelog

| Version | Summary |
|---|---|
| v0.1 | Design draft: module boundary, two-stage pipeline (parse-validate + normalize), set-level lint catalog, module interface, round-trip test cases, implementation breakdown, open items |
| v0.2 | N1/N3 decisions settled: skill `scripts[]` modeling (contract schema synced); lint severity hard-coded in M1 + configurable in M2; example skill gains `scripts/telemetry-snapshot.py` |
