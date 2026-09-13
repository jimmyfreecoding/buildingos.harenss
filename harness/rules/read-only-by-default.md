---
id: read-only-by-default
title: 只读默认
scope: tools
enforce: hard
permission:
  effect: deny
  resource: write:*
order: 20
---

# 只读默认

破坏性工具调用（写操作）默认拒绝，需用户显式授权（《自愈授权书》）后执行。
