---
id: h3c-magic-ap
title: "H3C Magic 系列（wnm/quicknet 固件）—— 无线设置手册"
# ★ 诚实标注：本手册由指纹推断写成，尚未在真机后台验证过。
#   状态保持 draft，未验证的内容不得用于生产变更。
status: draft
verified_by: null
verified_at: null
verified_on_firmware: null
source_docs:
  - "https://www.h3c.com/cn/ (待补充对应型号的官方手册链接)"

match:
  vendor: "New H3C Technologies"
  model_regex: "^Magic.*$|^H3C.*$"
  services: [80, 443]
  identity_evidence:
    - "http-title: Web managerment Home"
    - "html: /wnm/ssl/web/frame/login.html"
    - "html-ref: quicknet.h3c.com"

access:
  web: "http://10.0.0.204/"
  auth: form
  default_credentials_warning: "出厂默认通常为 admin/admin 或 admin/设备背面标签；首次登录必须修改"
  credential_ref: "VAULT://home-01/h3c-ap"
  note: "该设备同时开放 telnet(23) 与 DNS(53)，属需收敛的暴露面"

# 本客户的核心优化动作落在这台设备上（本网络中唯一可手动设信道的 AP）
tasks:
  - id: change-wifi-channel-24g
    name: "修改 2.4G 信道（当前 ch1 → 建议 ch6/11）"
    precheck:
      - "确认网关上无设备正处于配网状态"
      - "已记录当前信道（ch1）用于回滚"
    steps:
      - "浏览器访问 http://10.0.0.204/ ，使用 Vault 中的凭据登录"
      - "进入 无线设置 / WLAN 配置 → 选择 2.4G 射频"
      - "信道由「自动」改为「手动」，选择目标信道（建议先试 ch6）"
      - "带宽建议设为 20MHz（拥挤环境下比 40MHz 更抗干扰）"
      - "保存，等待射频重启约 30 秒"
    verify:
      method: probe-rescan
      check: "BSSID 18:c0:09:64:d5:48 的 channel 等于目标值，且已关联客户端数未掉为 0"
    risk: medium
    rollback: "把信道改回 1（或改回自动）并保存"

  - id: change-wifi-channel-5g
    name: "修改 5G 信道（当前 ch36 → 建议 ch149/153）"
    rationale: "ch36 与 Xfinity 网关的 ch44 同属 UNII-1 的 36–48 80MHz 频段，默认 80MHz 下完全重叠；实测 ch149 利用率仅 2%、ch153 21%"
    steps:
      - "无线设置 → 5G 射频 → 信道改手动 → 选择 149 或 153"
    verify: { method: probe-rescan, check: "BSSID 18:c0:09:64:d5:40 的 channel 等于目标值" }
    risk: medium
    rollback: "改回 36"

  - id: disable-open-ssid
    name: "关闭无加密开放 SSID"
    rationale: "该设备额外广播了一个 Open/None 的 SSID（BSSID 18:c0:09:64:d5:49），既是安全风险也增加空口开销"
    steps:
      - "无线设置 → 找到该 SSID → 关闭广播或改为加密"
    verify: { method: probe-rescan, check: "该 BSSID 不再出现在扫描结果中" }
    risk: medium

risky_operations:
  - id: factory-reset
    impact: "SSID/密码/所有 IoT 关联丢失，全屋需重配"
    allowed_by_product: false
  - id: change-wan-mode
    impact: "若当前为路由模式改成桥接，会改变整个下游网段，NVR(10.0.0.251) 端口映射全部失效"
    allowed_by_product: false

troubleshooting:
  - symptom: "登录页反复回到登录框"
    likely: "Cookie/HTTPS 强制跳转"
    action: "试 https://10.0.0.204/ 或换浏览器隐私模式"
  - symptom: "改完信道后设备离线"
    likely: "改了错误的射频或客户端不支持的频段"
    action: "等待 2 分钟；仍离线则网线直连管理口或按复位键恢复"

open_questions:
  - "10.0.0.204 究竟工作在哪一侧：桥接还是路由（含 NAT）？"
    impact: "若为路由模式，Geeqee2024 下的设备处于双 NAT，云 P2P 摄像头会更卡"
    how_to_confirm: "查看后台 WAN/LAN 状态，或确认其 Wi-Fi 客户端拿到的是否为 10.0.0.x"
  - "该设备是否运行 DHCP/DNS 服务（开放 53 端口）？"
    impact: "若在 10.0.0.0/24 上私接 DHCP，会造成客户端网关/DNS 随机错配"
