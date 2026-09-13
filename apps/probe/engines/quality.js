'use strict';

/**
 * 探针 v2 · 链路质量引擎
 * 能力：多包探测（丢包率/平均/最小/最大时延/抖动）、TTL 跳数提示、网关/外网/DNS 质量、
 *       自身无线信息（Windows netsh / Linux iw）、薄弱环节排序、风暴疑似检测（SNMP 计数差值）。
 * 探测原语由调用方注入（pingOnce），本模块为纯逻辑 + 解析器，可单测。
 */

/** 单主机多包测量。pingOnce(ip) => { ok, rttMs, ttl } | { ok:false } */
async function measure({ ip, pingOnce, count = 5 }) {
  const rtts = []
  let ttlSum = 0
  let ttlN = 0
  for (let i = 0; i < count; i++) {
    const r = await pingOnce(ip)
    if (r && r.ok) {
      if (r.rttMs != null) rtts.push(r.rttMs)
      if (r.ttl != null) { ttlSum += r.ttl; ttlN += 1 }
    }
  }
  const lossPct = count ? Math.round(((count - rtts.length) / count) * 100) : 100
  const avg = rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null
  const min = rtts.length ? Math.min(...rtts) : null
  const max = rtts.length ? Math.max(...rtts) : null
  const jitter = rtts.length > 1
    ? Math.round(Math.sqrt(rtts.reduce((s, v) => s + (v - avg) * (v - avg), 0) / rtts.length) * 100) / 100
    : 0
  const avgTtl = ttlN ? ttlSum / ttlN : null
  // TTL 跳数提示：本地设备回包 TTL 64（Linux）或 128（Windows），每过一跳减 1
  const hops = avgTtl == null ? null : Math.max(0, (avgTtl <= 64 ? 64 : 128) - avgTtl)
  const verdict = lossPct > 5 ? 'poor' : avg != null && avg > 150 ? 'slow' : jitter > 20 ? 'unstable' : 'good'
  const weak = verdict !== 'good'
  return { ip, count, lossPct, avg: round1(avg), min: round1(min), max: round1(max), jitter, avgTtl: round1(avgTtl), hops, verdict, weak }
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

/**
 * 全网质量评估：逐设备测量 + 网关 + 外网 + DNS + 自身无线 + 薄弱环节排序
 * opts: { devices:[{ip,vendor,type}], pingOnce, gatewayIp, internetIp='8.8.8.8', dnsIp='75.75.75.75', count=3, wirelessSelf=null }
 */
async function assessNetwork(opts = {}) {
  const { devices = [], pingOnce, gatewayIp, internetIp = '8.8.8.8', dnsIp = '75.75.75.75', count = 3, wirelessSelf = null } = opts
  const deviceResults = []
  for (const d of devices) {
    const m = await measure({ ip: d.ip, pingOnce, count })
    deviceResults.push({ ...d, ...m })
  }
  const gateway = gatewayIp ? await measure({ ip: gatewayIp, pingOnce, count }) : null
  const internet = await measure({ ip: internetIp, pingOnce, count })
  const dns = await measure({ ip: dnsIp, pingOnce, count })
  const weakLinks = deviceResults.filter((d) => d.weak).sort((a, b) => b.lossPct - a.lossPct || (b.avg || 0) - (a.avg || 0))
  const summary = {
    deviceCount: deviceResults.length,
    weakCount: weakLinks.length,
    online: deviceResults.filter((d) => d.lossPct < 100).length,
    gatewayVerdict: gateway ? gateway.verdict : null,
    internetVerdict: internet.verdict,
  }
  return { devices: deviceResults, gateway, internet, dns, wirelessSelf, weakLinks, summary }
}

/** 解析 Windows `ping` 单行输出 → { ok, rttMs, ttl } | null（不匹配则 null） */
function parsePingLine(line) {
  const s = String(line || '')
  if (/request timed out|destination host unreachable|100% loss/i.test(s)) return { ok: false }
  const rtt = s.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i)
  const ttl = s.match(/TTL=(\d+)/i)
  if (!rtt) return null
  return { ok: true, rttMs: Number(rtt[1]), ttl: ttl ? Number(ttl[1]) : null }
}

/** 解析 Windows `netsh wlan show interfaces` → 无线自检信息 */
function parseWirelessSelfWindows(text) {
  const out = {}
  const grab = (key) => {
    const m = String(text || '').match(new RegExp(`\\s*${key}\\s*:\\s*(.+)`))
    return m ? m[1].trim() : null
  }
  const ssid = grab('SSID')
  if (ssid === null) return null
  out.ssid = ssid
  out.band = grab('Band')
  out.channel = grab('Channel')
  out.signal = grab('Signal')
  out.rssi = grab('Rssi')
  out.rate = grab('Receive rate')
  out.auth = grab('Authentication')
  return out
}

/**
 * 风暴疑似检测（需两次 SNMP 计数器快照，Pi+凭据环境）
 * opts: { octetsA, octetsB, discardsA, discardsB, intervalSec, rateMbpsThreshold = 300 }
 * 返回 { rateMbps, discardDelta, storm: boolean, note }
 */
function detectStorm(opts = {}) {
  const { octetsA = 0, octetsB = 0, discardsA = 0, discardsB = 0, intervalSec = 60, rateMbpsThreshold = 300 } = opts
  if (intervalSec <= 0) return { rateMbps: 0, discardDelta: 0, storm: false, note: 'interval must be > 0' }
  const bytes = Math.max(0, octetsB - octetsA)
  const rateMbps = Math.round((bytes * 8) / intervalSec / 1e6 * 100) / 100
  const discardDelta = Math.max(0, discardsB - discardsA)
  const storm = rateMbps > rateMbpsThreshold && discardDelta > 100
  return { rateMbps, discardDelta, storm, note: storm ? '疑似广播/环路风暴：速率与丢包计数同时飙升' : '正常' }
}

module.exports = { measure, assessNetwork, parsePingLine, parseWirelessSelfWindows, detectStorm }
