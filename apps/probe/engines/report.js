'use strict';

/**
 * M7 报告引擎：健康评分 + 日报 + 诊断报告（Markdown 渲染，纯函数）
 * 评分模型（03/09 文档口径）：overall = 40% 网络 + 40% 安防 + 20% 基础设施
 */

/** 计算健康分。devices 需含 status('online'|'offline'|'degraded') 与 type；events 需含 level */
function computeHealth({ devices = [], events = [], blackFrames = 0, portErrorPorts = [] } = {}) {
  const total = devices.length
  const online = devices.filter((d) => d.status !== 'offline').length
  const onlineRatio = total ? online / total : 1

  const cameras = devices.filter((d) => d.type === 'camera')
  const camOnline = cameras.filter((d) => d.status !== 'offline').length
  const camRatio = cameras.length ? camOnline / cameras.length : 1

  const p1 = events.filter((e) => e.level === 'P1').length
  const p2 = events.filter((e) => e.level === 'P2').length

  const network = Math.round(100 * (0.7 * onlineRatio + 0.3 * (portErrorPorts.length ? 0.5 : 1)))
  const security = Math.round(100 * (0.8 * camRatio + 0.2 * (blackFrames ? 0.3 : 1)))
  const infraPenalty = Math.min(0.3, p1 * 0.15 + p2 * 0.05)
  const infrastructure = Math.round(100 * (1 - infraPenalty))
  const overall = Math.round(0.4 * network + 0.4 * security + 0.2 * infrastructure)

  const issues = []
  if (p1) issues.push(`P1 核心设备故障 ×${p1}`)
  if (p2) issues.push(`P2 设备掉线/自愈 ×${p2}`)
  if (portErrorPorts.length) issues.push(`端口错误率超标：${portErrorPorts.join(', ')}`)
  if (blackFrames) issues.push(`黑屏/异常画面摄像头 ×${blackFrames}`)

  return { overall, network, security, infrastructure, onlineRatio, camRatio, issues }
}

/** 日报（09 §6 模板） */
function renderDailyReport({ site = 'Unnamed Site', date = new Date(), health, deviceCount = 0, eventCount = 0, tips = [] } = {}) {
  const h = health || computeHealth({})
  const d = date instanceof Date ? date.toISOString().slice(0, 10) : String(date)
  const tipsBlock = tips.length ? tips.map((t, i) => `${i + 1}. ${t}`).join('\n') : '（今日无）'
  return [
    `【AegisNet 运行健康日报】${site} · ${d}`,
    '────────────────────────────',
    `整体健康分：${h.overall} / 100`,
    `网络：在线 ${Math.round(h.onlineRatio * 100)}% · 健康 ${h.network}`,
    `安防：摄像头在线 ${Math.round(h.camRatio * 100)}% · 健康 ${h.security}`,
    `基础设施：${h.infrastructure}`,
    `资产数：${deviceCount} · 今日事件：${eventCount}`,
    h.issues.length ? `隐患：${h.issues.join('；')}` : '隐患：无',
    'AI 小贴士：',
    tipsBlock,
    '────────────────────────────',
    '如需人工上门排查，回复本邮件或致电 713-XXX-XXXX',
  ].join('\n')
}

/** 14 天诊断报告（资产清单 / 拓扑摘要 / 事件统计 / 隐患分级 / 升级建议） */
function renderDiagnosticReport({ site = 'Unnamed Site', generatedAt = new Date(), devices = [], events = [], health, topologySummary = null } = {}) {
  const h = health || computeHealth({ devices, events })
  const lines = [
    `# 《${site} IT/安防健康诊断报告》`,
    '',
    `生成时间：${generatedAt instanceof Date ? generatedAt.toISOString() : generatedAt}`,
    '',
    '## 1. 执行摘要',
    `- 整体健康分：**${h.overall} / 100**（网络 ${h.network} / 安防 ${h.security} / 基础设施 ${h.infrastructure}）`,
    `- 发现设备：${devices.length} 台`,
    `- 隐患：${h.issues.length ? h.issues.join('；') : '无'}（见第 5 节分级）`,
    '',
    '## 2. 资产清单',
    '| IP | MAC | 厂商 | 类型 | 随机MAC |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const d of devices.slice(0, 200)) {
    lines.push(`| ${d.ip || '-'} | ${d.mac || '-'} | ${d.vendor || '-'} | ${d.type || '-'} | ${d.randomMac ? '是' : '否'} |`)
  }
  lines.push('', '## 3. 拓扑摘要')
  if (topologySummary) {
    lines.push(`- 链路总数：${topologySummary.links}，数据来源：${JSON.stringify(topologySummary.sources)}`)
  } else {
    lines.push('- （未采集 LLDP/CAM，仅有 L2 邻居级拓扑）')
  }
  lines.push('', '## 4. 事件统计')
  const byLevel = {}
  for (const e of events) byLevel[e.level] = (byLevel[e.level] || 0) + 1
  lines.push(`- P1: ${byLevel.P1 || 0} · P2: ${byLevel.P2 || 0} · P3: ${byLevel.P3 || 0} · P4: ${byLevel.P4 || 0}`)
  lines.push('', '## 5. 隐患清单（按优先级）')
  if (h.issues.length) h.issues.forEach((i, n) => lines.push(`${n + 1}. ${i}`))
  else lines.push('- 无')
  lines.push('', '## 6. 升级建议（CapEx 参考）')
  lines.push('- 由隐患清单导出：Wi-Fi 覆盖补盲 / CCTV 增装 / 机房理线（详见报价单）')
  lines.push('')
  return lines.join('\n')
}

module.exports = { computeHealth, renderDailyReport, renderDiagnosticReport }
