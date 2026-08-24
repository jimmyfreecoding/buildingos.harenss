# BuildingOS Usage Guide

> How to use this project today, and the target workflow (designed, pending implementation).
> 中文版：[usage_cn.md](usage_cn.md)

## 1. Quick start (works today)

```bash
git clone <your-buildingos-repo> && cd buildingos.harenss
pnpm install          # workspace: normalizer / adapters / bootstrap / conformance / web / cli
pnpm build            # required once — the bin points at dist/cli.js
pnpm test             # 55 tests — everything green
```

Invoke the CLI (three ways):

```bash
pnpm buildingos <cmd>        # root helper script — no PATH configuration needed (recommended)
pnpm exec buildingos <cmd>   # workspace bin
# or, for a bare `buildingos` anywhere: pnpm link --global @buildingos/cli
```

Example (same as below, with the helper): `pnpm buildingos init my-tenant`

```bash
# Scaffold a tenant repository — interactive first-boot wizard:
#   0. language (中文 / English)   ← the very first question
#   1. engine (dsh / codex)        → runtime.yaml engine
#   2. model (starter catalog)     → runtime.yaml model
#   3. model token                 → .env (never Git, D21)
#   4. git token (may skip)        → .env
#   5. scaffold .buildingos/ + knowledge/ + .gitignore
#   6. validate (normalizer)
#   7. enter runtime (dev mode) — the runtime CLI ships with M1.5
buildingos init my-tenant

# Validate & lint it (normalizer pipeline stages 1–2)
buildingos validate my-tenant

# Render the engine view (what DSH or Codex actually consumes)
buildingos compile --engine dsh my-tenant
buildingos compile --engine codex my-tenant

# Conformance: compile output vs. the golden engine-views baseline
buildingos conformance my-tenant

# Or open the web console — the interaction surface (product decision):
# wizard / validate / compile / conformance panels in the browser
buildingos web
# → http://127.0.0.1:4173
```

### What a tenant looks like after `init`

```
my-tenant/
├── .buildingos/          # the AI application's brain (documents as code)
│   ├── rules/            # boundaries (constitution) — hard rules derive permissions (D6)
│   ├── skills/           # capabilities (how-to know-how)
│   ├── prompts/          # persona (tone, language)
│   └── configs/          # runtime.yaml — engine/model/mcp_servers/sandbox/approval
├── knowledge/            # world model — harness-generated, human-reviewed (D19)
└── .gitignore            # D21: secrets never enter the repository
```

## Workspace — the tool is not the project

The BuildingOS repository is the **tool** (normalizer / adapters / conformance / cli). The tenant
workspace is the **user's project** — any directory carrying a `.buildingos/` marker. The CLI
operates on a workspace, never on the tool repo itself (unless you dogfood it as a tenant).

Workspace resolution order:

1. `--workspace <dir>` (or a positional root) — explicit
2. `BUILDINGOS_WORKSPACE` environment variable
3. upward search from the current directory for a `.buildingos/` marker (like `git` finding `.git`)
4. error with guidance (`buildingos init <dir>` / `--workspace`)

```bash
buildingos validate --workspace my-tenant
BUILDINGOS_WORKSPACE=my-tenant buildingos compile --engine dsh
cd my-tenant && buildingos validate          # upward search finds the marker
```

## 2. CLI reference

| Command | What it does |
|---|---|
| `buildingos init <dir>` | Scaffold a tenant repository (starter rules/skills/prompts/configs/knowledge + .gitignore) |
| `buildingos web [--port N]` | **The interaction surface** (product decision): open the console SPA — wizard / validate / compile / conformance panels |
| `buildingos validate [root]` | Load + lint a tenant: schema checks, `ORDER_DUPLICATE` (D20), `DEP_UNRESOLVED` (D3), permissions no-hand-write (D14); exit non-zero on errors |
| `buildingos compile --engine dsh\|codex [root] [--out <dir>]` | Render the engine view from TenantDocs; writes files into `engine-views/<engine>` by default |
| `buildingos conformance [root]` | G1 compile-parity against the golden baseline (needs `engine-views/` first); G2–G4 engine-gated, skipped |

## 3. The development loop (today)

```
edit .buildingos/*.md     # change know-how — rules/skills/prompts
→ buildingos validate .   # CI-grade lint, fail on errors
→ buildingos compile --engine dsh .   # see what the engine will consume
→ git commit + PR         # governance: review, merge, version, rollback
```

Everything the AI application is — behavior, capabilities, persona, permissions — is Markdown/YAML in the tenant repository. There is no application code.

## 4. The target workflow (designed; implementation pending)

The full first-boot experience is specified in [runtime-bootstrap.md](runtime-bootstrap.md) and the roadmap:

```
buildingos init            # M1.5 CLI wizard (designed):
                           #   1. select engine (dsh / codex)
                           #   2. select model
                           #   3. model credentials → .env (never Git, D21)
                           #   4. git credentials → .env
                           #   5. point at / scaffold the tenant repo
                           #   6. validate (normalizer)
                           #   7. enter runtime (dev mode)

buildingos dev             # dev runtime (M1.5/M2): local process + hot reload +
                           #   dynamic UI; docker compose brings up PG/state store

buildingos serve --prod    # production companion (M5.5): same runtime, ops posture —
                           #   observe → diagnose → Issue → PR → CI build → pull → up
```

| Stage | Milestone | Status |
|---|---|---|
| `normalizer` / adapters / conformance / minimal CLI | M1 | ✅ implemented, 35 tests |
| First-boot wizard (`init` steps 0–5: language/engine/model/credentials/git/scaffold) | M1.5 | ✅ implemented — [runtime-bootstrap.md](runtime-bootstrap.md) §2 |
| Runtime CLI entry (step 7: `buildingos dev` / `serve --prod`) | M1.5/M5.5 | 📋 pending |
| Local Docker dev environment (Turnkey compose: runtime + PG + bundled services) | M1.5 | 📋 designed — README roadmap |
| Git integration (webhook hot reload, PR CI checks) | M2 | 📋 planned |
| Dynamic UI (admin web / dashboards from UI-skill documents) | M3 | 📋 planned |
| New-project wizard (delivery manifest → deploy files → auto-deploy) | M5 | 📋 planned |
| Production companion (auto deployment/firewall requirements, GitOps fix loop) | M5.5 | 📋 planned |

Until the runtime lands, everything above the dotted line — document model, schemas, compile mapping, conformance — is exercised by the four CLI commands.

## 5. Testing the current state

One command verifies everything (48 unit/acceptance tests + the full CLI E2E loop):

```bash
pnpm verify        # typecheck → build → test → e2e demo
# or piecemeal:
pnpm check                          # typecheck + build + test (all packages)
pnpm --filter @buildingos/cli demo  # init(wizard) → validate → compile dsh/codex → conformance
```

| Package | Tests | What they cover |
|---|---|---|
| `@buildingos/normalizer` | 15 | frontmatter extraction (warn-and-skip), five-family loaders, normalization (kebab→camel, defaults, persona merge D10, permission derivation D6), set-level lint (`ORDER_DUPLICATE` D20, `DEP_UNRESOLVED` D3, `PERMISSIONS_HAND_WRITTEN` D14, path checks D5/D19), contract gate, crafted negative tenant |
| `@buildingos/adapter-dsh` | 6 | compile() renders the DSH view; golden-output parity (frontmatter semantics + body), `metadata.x-buildingos` lossless carry (D2/D4), system-prompt sections by order (D20), run() pending bridge |
| `@buildingos/adapter-codex` | 6 | compile() renders the Codex view; golden-output parity (SKILL.md parser-consumed fields, openai.yaml semantic match, AGENTS.md order, config.toml D13) |
| `@buildingos/conformance` | 3 | G1 compile-parity against golden engine-views (both engines), tenant-error surfacing, G2–G4 engine-gated skeletons |
| `@buildingos/cli` | 18 | first-boot wizard (language first, engine/model/credentials/git, `.env` D21, `.env.example`), workspace resolution (flag/env/upward-search/error), validate/compile/conformance commands |

**How to add a test**: put a `*.test.ts` in the package's `tests/` (fixtures: `examples/` for acceptance, crafted temp dirs for negative cases), then `pnpm --filter <pkg> test`. The golden engine-views are the byte/semantic baseline for compile (conformance G1).

## 6. Honest status

- **Works today**: `init` / `validate` / `compile` / `conformance` — the full document→engine-view pipeline with machine-verified golden outputs.
- **Pending**: the `run()` event bridges (DSH: ACP vs. in-process cordis; Codex: `codex mcp-server` validation — adapter-contract §9), the runtime CLI wizard, Docker/K8s packaging (M1.5), Git webhooks (M2), dynamic UI (M3), project wizard (M5), production companion (M5.5).
- **Secrets**: model/Git tokens go into `.env` (gitignored) — never into the repository (D21).
