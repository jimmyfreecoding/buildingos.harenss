---
# Runbook 模板
#
# 立场：Runbook 是「策展资产」，不是 LLM 生成物。
# 每一条步骤都必须来自官方文档或实验室真机验证。
# LLM 只能：检索本手册、按客户环境裁剪、生成对话式引导 —— 不得发明新步骤。

id: vendor-model-slug
title: "厂商 型号 —— 常用操作手册"
status: draft            # draft | verified | deprecated
verified_by: null        # 必须填真人姓名
verified_at: null        # 验证日期
verified_on_firmware: null
source_docs: []          # 官方文档链接，逐条列出

# ── 匹配规则（决定这台设备会不会命中本手册）─────────────────
match:
  vendor: "厂商名"
  model_regex: "^型号.*$"
  firmware_range: ">=1.0.0"
  services: [80, 443, 554]
  identity_evidence: ["http-banner", "tls-cert-cn", "onvif-realm", "mdns"]

# ── 登录入口 ────────────────────────────────────────────────
access:
  web: "http://{ip}/"
  cli: null
  app: null
  auth: digest            # basic | digest | form | klap | ssh-key | oauth
  default_credentials_warning: "出厂默认密码必须首次登录即修改"
  lockout_policy: "连续 5 次失败锁定 5 分钟 —— 自动化重试前必须检查"
  credential_ref: "VAULT://<site>/<target>"

# ── 常用任务（每项必须含精确路径与验证方法）─────────────────
tasks:
  - id: change-wifi-channel
    name: "修改 Wi-Fi 信道"
    steps:
      - "登录 → 菜单：网络设置 → 无线 → 2.4G"
      - "将「信道」从 自动 改为 手动，选择目标信道"
      - "保存并等待射频重启（约 30 秒）"
    verify:
      method: probe-rescan        # 由探针复测，不采信用户自述
      check: "目标 BSSID 的 channel 字段等于目标值"
    risk: medium
    rollback: "改回原信道并保存"

# ── 风险操作（默认禁止自动执行）─────────────────────────────
risky_operations:
  - id: factory-reset
    impact: "全部配置丢失，需重新配网与重新加入所有 IoT"
    precheck: ["已导出配置备份", "已确认非关键时段"]
    allowed_by_product: false

# ── 常见故障与处置 ──────────────────────────────────────────
troubleshooting:
  - symptom: "Web 打不开但 ping 通"
    likely: "HTTPS 强制 / 端口非 80"
    action: "试 https://{ip}/ 与 8443"
