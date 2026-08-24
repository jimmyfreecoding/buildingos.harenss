# BuildingOS Usage Guide

> How to use this project today, and the target workflow (designed, pending implementation).
> 中文版：[usage_cn.md](usage_cn.md)

## 1. Quick start (works today)

```bash
git clone <your-buildingos-repo> && cd buildingos.harenss
pnpm install          # workspace: normalizer / adapters / conformance / cli
pnpm test             # 35 tests — everything green
```

The CLI (`@buildingos/cli`) is the entry point:

```bash
# Scaffold a tenant repository (the AI application's "source code")
buildingos init my-tenant

# Validate & lint it (normalizer pipeline stages 1–2)
buildingos validate my-tenant

# Render the engine view (what DSH or Codex actually consumes)
buildingos compile --engine dsh my-tenant
buildingos compile --engine codex my-tenant

# Conformance: compile output vs. the golden engine-views baseline
buildingos conformance my-tenant
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

## 2. CLI reference

| Command | What it does |
|---|---|
| `buildingos init <dir>` | Scaffold a tenant repository (starter rules/skills/prompts/configs/knowledge + .gitignore) |
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
| Runtime CLI wizard (`init` steps 1–4: engine/model/credentials/git) | M1.5 | 📋 designed — [runtime-bootstrap.md](runtime-bootstrap.md) |
| Local Docker dev environment (Turnkey compose: runtime + PG + bundled services) | M1.5 | 📋 designed — README roadmap |
| Git integration (webhook hot reload, PR CI checks) | M2 | 📋 planned |
| Dynamic UI (admin web / dashboards from UI-skill documents) | M3 | 📋 planned |
| New-project wizard (delivery manifest → deploy files → auto-deploy) | M5 | 📋 planned |
| Production companion (auto deployment/firewall requirements, GitOps fix loop) | M5.5 | 📋 planned |

Until the runtime lands, everything above the dotted line — document model, schemas, compile mapping, conformance — is exercised by the four CLI commands.

## 5. Honest status

- **Works today**: `init` / `validate` / `compile` / `conformance` — the full document→engine-view pipeline with machine-verified golden outputs.
- **Pending**: the `run()` event bridges (DSH: ACP vs. in-process cordis; Codex: `codex mcp-server` validation — adapter-contract §9), the runtime CLI wizard, Docker/K8s packaging (M1.5), Git webhooks (M2), dynamic UI (M3), project wizard (M5), production companion (M5.5).
- **Secrets**: model/Git tokens go into `.env` (gitignored) — never into the repository (D21).
