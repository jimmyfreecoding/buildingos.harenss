# BuildingOS Tenancy Model and Data Boundaries (DRAFT v0.1)

> Status: DRAFT v0.1 — the data-model contract to be settled before M1; it is the basis for "where data comes from and where it goes" in the §6 Adapter Contract `compile()` interface.
> Related: [Contract Philosophy](contract-philosophy.md) D16–D19; [api-contract.md](api-contract.md) §2 Core Concepts, §4.6 tool governance; [schemas/](../schemas/README.md).
>
> 中文版：[tenancy-model_cn.md](tenancy-model_cn.md)

## 1. Core principles

1. 【Decided】**The Git repository is the application's brain plus world model — not user data.** The repository carries two kinds of documents: behavior documents (rules / skills / prompts / configs — how to think and work) and world-knowledge documents (documents like `network.md` — what the world looks like). User data (session state, transactional data) never enters the repository.
2. 【Decided】**Three-layer data boundary**: tenant-shared (Git) → user session private state (runtime state store) → user business data (existing systems, accessed through tools).
3. 【Decided】**Isolation is structural**: tenant-level (repository), user-level (session), tool-level (permissions derived from rules).
4. 【Decided】**Knowledge vs. data judgment (D19)**: **worth human review, subject to human edit, version-significant → Git (knowledge); transient, high-frequency, not worth review → DB (data).**

## 2. Three-layer data boundary

| Layer | Content | Storage | Isolation |
|---|---|---|---|
| **Tenant layer** | Application source: rules / skills / prompts / configs + shared business data (e.g., topology files, declared via the skill's `data:`) | Tenant Git repository | Between tenants (one customer, one repository) |
| **User session layer** | Conversation history, memory, personal preferences | Runtime state store (PostgreSQL + vectors + knowledge graph) | Isolated per user / session, **never in Git** |
| **User business data layer** | C-end users' own data (orders / profiles) or B-end business data | Existing business systems | Accessed via MCP tools with user-level authorization; BuildingOS **does not copy** it |

### 2.1 Knowledge vs. data (D19 criterion)

| Type | Examples | Where it lives |
|---|---|---|
| **Knowledge** (statements about the world) | network.md, topology, baselines, operating procedures | ✅ Git (reviewed / versioned) |
| **State** (transient state of the world) | conversation history, MIS transactions, ephemeral memory | ❌ State store / DB |

Criterion: **"Is it worth human review? Will people edit it? Does the version matter?"** Yes → Git; no → DB.

Data flow of one user request:

```
User input → session (state store reads memory / preferences)
          → context assembly (tenant Git: rules/skills/prompts + data: declarations)
          → engine execution (MCP calls into business systems, with user-level authorization)
          → results written back to the session state store
```

## 3. Two deployment shapes

| Shape | Tenant = | User = | Typical scenario |
|---|---|---|---|
| **B-end** | One customer (one Git repository) | Customer employees (session isolation) | Enterprise AI network ops, building IoT operations |
| **C-end** | One product (one Git repository) | End users (session + permission isolation) | AI assistant inside a SaaS product |

One BuildingOS deployment can serve many tenants simultaneously (many repositories); a tenant may hold B-end employees or C-end users — **tenant and user are orthogonal dimensions**.

## 4. World-knowledge documents (D19)

The repository is the brain plus the world model. World-knowledge documents are produced by the harness (the existing-project wizard's "automatic harness analysis"; the production companion's diagnoses), **reviewed by humans, then merged and versioned** — treated exactly like code.

### toB: tenant repository

```
<tenant-repo>/
├── .buildingos/          # brain: behavior documents (rules/skills/prompts/configs)
└── knowledge/            # world model (decision t1)
    ├── network.md        # harness analysis: topology / devices / baselines / procedures
    ├── topology.yaml
    └── ...
```

### toC: product repository

```
<product-repo>/
├── .buildingos/          # product brain (shared)
└── users/<user-id>/      # this user's world knowledge (decision t2)
    └── network.md
```

- **Mass-user degradation (decision t2)**: user knowledge preferably lives in Git (`users/<uid>/`); when user counts grow too large (millions), degrade to the storage layer (state store / object storage, loaded on demand) — knowledge worth reviewing stays in Git where possible, but the engineering path keeps an exit.
- **Free-form (decision t3)**: world-knowledge documents are free-form Markdown in M0, with no schema; a light frontmatter (id / type / source / review status) is considered after M1 validation.
- **Referencing**: skills declare knowledge documents via `data:` (e.g., `data: [knowledge/topology.yaml]`); CI verifies the paths exist (D5).

## 5. Skill layering (where multiple skill sets come from)

| Source | Examples | Override rule |
|---|---|---|
| Platform-bundled packs | UI skills, system skills | Default layer |
| Industry template packs (M4) | IoT ops templates, healthcare templates | Can be overridden by tenants |
| Tenant-owned (`.buildingos/skills/`) | The customer's own know-how | Nearest wins (nearest override) |

- Same-name priority: **tenant-owned > industry template > platform-bundled** (DSH's layered registry is the proven model; Codex supports project / user / plugin skills).
- **Importing existing skills**: ✅ import-tolerant (DSH / Codex native formats accepted directly, auto-upgraded to canonical bundles — skill.schema §5).
- **Editing**: ✅ documents as code — edit → PR → review → merge → hot reload; the M3 admin UI supports browsing / opening PRs.
- **Multiple products = multiple tenant repositories**, isolated by construction.
- 【M5】Role/user-scoped skill sets within a tenant (`applies-to` territory).

## 6. Tool governance (the four MCP states; see api-contract §4.6)

| Action | Mechanism | Status |
|---|---|---|
| **Use** | Engine MCP client, runtime invocation | ✅ Native |
| **Select** | Model-driven, bounded to registered ∩ permission-allowed (derived from rules) | ✅ |
| **Designate** | skill `dependencies.tools[]` references (registration stays in runtime.yaml, D3 layering) | ✅ |
| **Install** | AI proposes → runtime.yaml change PR → review and merge → hot reload (D14 extension: a new tool is a new permission surface); no runtime installation in M0/M1 | ⚠️ Governed form |

## 7. Open items (M1 / M5)

| Item | Owner |
|---|---|
| User-level personalization injection (e.g., "this user prefers concise replies") | M1 dynamic context assembly |
| User-level rules / skills (by role) | M5 (applies-to) |
| Codex `request_plugin_install` → governed PR flow mapping | M1 research (Appendix A.7) |
| State-store partitioning by tenant / user and retention | M1 research |
| World-knowledge document schema (type / source / review status) | After M1 validation (t3) |
| Degradation threshold for mass-user knowledge | M1 research |

## 8. Decision index

- [Contract Philosophy](contract-philosophy.md): D16 (three-layer data), D17 (skill layering), D18 (tool four states), D19 (world knowledge in the repository)
- api-contract: §2 Core Concepts, §4.6 tool governance
