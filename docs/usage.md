# BuildingOS Usage Guide

> How to use this project today, and the target workflow (designed, pending implementation).
> 中文版：[usage_cn.md](usage_cn.md)

## 1. Quick start (works today)

```bash
git clone <your-buildingos-repo> && cd buildingos.harenss
pnpm install          # workspace: normalizer / adapters / bootstrap / conformance / cli
pnpm build            # required once — the bin points at dist/cli.bundle.cjs

# Install the tool globally (once), then use it anywhere:
pnpm setup                            # one-time: add pnpm's global bin to PATH
cd cli && pnpm pack                   # one-time: package the self-contained bundle
pnpm install -g ./buildingos-cli-0.1.0.tgz   # one-time: `buildingos` becomes available everywhere
```

Then create a project wherever you are (the tool stays separate from your projects):

```bash
cd /where/you/want/projects
buildingos init my-tenant              # or: mkdir p && cd p && buildingos init (git-init style)
cd my-tenant
```

(If you prefer not to link globally: `pnpm buildingos <cmd>` from the tool repo also works.)

```bash
# The web console is the interaction surface (DSH-GUI style):
# workspace picker → document tree/editor → wizard → pipeline panels → dev env.
buildingos web
# → http://127.0.0.1:4399

# Scaffold a tenant repository — interactive first-boot wizard (or in the console's 向导 panel):
#   0. language (中文 / English)   ← the very first question
#   1. engine (dsh / codex)        → runtime.yaml engine
#   2. model (starter catalog)     → runtime.yaml model
#   3. model token                 → .env (never Git, D21)
#   4. git token (may skip)        → .env
#   5. scaffold .buildingos/ + knowledge/ + .gitignore + docker-compose.yml + .env
#   6. validate (normalizer)
#   7. summary + next steps
buildingos init my-tenant

# Start the dev environment (docker compose up in the tenant; M1.5 ②)
buildingos dev my-tenant
# → buildingos-runtime container (the `buildingos` CLI inside, /workspace bound)
# → postgres on :5432 (state store; PG_PASSWORD lives in .env, never Git, D21)
# work inside the container: docker compose exec buildingos-runtime buildingos validate
```

The validate / compile / conformance pipeline runs in the web console's 校验/编译/一致性 panel
(they were CLI commands in M1; the console API exposes them now).

### What a tenant looks like after `init`

```
my-tenant/
├── .buildingos/          # the AI application's brain (documents as code)
│   ├── rules/            # boundaries (constitution) — hard rules derive permissions (D6)
│   ├── skills/           # capabilities (how-to know-how)
│   ├── prompts/          # persona (tone, language)
│   └── configs/          # runtime.yaml — engine/model/mcp_servers/sandbox/approval
├── knowledge/            # world model — harness-generated, human-reviewed (D19)
├── docker-compose.yml    # dev environment (M1.5 ②): buildingos-runtime + postgres
├── .env                  # secrets: MODEL_TOKEN / GIT_TOKEN / PG_PASSWORD (never Git, D21)
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
buildingos web --workspace my-tenant      # open the console at a specific workspace
BUILDINGOS_WORKSPACE=my-tenant buildingos dev
cd my-tenant && buildingos dev            # upward search finds the marker
```

## 2. CLI reference

| Command | What it does |
|---|---|
| `buildingos web [--port N]` | **The interaction surface** (DSH-GUI-style console): workspace picker → document tree/editor → wizard → validate/compile/conformance panels → dev environment control |
| `buildingos init <dir>` | Scaffold a tenant repository (starter rules/skills/prompts/configs/knowledge + .gitignore + docker-compose.yml + .env) |
| `buildingos dev [root]` | Start the tenant's dev environment — `docker compose up` in the tenant workspace (buildingos-runtime CLI container + postgres; M1.5 ②) |

The pipeline operations (validate / compile / conformance) are console-API driven — run them in
the web console's 校验/编译/一致性 panel (they were CLI commands in M1; removed with the web-first
switch).

## 3. The development loop (today)

```
buildingos web           # open the console → pick the workspace
edit .buildingos/*.md    # in the console's document panel (or your editor)
→ 校验 panel             # CI-grade lint, fail on errors
→ 编译 panel             # see what the engine will consume (dsh / codex)
→ git commit + PR        # governance: review, merge, version, rollback
```

Everything the AI application is — behavior, capabilities, persona, permissions — is Markdown/YAML in the tenant repository. There is no application code.

## 4. The target workflow (designed; implementation pending)

The full first-boot experience is specified in [runtime-bootstrap.md](runtime-bootstrap.md) and the roadmap:

```
buildingos init            # M1.5 CLI wizard (implemented):
                           #   0. language (中文 / English)
                           #   1. select engine (dsh / codex)
                           #   2. select model
                           #   3. model credentials → .env (never Git, D21)
                           #   4. git credentials → .env
                           #   5. scaffold the tenant repo + docker-compose.yml + .env
                           #   6. validate (normalizer)
                           #   7. summary + next steps

buildingos dev             # M1.5 ② (implemented): docker compose up in the tenant —
                           #   buildingos-runtime CLI container + postgres state store.
                           #   Hot reload + engine run() bridges land with M1.5 ③ / M2.

buildingos serve --prod    # production companion (M5.5): same runtime, ops posture —
                           #   observe → diagnose → Issue → PR → CI build → pull → up
```

| Stage | Milestone | Status |
|---|---|---|
| `normalizer` / adapters / conformance / minimal CLI | M1 | ✅ implemented, 63 tests |
| First-boot wizard (`init` steps 0–5: language/engine/model/credentials/git/scaffold) | M1.5 | ✅ implemented — [runtime-bootstrap.md](runtime-bootstrap.md) §2 |
| Dev environment (`buildingos dev` = docker compose up: buildingos-runtime + postgres) | M1.5 ② | ✅ implemented — [dev-environment.md](dev-environment.md) |
| Runtime CLI entry (step 7: `buildingos serve --prod`) | M5.5 | 📋 pending |
| Git integration (webhook hot reload, PR CI checks) | M2 | 📋 planned |
| Dynamic UI (admin web / dashboards from UI-skill documents) | M3 | 📋 planned |
| New-project wizard (delivery manifest → deploy files → auto-deploy) | M5 | 📋 planned |
| Production companion (auto deployment/firewall requirements, GitOps fix loop) | M5.5 | 📋 planned |

Until the runtime lands, everything above the dotted line — document model, schemas, compile mapping, conformance — is exercised by the four CLI commands.

## 5. Testing the current state

One command verifies everything (63 unit/acceptance tests + the full E2E loop):

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
| `@buildingos/bootstrap` | 12 | `initTenant` (scaffold + tool-repo guard + .gitignore + .env/.env.example D21), wizard (language first, engine/model/credentials/git, ZH/EN l10n), dev env artifacts (`renderDevCompose`/`renderDevEnv`/`randomPgPassword`/`findToolDir` — M1.5 ②) |
| `@buildingos/conformance` | 3 | G1 compile-parity against golden engine-views (both engines), tenant-error surfacing, G2–G4 engine-gated skeletons |
| `@buildingos/web` | 3 | workspace discovery (`.buildingos/` marker, scan, recents persistence) — the console's picker foundation |
| `@buildingos/cli` | 15 | first-boot wizard (language first, engine/model/credentials/git, `.env` D21, `.env.example`), workspace resolution (flag/env/upward-search/error), `web` (console entry), `dev` (compose detection + docker spawn, M1.5 ②) |

**How to add a test**: put a `*.test.ts` in the package's `tests/` (fixtures: `examples/` for acceptance, crafted temp dirs for negative cases), then `pnpm --filter <pkg> test`. The golden engine-views are the byte/semantic baseline for compile (conformance G1).

## 6. Honest status

- **Works today**: `init` / `validate` / `compile` / `conformance` — the full document→engine-view pipeline with machine-verified golden outputs.
- **Pending**: the `run()` event bridges (DSH: ACP vs. in-process cordis; Codex: `codex mcp-server` validation — adapter-contract §9), the dev runtime (`buildingos dev` + docker compose), Docker/K8s packaging (M1.5), Git webhooks (M2), dynamic UI (M3), project wizard (M5), production companion (M5.5).
- **Secrets**: model/Git tokens go into `.env` (gitignored) — never into the repository (D21).
