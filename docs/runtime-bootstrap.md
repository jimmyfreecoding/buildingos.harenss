# BuildingOS Runtime Bootstrap & Configuration (M1 design draft v0.1)

> Position: the runtime bootstrap and configuration-layering design — the last design block before writing code, bridging the normalizer (loads tenant documents) and the adapter (plugs into engines).
> Decisions: b1 three-layer configuration split (D21) / b2 secrets via env injection in M1, secret store in M2 / b3 web console is the interaction surface in M1 (CLI keeps init/dev) / b4 dev and prod as two postures of the same runtime.
> Related: [configs.schema](../schemas/configs.schema.md), [normalizer-design.md](normalizer-design.md), [tenancy-model.md](tenancy-model.md), [Contract Philosophy](contract-philosophy.md) D21.
>
> 中文版：[runtime-bootstrap_cn.md](runtime-bootstrap_cn.md)

## 1. Three-layer configuration split (D21; iron rule: keys never enter the repository)

| Layer | Content | Storage | Examples |
|---|---|---|---|
| **Bootstrap configuration** | first-boot choices and credential entry | local bootstrap session (CLI wizard) | engine selection, model selection, token entry |
| **Document configuration** | application behavior and parameters (the choices' results) | **Git** (`configs/runtime.yaml`) | engine, model, mcp_servers, sandbox, approval |
| **Secret configuration** | tokens, credentials | **env injection / secret store, never in Git** | MODEL_TOKEN, GIT_TOKEN |

- **Iron rule**: model tokens, Git credentials, and similar secrets are **never written into any file that enters Git** (runtime.yaml, skill/rule/prompt bodies, knowledge documents — none of them). Once in Git, the secret is in history forever — visible in PR reviews, permanent, and fatal to the whole governance model (the same philosophy as D14: no exceptions).
- At bootstrap: **choose** (A/B → document configuration), **fill** (C/D → secret configuration), **point** (to the tenant repository).
- At runtime: **read** document configuration (loaded by the normalizer) + **inject** secret configuration (env).

## 2. First-boot flow (CLI wizard, M1)

```
buildingos init
  1. Select the engine (dsh / codex)     → check local adapter availability (conformance status)
  2. Select the model                    → from the engine's model catalog (codex model/list; DSH model config)
  3. Configure model credentials: enter token  → write .env (local, .gitignore)
  4. Configure Git credentials: enter token   → write .env (or reuse system credentials / gh auth)
  5. Point to / initialize the tenant repository:
     - existing repository: git clone + point
     - new repository: generate the .buildingos/ skeleton (rules/skills/prompts/configs/knowledge + examples)
  6. Validate: loadTenantDocs (normalizer) → diagnostics (errors block / warnings hint)
  7. Enter runtime (dev mode)
```

**Bootstrap artifacts**:

| Artifact | Layer | Content |
|---|---|---|
| `configs/runtime.yaml` | document config (in Git) | engine / model / sandbox / approval / mcp_servers / ui / memory (initial instance of configs.schema) |
| `.env` (.gitignore) | secret config | MODEL_TOKEN, GIT_TOKEN (M1 env injection) |
| Repository pointer (workspace) | bootstrap config | tenant workspace root (local state, not in Git) |

**Workspace resolution (tool ≠ project)**: the BuildingOS repository is the *tool*; the tenant
workspace is the *user's project* — any directory carrying a `.buildingos/` marker. Resolution
order (git-style): `--workspace <dir>` / positional root → `BUILDINGOS_WORKSPACE` env var →
upward search from cwd for the `.buildingos/` marker → error with guidance (`buildingos init`
/ `--workspace`). A persistent default workspace (`~/.buildingos/config.json`) is deferred to M2
if real usage demands it.

## 3. Secret management (M1 env injection)

- **Injection point**: at process start, the runtime reads `.env` → injects into the adapter's engine calls (DSH model API, Codex model provider) and Git operations (pull/push the tenant repository).
- **configs.schema bridge**: the `mcp_servers[].env` field is exactly this channel ("sensitive values never enter Git; injected at deployment"). M1 keeps env; M2 integrates a secret store (Docker secrets / K8s secrets); the env channel stays, only the source changes.
- **Deliverable**: the repository ships `.env.example` (key names, no values) and never ships `.env`.

## 4. Dev / prod dual posture (the same runtime)

| | dev runtime | prod companion (M5.5) |
|---|---|---|
| Deployment | local process / dev container | production-server companion |
| Responsibilities | load tenant repo → normalizer → TenantDocs → adapter → engine run + hot reload + dynamic UI | observe → diagnose → Issue → PR (GitOps loop) + logs / health / upgrade |
| Documents / contracts | the same set (schema family + adapter-contract) | the same set |
| Entry | `buildingos dev` | `buildingos serve --prod` (Ops API surface, §4.4) |

Both postures share: configuration layering, the normalizer, the adapter, and the GitOps model — **one runtime, two postures** (b4).

## 5. Bootstrap → downstream handoff

```
buildingos init (this design)
  → runtime.yaml + .env + repository pointer
  → loadTenantDocs (normalizer-design) → TenantDocs
  → compile (adapter-contract §2–§5) → EngineView
  → adapter run (plugs into the engine, injects secrets)
  → runtime ready (dev mode) → the M5 wizard becomes executable (build systems / deploy)
```

## 6. Relationship with adjacent milestones

| Milestone | Relationship |
|---|---|
| M3 built-in front-ends | the admin web's bootstrap/config UI is the web form of this CLI wizard (not built in M1, b3) |
| M5 new-project wizard | this bootstrap = the minimum configuration *before the runtime is up*; M5 = "building systems" (delivery manifest → deployment files). Handoff: bootstrap completes → runtime ready → the M5 wizard becomes executable |
| M1.5 Turnkey delivery | bootstrap step 2's "recommended server config / upload yml" = auto-generated deployment requirements + user overrides (deploy/ overlay files), part of the Turnkey delivery surface |
| M5.5 production companion | dev runtime and prod companion are two postures of the same runtime (b4) |

## 7. Decision record (M1 review, settled)

| # | Topic | Decision |
|---|---|---|
| b1 | Configuration layering | **Three-layer split (D21)**: bootstrap / document (Git) / secret (env, never in Git); keys never entering the repository is the security baseline |
| b2 | Secret storage | **M1 env injection + M2 secret store** (the env channel stays; only the source changes) |
| b3 | Bootstrap interaction form | **Web console in M1 (product decision, 2026-11)**: `buildingos web` is the interaction surface — workspace picker first, then the wizard / document / pipeline / dev panels in the browser; the CLI keeps the bootstrap commands (`init`, `dev`) and the console entry |
| b4 | dev/prod relationship | **One runtime, two postures** (dev runtime / prod companion), sharing documents and contracts |

## 8. Open items

| # | Topic | Owner |
|---|---|---|
| R1 | Model catalog source: codex `model/list` (mcp-server RPC) vs. DSH model config — the data source for first-boot step 2 | settled during M1 adapter implementation |
| R2 | Git credential detail: `.env` vs. system credentials vs. reusing `gh auth` | settled during M1 implementation |
| R3 | Unattended bootstrap (`--non-interactive` + env presets) | M2 |
| R4 | Handoff order between bootstrap and the M5 wizard (does `init` flow directly into the new-project wizard?) | M5 design |

## 9. Changelog

| Version | Summary |
|---|---|
| v0.1 | Design draft: three-layer configuration split (D21), 7-step CLI bootstrap, secret management (env injection), dev/prod dual posture, downstream handoff, decision record (b1–b4), open items (R1–R4) |
