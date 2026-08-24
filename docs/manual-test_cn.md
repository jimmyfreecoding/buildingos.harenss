# BuildingOS 人工测试指南（当前状态：M1 + M1.5 向导/工作区）

> 目的：人工走查今天能用的全部能力——首启向导、工作区解析、normalizer 校验、双引擎编译、conformance。
> English: [manual-test.md](manual-test.md)
> 自动化基线：`pnpm verify`（48 测试 + e2e 演示）。本指南是人工版。

## 0. 准备

```bash
node -v && pnpm -v          # node >= 18，pnpm >= 9（已验证 node 24 / pnpm 11.7）
git clone <仓库> && cd buildingos.harenss
pnpm install && pnpm build
```

## 1. 自动化基线（建议先跑）

```bash
pnpm verify
# 预期：typecheck/build OK、48 测试通过、e2e: OK
```

## 2. 首启向导（真实终端交互）

```bash
node cli/dist/cli.js init my-tenant
# 或（若已链接 bin）：buildingos init my-tenant
```

逐个回答问题——**第一个问题必须是语言选择**：

| 步骤 | 操作 | 预期 |
|---|---|---|
| 0 | 选 `1`（中文）或 `2`（English） | 后续提示用所选语言 |
| 1 | 选引擎（dsh / codex） | 打印适配器状态（`OK ...`） |
| 2 | 选模型或"其他/Other"+ 手输句柄 | — |
| 3 | 输入模型 token（明文回显——已知限制） | — |
| 4 | 输入 git token，或回车跳过 | 为空时提示"Git credentials: skipped" |
| 5 | 脚手架输出 | 列出 `.buildingos/...` + `knowledge/` + `.gitignore` |
| 6 | 校验 | `校验通过（OK）` |
| 7 | 汇总 | 列出后续命令 |

**核对产物**：

```bash
find my-tenant -type f | sort
# .buildingos/configs/runtime.yaml   engine/model 与你选择一致
# .buildingos/rules、skills、prompts、configs
# knowledge/README.md、.gitignore、.env、.env.example

cat my-tenant/.env                    # MODEL_TOKEN=... GIT_TOKEN=...（或跳过注释）
cat my-tenant/.env.example            # 只有键名，无值
grep -A2 "^engine" my-tenant/.buildingos/configs/runtime.yaml
```

**D21 检查——钥匙绝不进 Git**：

```bash
cd my-tenant && git init && git add -A && git status
# .env 必须不出现；.env.example 必须出现（.gitignore 的例外）
```

## 3. validate（normalizer lint）

```bash
buildingos validate my-tenant     # 或：cd my-tenant && buildingos validate（向上搜索）
# 预期：validate: OK (0 warnings/info)
```

**负面注入——弄坏它、看它报错、再修好**：

```bash
# a) 不可解析的工具依赖（D3）
#    改 .buildingos/skills/hello/SKILL.md → dependencies: tools: [{ type: mcp, value: nope }]
buildingos validate my-tenant     # 预期：[ERROR] DEP_UNRESOLVED ... "nope"

# b) 跨家族 order 重号（D20）
#    改 .buildingos/prompts/assistant.md → order: 10（与规则同号）
buildingos validate my-tenant     # 预期：[ERROR] ORDER_DUPLICATE ... order 10 is already used by rule:...

# c) 手写 permissions（D14）
#    改 .buildingos/configs/runtime.yaml → 加一个 permissions: 段
buildingos validate my-tenant     # 预期：[ERROR] PERMISSIONS_HAND_WRITTEN ...

# 全部还原 → validate: OK
```

## 4. compile——双引擎视图

```bash
buildingos compile --engine dsh my-tenant      # → my-tenant/engine-views/dsh
buildingos compile --engine codex my-tenant    # → my-tenant/engine-views/codex
```

**查看 DSH 视图**（`engine-views/dsh/`）：

```bash
cat engine-views/dsh/.dsh/skills/hello/SKILL.md
# frontmatter：name、description（有则含 whenToUse/metadata）
cat engine-views/dsh/generated/system-prompt-sections.md
# ## rules:read-only-by-default (order 10, hard) ... ## persona:assistant (order 20, from prompts)
```

**查看 Codex 视图**（`engine-views/codex/`）：

```bash
cat engine-views/codex/.codex/skills/hello/SKILL.md   # 仅 name/description/metadata.short-description
cat engine-views/codex/.codex/skills/hello/openai.yaml # interface / policy / dependencies
cat engine-views/codex/.codex/AGENTS.md                 # 规则按 order + 人格
cat engine-views/codex/.codex/config.toml               # model / sandbox_mode / approval_policy / mcp_servers
```

**无损携带抽查（D2/D4）**——给技能加 `ui:` 块和 `invocation.implicit: false`，重新编译后：

```bash
# DSH 视图：metadata.x-buildingos.{ui,invocation-implicit} 存在（运行时忽略、往返安全）
grep -A8 "x-buildingos" engine-views/dsh/.dsh/skills/hello/SKILL.md
# Codex 视图：openai.yaml policy.allow_implicit_invocation: false + interface 字段
grep -A8 "^policy\|^interface" engine-views/codex/.codex/skills/hello/openai.yaml
```

## 5. conformance（G1）

```bash
buildingos conformance my-tenant
# 预期：
#   [PASS] G1-compile-parity (dsh)
#   [PASS] G1-compile-parity (codex)
#   [SKIP] G2/G3/G4（引擎门控；需 run() 桥）
```

## 6. 工作区解析（工具 ≠ 项目）

```bash
cd my-tenant && buildingos validate          # 向上找 .buildingos/ 标记 → OK
BUILDINGOS_WORKSPACE=my-tenant buildingos validate   # 环境变量 → OK
buildingos validate --workspace my-tenant    # 显式 flag → OK

cd <buildingos-工具仓库> && buildingos validate
# 预期报错："no workspace found: no .buildingos/ marker ... Run `buildingos init <dir>` ..."
```

## 7. 回归闭环

改 know-how（`rules` / `skills` / `prompts`）→ `validate` → `compile`（双引擎）→ `conformance` → `pnpm verify`。每次行为变更都是一个 Git PR：评审、合并、回滚。

## 已知限制（测试时注意）

1. **token 在向导中明文回显**——终端掩码随 runtime 控制台（M3）提供。
2. **管道喂 stdin**（如 `echo 1 | buildingos init x`）在非 TTY 下丢失输出——readline 边缘情况；请在真实终端交互操作。
3. **尚无引擎运行时**：`run()` 桥待实现（DSH ACP/进程内；Codex `codex mcp-server`）——G2–G4 保持 SKIP，也没有真实 Agent 对话。
4. **尚无 runtime CLI**：`buildingos dev` / `buildingos serve --prod` 不存在；当前面就是四个命令（init/validate/compile/conformance）。
