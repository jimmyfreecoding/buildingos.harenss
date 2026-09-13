---
id: no-data-exfiltration
title: 数据不出租户边界
scope: all
enforce: hard
permission:
  effect: deny
  resource: data:*:external
order: 10
---

# 数据不出租户边界

禁止将客户数据发送至租户边界之外的任何端点。
