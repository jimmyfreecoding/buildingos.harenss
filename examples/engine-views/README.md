# examples/engine-views — compile() output examples

This directory holds the **expected compile() outputs** (hand-generated, used to validate the adapter-contract §4 mapping tables) and doubles as the **golden outputs** for conformance golden task G1.

> 中文版：[README_cn.md](README_cn.md)

## Structure

```
engine-views/
├── dsh/                            # DSH engine view (copy into a tenant workspace to take effect)
│   ├── .dsh/skills/network-diagnose/
│   │   ├── SKILL.md                # frontmatter: name/description/whenToUse/metadata(+x-buildingos)
│   │   ├── references/thresholds.md
│   │   └── scripts/telemetry-snapshot.py   # preserved as-is (N1)
│   └── generated/system-prompt-sections.md # rules + prompts intermediate representation (wired into cordis.yml at implementation)
└── codex/                          # Codex engine view
    └── .codex/
        ├── skills/network-diagnose/
        │   ├── SKILL.md            # frontmatter: name/description/metadata.short-description
        │   ├── openai.yaml         # interface/policy/dependencies (compiled from ui:/invocation/dependencies)
        │   ├── references/thresholds.md
        │   └── scripts/telemetry-snapshot.py   # implicit-invocation surface (N1)
        ├── AGENTS.md               # rules + prompts merged sections
        └── config.toml             # configs compile (generated when the engine is codex)
```

## Source documents (unified format → engine views)

| Engine-view file | Source (tenant repository) |
|---|---|
| `dsh/.dsh/skills/network-diagnose/*` | `skills/network-diagnose/SKILL.md` |
| `dsh/generated/system-prompt-sections.md` | `rules/*.md` + `prompts/ops-engineer.md` |
| `codex/.codex/skills/network-diagnose/*` | `skills/network-diagnose/SKILL.md` |
| `codex/.codex/AGENTS.md` | `rules/*.md` + `prompts/ops-engineer.md` |
| `codex/.codex/config.toml` | `configs/runtime.yaml` (when engine: codex) |

## Verification conclusion

Field-by-field checks and three calibration points (C1–C3, C2 resolved by D20) are in [docs/compile-verification.md](../../docs/compile-verification.md).

> A live side-proof: this repository environment itself follows the AGENTS.md convention — after `codex/.codex/AGENTS.md` was generated, the environment recognized it as an instruction source. Engine views are a live format, not paper specs.
