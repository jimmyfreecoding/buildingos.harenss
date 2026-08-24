# examples/engine-views —— compile() 输出示例

本目录是 **compile() 的期望产物**（手写生成，用于验证 adapter-contract §4 映射表），同时也是 conformance 黄金任务集 G1 的 **golden outputs**。

## 结构

```
engine-views/
├── dsh/                            # DSH 引擎视图（复制到租户工作区即生效）
│   ├── .dsh/skills/network-diagnose/
│   │   ├── SKILL.md                # frontmatter: name/description/whenToUse/metadata(+x-buildingos)
│   │   └── references/thresholds.md
│   └── generated/system-prompt-sections.md   # rules + prompts 的中间表示（实施接线到 cordis.yml）
└── codex/                          # Codex 引擎视图
    └── .codex/
        ├── skills/network-diagnose/
        │   ├── SKILL.md            # frontmatter: name/description/metadata.short-description
        │   ├── openai.yaml         # interface/policy/dependencies（由 ui:/invocation/dependencies 编译）
        │   └── references/thresholds.md
        ├── AGENTS.md               # rules + prompts 合并段落
        └── config.toml             # configs 编译（engine 切换为 codex 时生成）
```

## 来源文档（统一格式 → 引擎视图）

| 引擎视图文件 | 来源（租户仓库） |
|---|---|
| `dsh/.dsh/skills/network-diagnose/*` | `skills/network-diagnose/SKILL.md` |
| `dsh/generated/system-prompt-sections.md` | `rules/*.md` + `prompts/ops-engineer.md` |
| `codex/.codex/skills/network-diagnose/*` | `skills/network-diagnose/SKILL.md` |
| `codex/.codex/AGENTS.md` | `rules/*.md` + `prompts/ops-engineer.md` |
| `codex/.codex/config.toml` | `configs/runtime.yaml`（engine: codex 时） |

## 验证结论

逐字段核对与 3 个校准点见 [docs/compile-verification.md](../../docs/compile-verification.md)。

> 一个真实旁证：本仓库环境本身遵循 AGENTS.md 约定——`codex/.codex/AGENTS.md` 生成后即被环境识别为指令来源，证明编译产物是"活的"，不是纸面格式。
