# BuildingOS Manual Test Guide (current state: M1 + M1.5 wizard/workspace)

> Purpose: manually walk through everything that works today — the first-boot wizard,
> workspace resolution, normalizer validation, dual-engine compile, conformance.
> 中文版：[manual-test_cn.md](manual-test_cn.md)
> Automated baseline: `pnpm verify` (48 tests + e2e demo). This guide is the human version.

## 0. Prepare

```bash
node -v && pnpm -v          # node >= 18, pnpm >= 9 (verified on node 24 / pnpm 11.7)
git clone <repo> && cd buildingos.harenss
pnpm install && pnpm build
```

## 1. Automated baseline (recommended first)

```bash
pnpm verify
# expect: typecheck/build OK, 48 tests passed, e2e: OK
```

## 2. First-boot wizard (real terminal, interactive)

```bash
node cli/dist/cli.js init my-tenant
# or, after linking the bin: buildingos init my-tenant
```

Step through the prompts — **the first question must be the language**:

| Step | Action | Expected |
|---|---|---|
| 0 | choose `1` (中文) or `2` (English) | subsequent prompts in that language |
| 1 | choose engine (dsh / codex) | adapter status printed (`OK ...`) |
| 2 | choose model or `其他/Other` + type a handle | — |
| 3 | type model token (plain echo — known limitation) | — |
| 4 | type git token, or Enter to skip | "Git credentials: skipped" when empty |
| 5 | scaffold output | `.buildingos/...` + `knowledge/` + `.gitignore` listed |
| 6 | validation | `校验通过（OK）` / `Validation passed (OK)` |
| 7 | summary | next commands listed |

**Verify the artifacts**:

```bash
find my-tenant -type f | sort
# .buildingos/configs/runtime.yaml   engine/model match your choices
# .buildingos/rules, skills, prompts, configs
# knowledge/README.md, .gitignore, .env, .env.example

cat my-tenant/.env                    # MODEL_TOKEN=... GIT_TOKEN=... (or the skip comment)
cat my-tenant/.env.example            # key names only, no values
grep -A2 "^engine" my-tenant/.buildingos/configs/runtime.yaml
```

**D21 check — secrets never enter Git**:

```bash
cd my-tenant && git init && git add -A && git status
# .env must NOT appear; .env.example MUST appear (the .gitignore exception)
```

## 3. validate (normalizer lint)

```bash
buildingos validate my-tenant     # or: cd my-tenant && buildingos validate (upward search)
# expect: validate: OK (0 warnings/info)
```

**Negative injections — break it, watch it fail, fix it**:

```bash
# a) unresolvable tool dependency (D3)
#    edit .buildingos/skills/hello/SKILL.md → dependencies: tools: [{ type: mcp, value: nope }]
buildingos validate my-tenant     # expect: [ERROR] DEP_UNRESOLVED ... "nope"

# b) cross-family order duplicate (D20)
#    edit .buildingos/prompts/assistant.md → order: 10  (same as the rule)
buildingos validate my-tenant     # expect: [ERROR] ORDER_DUPLICATE ... order 10 is already used by rule:...

# c) hand-written permissions (D14)
#    edit .buildingos/configs/runtime.yaml → add a `permissions:` section
buildingos validate my-tenant     # expect: [ERROR] PERMISSIONS_HAND_WRITTEN ...

# revert all three → validate: OK again
```

## 4. compile — dual engine views

```bash
buildingos compile --engine dsh my-tenant      # → my-tenant/engine-views/dsh
buildingos compile --engine codex my-tenant    # → my-tenant/engine-views/codex
```

**Inspect the DSH view** (`engine-views/dsh/`):

```bash
cat engine-views/dsh/.dsh/skills/hello/SKILL.md
# frontmatter: name, description (+ whenToUse/metadata when present)
cat engine-views/dsh/generated/system-prompt-sections.md
# ## rules:read-only-by-default (order 10, hard) ... ## persona:assistant (order 20, from prompts)
```

**Inspect the Codex view** (`engine-views/codex/`):

```bash
cat engine-views/codex/.codex/skills/hello/SKILL.md   # only name/description/metadata.short-description
cat engine-views/codex/.codex/skills/hello/openai.yaml # interface / policy / dependencies
cat engine-views/codex/.codex/AGENTS.md                 # rules by order + persona
cat engine-views/codex/.codex/config.toml               # model / sandbox_mode / approval_policy / mcp_servers
```

**Lossless-carry spot check (D2/D4)** — give the skill a `ui:` block and `invocation.implicit: false`,
recompile, then:

```bash
# DSH view: metadata.x-buildingos.{ui,invocation-implicit} present (runtime-ignored, round-trip safe)
grep -A8 "x-buildingos" engine-views/dsh/.dsh/skills/hello/SKILL.md
# Codex view: openai.yaml policy.allow_implicit_invocation: false + interface fields
grep -A8 "^policy\|^interface" engine-views/codex/.codex/skills/hello/openai.yaml
```

## 5. conformance (G1)

```bash
buildingos conformance my-tenant
# expect:
#   [PASS] G1-compile-parity (dsh)
#   [PASS] G1-compile-parity (codex)
#   [SKIP] G2/G3/G4 (engine-gated; require the run() bridge)
```

## 6. Workspace resolution (tool ≠ project)

```bash
cd my-tenant && buildingos validate          # upward .buildingos/ search hits → OK
BUILDINGOS_WORKSPACE=my-tenant buildingos validate   # env var → OK
buildingos validate --workspace my-tenant    # explicit flag → OK

cd <the-buildingos-tool-repo> && buildingos validate
# expect the error: "no workspace found: no .buildingos/ marker ... Run `buildingos init <dir>` ..."
```

## 7. Regression loop

Edit know-how (`rules` / `skills` / `prompts`) → `validate` → `compile` (both engines) →
`conformance` → `pnpm verify`. Every behavior change is a Git PR: review, merge, rollback.

## Known limitations (watch out while testing)

1. **Tokens echo in plain text** in the wizard — terminal masking arrives with the runtime console (M3).
2. **Piping answers via stdin** (e.g. `echo 1 | buildingos init x`) loses output on non-TTY — a readline edge
   case; use a real terminal interactively.
3. **No engine runtime yet**: `run()` bridges are pending (DSH ACP/in-process; Codex `codex mcp-server`) —
   G2–G4 stay SKIP, and there is no live agent conversation.
4. **No runtime CLI yet**: `buildingos dev` / `buildingos serve --prod` don't exist; the four commands
   (init/validate/compile/conformance) are the current surface.
