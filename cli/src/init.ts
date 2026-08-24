/**
 * `buildingos init <dir>` — scaffold a new tenant repository (the CLI wizard's
 * first-boot artifact set, docs/runtime-bootstrap.md §2). A minimal starter set:
 * .buildingos/{rules,skills,prompts,configs} + knowledge/ + .gitignore (D21).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STARTER: Record<string, string> = {
  '.buildingos/rules/read-only-by-default.md': `---
id: read-only-by-default
title: 只读默认
scope: tools
enforce: hard
permission:
  effect: deny
  resource: write:*
order: 10
---

# 只读默认

破坏性工具调用（写操作）默认拒绝，需用户显式授权后执行。
`,
  '.buildingos/skills/hello/SKILL.md': `---
name: hello
description: 问候示例技能
when-to-use: 用户说"你好"时
invocation:
  model: true
  user: true
  implicit: true
---

# 你好

1. 用中文友好问候用户。
2. 说明你是该租户的 BuildingOS 助手，并简述它具备的能力。
`,
  '.buildingos/prompts/assistant.md': `---
id: assistant
language: zh-CN
tone: friendly, concise
order: 20
---

# 助手

- 中文回答，保留英文技术术语。
- 结论先说，细节后补。
`,
  '.buildingos/configs/runtime.yaml': `version: "0.1"
engine: dsh
model: gpt-4o
sandbox: read-only
approval: on-request
# permissions 不在此手写：由 rules/ 的 hard 规则派生（D14）
`,
  'knowledge/README.md': `# 世界知识（D19）

把关于这个世界的事实性知识放在这里（network.md、拓扑、基线等），
由 harness 梳理生成、人工评审、版本化；即时状态数据留在 DB，不进仓库。
`,
  '.gitignore': `# 秘密配置（D21）：钥匙绝不进仓库
.env
.env.*
`,
};

export async function initTenant(dir: string): Promise<string[]> {
  const written: string[] = [];
  for (const [rel, content] of Object.entries(STARTER)) {
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, 'utf8');
    written.push(rel);
  }
  return written;
}
