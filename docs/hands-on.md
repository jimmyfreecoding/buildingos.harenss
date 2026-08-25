# BuildingOS Hands-on — Try It Yourself

> A walkthrough of the full loop on your own machine: install → init a tenant →
> validate/compile/conformance → bring up the Docker dev environment → develop inside it.
> 中文版：[hands-on_cn.md](hands-on_cn.md)

## 0. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | ≥ 18 (`v22+` recommended) | `node --version` |
| pnpm | ≥ 9 (v11 used in CI) | `pnpm --version` |
| Git | any recent | `git --version` |
| Docker Desktop | running (engine up) | `docker info --format '{{.ServerVersion}}'` |

If port **5432** is already used on your machine (common — another Postgres may be running),
the dev environment will tell you; set `PG_PORT` to a free port (see §5).

## 1. Get the tool

```bash
git clone <your-buildingos-repo> && cd buildingos.harenss
pnpm install
pnpm build          # one-time — the bin points at dist/cli.bundle.cjs
pnpm test           # 60 tests — everything green
```

You now have two ways to run the CLI:

```bash
node cli/dist/cli.bundle.cjs <cmd>   # direct (any directory)
pnpm exec buildingos <cmd>           # via the workspace bin (in the tool repo)
```

For a permanent install: `pnpm setup` once, then `cd cli && pnpm pack && pnpm install -g ./buildingos-cli-0.1.0.tgz`.
After that plain `buildingos <cmd>` works anywhere.

> Note: when the CLI is run **from the tool repo**, `init` auto-detects the repo path and bakes it
> into the tenant's docker-compose.yml, so `docker compose up` works with zero configuration.
> With a global install the compose expects `BUILDINGOS_TOOL_DIR` (see §5).

## 2. Init a tenant workspace (the tool is not the project)

Pick a directory **outside** the tool repo — the tenant is your project:

```bash
mkdir ~/my-tenant && cd ~/my-tenant
buildingos init            # git-init style: scaffold into the current directory
```

The interactive wizard asks, in order:

| Step | Question | Writes to |
|---|---|---|
| 0 | Language (中文 / English) | — |
| 1 | Engine (dsh / codex) | `.buildingos/configs/runtime.yaml` → `engine:` |
| 2 | Model (starter catalog or custom) | same file → `model:` |
| 3 | Model API token | `.env` → `MODEL_TOKEN` (never Git, D21) |
| 4 | Git token (empty = skip) | `.env` → `GIT_TOKEN` |
| 5 | Scaffold the tenant repository | `.buildingos/`, `knowledge/`, `.gitignore`, `docker-compose.yml`, `.env` |
| 6 | Validate (normalizer) | diagnostics |
| 7 | Summary + next steps | — |

The resulting tenant:

```
my-tenant/
├── .buildingos/          # the AI application's brain (documents as code)
│   ├── rules/            # boundaries — hard rules derive permissions (D6)
│   ├── skills/           # capabilities (how-to know-how)
│   ├── prompts/          # persona (tone, language)
│   └── configs/          # runtime.yaml — engine/model/sandbox/approval
├── knowledge/            # world model — human-reviewed facts (D19)
├── docker-compose.yml    # dev environment: buildingos-runtime + postgres (M1.5 ②)
├── .env                  # secrets: MODEL_TOKEN / GIT_TOKEN / PG_PASSWORD (never Git, D21)
└── .gitignore
```

## 3. Exercise the document pipeline

```bash
buildingos validate .             # load + lint (schema checks, ORDER_DUPLICATE D20, ...)
buildingos compile --engine dsh . # render what the DSH engine actually consumes
buildingos compile --engine codex .
buildingos conformance .          # compile parity vs the golden baseline (G1)
```

Edit a skill and re-validate to feel the loop:

```bash
# e.g. append a step to the hello skill, then:
buildingos validate .
buildingos compile --engine dsh .
```

## 4. Bring up the dev environment

```bash
buildingos dev            # = docker compose up in the tenant (first run builds the image: a few minutes)
```

If port 5432 is taken:

```bash
PG_PORT=55432 buildingos dev      # PowerShell: $env:PG_PORT='55432'; buildingos dev
```

What you get:

```
buildingos-runtime   node container with the `buildingos` CLI globally installed,
                     /workspace = your tenant (live bind mount)
postgres             :5432 (or PG_PORT) — state store; password in .env, never Git
```

## 5. Develop inside the container

```bash
docker compose exec buildingos-runtime buildingos validate
docker compose exec buildingos-runtime buildingos compile --engine dsh
docker compose exec buildingos-runtime buildingos conformance
# or drop into a shell:
docker compose exec buildingos-runtime sh
```

The mount is **bidirectional**: files the container writes (e.g. `engine-views/`) appear on
your host immediately, and your host edits to `.buildingos/` are visible in the container.

## 6. Stop / clean up

```bash
buildingos dev --down        # or: docker compose down
docker compose down -v       # also drop the postgres data volume
```

## 7. Honest scope

- **Works today**: init wizard (language first) → validate/compile/conformance → `buildingos dev`
  (docker compose up: CLI container + postgres). All verified with real Docker.
- **Pending**: engine `run()` bridges (talk to the AI — DSH ACP / Codex mcp-server, M1.5 ③),
  hot reload of know-how (M2), dynamic UI (M3), production companion (M5.5).
- **Global install caveat**: if `buildingos` was installed globally (not run from the tool repo),
  `buildingos dev` cannot auto-locate the tool repo. Either run init from the tool repo once, or
  set `BUILDINGOS_TOOL_DIR` to the tool repo path before `buildingos dev`.
