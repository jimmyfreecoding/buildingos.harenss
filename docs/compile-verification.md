# compile() Mapping Verification Report (live validation of M1 design draft v0.4)

> Method: per the adapter-contract §4 mapping tables, the unified-format examples (examples/) were hand-compiled into both engine views (examples/engine-views/), and every field was checked against each engine's parser rules.
> Sources of truth: DSH `packages/skill/skill-filesystem/src/index.ts` (frontmatter key spellings); Codex `skills/src/parser.rs` + `ext/skills/src/loader/metadata.rs` + `docs/config.md` (commit `d21794d6`).
> Bottom line first: **the skill mapping is usable; three calibration points were found and registered in adapter-contract §9**.
>
> 中文版：[compile-verification_cn.md](compile-verification_cn.md)

## 1. DSH view checklist

Artifact: `examples/engine-views/dsh/.dsh/skills/network-diagnose/SKILL.md`

| Check | Result | Basis (DSH source) |
|---|---|---|
| `name` kebab-case ≤64 | ✅ `network-diagnose` | Name pattern + length constraint |
| `description` non-empty single line | ✅ | Required field |
| `whenToUse` spelling (camelCase) | ✅ Correct | `optionalString(parsed.data, 'whenToUse')` |
| `metadata` open object | ✅ (includes x-buildingos carry) | metadata is an open object |
| `invocation.model=true` → omit `disable-model-invocation` | ✅ (default is true) | `frontmatterBoolean(data, 'disable-model-invocation')`, default true |
| `invocation.user=true` → omit `user-invocable` | ✅ (default is true) | Same |
| `implicit=false` → `metadata.x-buildingos.invocation-implicit: false` | ✅ (DSH runtime-ignored; round-trip preserved) | D19 lossless rule |
| `references/` kept in the bundle (resourceBase on-demand) | ✅ | Bundle directory shape |

## 2. Codex view checklist

Artifacts: `examples/engine-views/codex/.codex/skills/network-diagnose/{SKILL.md, openai.yaml}`

| Check | Result | Basis (Codex source) |
|---|---|---|
| SKILL.md frontmatter contains only name/description/metadata.short-description | ✅ | `parser.rs` consumes exactly these three keys |
| `openai.yaml` interface derived from the `ui:` block | ✅ Content mapped correctly | `metadata.rs` `SkillInterfaceFile` |
| `openai.yaml` policy.allow_implicit_invocation from invocation.implicit | ✅ | `Policy` struct |
| `openai.yaml` dependencies derived from runtime.yaml (transport/command) | ✅ | Q3 layering (D3) |
| `references/` preserved as-is | ✅ | SKILL.md body reference mechanism |
| `AGENTS.md` sections (rules + prompts) | ⚠️ See calibration point 2 | `agents_md.rs` hierarchical collection |
| `config.toml` (model/sandbox_mode/approval_policy/mcp_servers) | ✅ Structure correct | `docs/config.md` |

## 3. Calibration points (registered in adapter-contract §9)

| # | Calibration point | Impact | Handling |
|---|---|---|---|
| C1 | Codex `openai.yaml` `interface` key casing: generated in snake_case, but the serde rename in metadata.rs is not explicitly visible and test fixtures do not cover interface | If Codex expects camelCase, interface silently fails | Validate against real `codex mcp-server` / skills loading at the adopted version, then freeze |
| C2 | **Cross-family merge ordering undefined**: rules (order 10/20) vs. prompts (order 20) in AGENTS.md / system-prompt — persona and read-only both at 20, conflict semantics undefined | Unstable concatenation order for equal order across families | ✅ Resolved (D20): order is one global numbering space, duplicates rejected by lint; example persona moved to order 30 (10/20/30) — decision D20 (Contract Philosophy §6) |
| C3 | DSH-side system-prompt / mcp-client cordis.yml config key shapes (currently an intermediate representation) | Needed only at wiring time | Calibrate against real cordis config when implementing the DSH adapter |

## 4. Side benefits

1. `engine-views/` becomes the **golden outputs** for conformance G1 — automation can assert "compiled output == expected values here";
2. The compiled `codex/.codex/AGENTS.md` is **automatically recognized as an instruction source** by this repository environment (which follows the AGENTS.md convention) — engine views are a live format, not paper specs;
3. The DSH-side `metadata.x-buildingos` carry namespace was validated as legal (open object) — the D1–D21 lossless rules are implementable.

## 5. Next steps

- C1–C3 registered in adapter-contract §9 with status (C2 resolved via D20);
- Conformance G1 automation uses engine-views as the expected outputs;
- Validate the system-prompt wiring (C3) when implementing the DSH adapter.
