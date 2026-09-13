'use strict'

/**
 * AegisNet 探针 · 独立后端（v3 架构：前端/后端与 DSH 分离）
 * 用法：node server/server.js  （默认 127.0.0.1:3210；PROBE_PORT / PROBE_DATA 可覆盖）
 * 依赖：engines/*（纯 Node 模块）；无第三方框架。
 * 能力：REST API（devices/topology/quality/scan/report/assets/asset/status/events）
 *       + 5 分钟 patrol + 知识库与测量历史持久化（probe/data/*.json）
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFile } = require('child_process')

const DATA_DIR = process.env.PROBE_DATA || path.join(__dirname, '..', 'data')
const WEB_DIR = path.join(__dirname, '..', 'web')
const PORT = Number(process.env.PROBE_PORT || 3210)
const HOST = process.env.PROBE_HOST || '127.0.0.1'

const { parseArpTable } = require('../engines/discovery')
const { pingSweep } = require('../engines/sweep')
const { measure, assessNetwork, parseWirelessSelfWindows } = require('../engines/quality')
const { buildTopology, inferNodeType } = require('../engines/topology')
const { computeHealth, renderDailyReport, renderDiagnosticReport } = require('../engines/report')
const { createKnowledge } = require('../engines/knowledge')

const isWin = process.platform === 'win32'
const kb = createKnowledge(DATA_DIR)
fs.mkdirSync(DATA_DIR, { recursive: true })

// ---------------- 内存状态 ----------------
const mem = {
  startedAt: new Date().toISOString(),
  lastQuality: null,
  history: [],
  events: [],
  gateway: null,
  lastScan: null,
  patrol: null,
}
const pushEvent = (e) => {
  mem.events.push({ ts: new Date().toISOString(), ...e })
  if (mem.events.length > 200) mem.events.splice(0, mem.events.length - 200)
}
const historyFile = path.join(DATA_DIR, 'measurements.json')
function loadHistory() {
  try { mem.history = JSON.parse(fs.readFileSync(historyFile, 'utf8')) } catch { mem.history = [] }
}
function historyPush(q) {
  mem.history.push({
    at: q.at, weakCount: q.weakCount, online: q.online, deviceCount: q.deviceCount,
    gatewayVerdict: q.gateway ? q.gateway.verdict : null,
    internetVerdict: q.internet ? q.internet.verdict : null,
  })
  if (mem.history.length > 500) mem.history.shift()
  fs.writeFileSync(historyFile, JSON.stringify(mem.history, null, 2))
}
loadHistory()

// ---------------- 采集原语 ----------------
function arpText() {
  return new Promise((resolve) => {
    execFile(isWin ? 'arp' : 'ip', isWin ? ['-a'] : ['neigh'], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => resolve(err ? '' : stdout))
  })
}
function pingOnce(ip) {
  return new Promise((resolve) => {
    execFile('ping', isWin ? ['-n', '1', '-w', '500', ip] : ['-c', '1', '-W', '1', ip], { encoding: 'utf8', timeout: 2500 }, (err, stdout) => {
      if (err || !stdout) return resolve({ ok: false })
      const ttl = /TTL=(\d+)/i.exec(stdout)
      const time = /time[=<](\d+(?:\.\d+)?)\s*ms/i.exec(stdout)
      resolve({ ok: true, rttMs: time ? Number(time[1]) : null, ttl: ttl ? Number(ttl[1]) : null })
    })
  })
}
const execPing = (ip) => pingOnce(ip).then((r) => r.ok)
function wirelessSelf() {
  return new Promise((resolve) => {
    if (!isWin) return resolve(null)
    execFile('netsh', ['wlan', 'show', 'interfaces'], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => resolve(err ? null : parseWirelessSelfWindows(stdout)))
  })
}
/** 用 ARP 网关反推真实局域网 /24（避免选错网卡，如 VirtualBox Host-Only） */
async function detectLan() {
  const rows = parseArpTable(await arpText())
  const routerVend = rows.find((r) => /vantiva|xfinity/i.test(r.vendor))
    || rows.find((r) => r.ip.endsWith('.1'))
    || rows.find((r) => r.ip.endsWith('.254'))
    || rows[0]
  const gatewayIp = routerVend ? routerVend.ip : null
  const gwPrefix = gatewayIp ? gatewayIp.split('.').slice(0, 3).join('.') : null
  let self = null
  const ifs = os.networkInterfaces()
  outer:
  for (const name of Object.keys(ifs)) {
    for (const it of ifs[name]) {
      if (it.internal || it.family !== 'IPv4') continue
      const p = it.address.split('.').slice(0, 3).join('.')
      if (gwPrefix && p === gwPrefix) { self = it.address; break outer }
    }
  }
  if (!self) {
    outer:
    for (const name of Object.keys(ifs)) {
      for (const it of ifs[name]) {
        if (it.internal || it.family !== 'IPv4') continue
        if (!it.address.startsWith('169.254') && !it.address.startsWith('192.168.56')) { self = it.address; break outer }
      }
    }
  }
  const prefix = (self || gatewayIp || '').split('.').slice(0, 3).join('.') || null
  return { prefix: prefix || null, self: self || null, gatewayIp }
}

// ---------------- 业务函数 ----------------
async function devicesEnriched() {
  const lan = await detectLan()
  const raw = parseArpTable(await arpText()).filter((d) => !lan.prefix || d.ip.startsWith(lan.prefix))
  return kb.applyToDevices(raw).map((d) => ({ ...d, type: d.type || inferNodeType(d) }))
}
function gatewayOf(devices) {
  return devices.find((d) => d.type === 'router') || null
}
async function runScan() {
  const lan = await detectLan()
  const live = lan.prefix ? await pingSweep(lan.prefix, { execPing, concurrency: 40 }) : []
  const devices = await devicesEnriched()
  const gw = gatewayOf(devices)
  mem.lastScan = { at: new Date().toISOString(), liveCount: live.length, arpCount: devices.length, subnet: lan.prefix ? `${lan.prefix}.0/24` : null }
  if (gw) mem.gateway = { ip: gw.ip, mac: gw.mac }
  return { live, devices, gateway: gw ? gw.ip : null, subnet: mem.lastScan.subnet }
}
async function runQuality(count = 3) {
  const devices = await devicesEnriched()
  const gw = gatewayOf(devices)
  const wireless = await wirelessSelf()
  const res = await assessNetwork({
    devices,
    pingOnce,
    gatewayIp: gw ? gw.ip : null,
    count: Math.min(Math.max(count, 1), 10),
    wirelessSelf: wireless,
  })
  mem.lastQuality = {
    at: new Date().toISOString(),
    deviceCount: res.devices.length,
    weakCount: res.weakLinks.length,
    online: res.summary.online,
    gateway: res.gateway,
    internet: res.internet,
    dns: res.dns,
    wirelessSelf: wireless,
    weakLinks: res.weakLinks.map((w) => ({ ip: w.ip, vendor: w.vendor, type: w.type, lossPct: w.lossPct, avg: w.avg, jitter: w.jitter, hops: w.hops, verdict: w.verdict })),
  }
  historyPush(mem.lastQuality)
  return mem.lastQuality
}
function maskedAccounts() {
  return kb.listAccounts().map((a) => ({ ...a, password: a.password ? '••••' : '' }))
}
function reportHealth(devices) {
  return computeHealth({ devices: devices.map((d) => ({ ...d, status: 'online' })), events: mem.events })
}

// ---------------- HTTP ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
function sendJson(res, code, data) {
  const body = JSON.stringify(data)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
  res.end(body)
}
function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0]
  const file = path.join(WEB_DIR, path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, ''))
  if (!file.startsWith(WEB_DIR)) return sendJson(res, 403, { ok: false, reason: 'forbidden' })
  fs.readFile(file, (err, buf) => {
    if (err) return sendJson(res, 404, { ok: false, reason: 'not found' })
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
    res.end(buf)
  })
}
async function readBody(req) {
  return new Promise((resolve) => {
    let d = ''
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy() })
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}) } catch { resolve({}) } })
  })
}

const routes = async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const p = u.pathname
  const method = req.method

  if (method === 'GET' && (p === '/' || p.startsWith('/index') || p.startsWith('/app') || p.startsWith('/style') || p.startsWith('/favicon'))) return serveStatic(req, res)

  if (method === 'GET' && p === '/api/status') {
    const devices = await devicesEnriched()
    return sendJson(res, 200, { ok: true, startedAt: mem.startedAt, deviceCount: devices.length, gateway: mem.gateway, lastScan: mem.lastScan, patrol: mem.patrol, lastQualityAt: mem.lastQuality ? mem.lastQuality.at : null, weakCount: mem.lastQuality ? mem.lastQuality.weakCount : 0, historyLen: mem.history.length, eventCount: mem.events.length })
  }
  if (method === 'GET' && p === '/api/devices') return sendJson(res, 200, { ok: true, devices: await devicesEnriched() })
  if (method === 'GET' && p === '/api/topology') {
    const devices = await devicesEnriched()
    const gw = gatewayOf(devices)
    const topo = buildTopology({ devices, lldp: [], cam: [], gatewayIp: gw ? gw.ip : null, gatewayMac: gw ? gw.mac : null })
    return sendJson(res, 200, { ok: true, ...topo })
  }
  if (method === 'GET' && p === '/api/quality') return sendJson(res, 200, { ok: true, quality: mem.lastQuality, history: mem.history.slice(-30) })
  if (method === 'POST' && p === '/api/scan') return sendJson(res, 200, { ok: true, ...(await runScan()) })
  if (method === 'POST' && p === '/api/quality') {
    const body = await readBody(req)
    const q = await runQuality(body.count)
    return sendJson(res, 200, { ok: true, quality: q })
  }
  if (method === 'GET' && p === '/api/report/daily') {
    const devices = await devicesEnriched()
    const health = reportHealth(devices)
    const site = u.searchParams.get('site') || '探针站点'
    return sendJson(res, 200, { ok: true, markdown: renderDailyReport({ site, date: new Date(), health, deviceCount: devices.length, eventCount: mem.events.length }) })
  }
  if (method === 'GET' && p === '/api/report/diagnostic') {
    const devices = await devicesEnriched()
    const health = reportHealth(devices)
    const site = u.searchParams.get('site') || '探针站点'
    let md = renderDiagnosticReport({ site, devices, events: mem.events, health, topologySummary: null })
    // v2 追加：链路质量与薄弱环节 + 配置记录（脱敏）
    const q = mem.lastQuality
    if (q) {
      md += ['', '## 链路质量与薄弱环节',
        `- 网关：${q.gateway ? `${q.gateway.lossPct}% 丢包 / ${q.gateway.avg}ms / ${q.gateway.verdict}` : '未测'}`,
        `- 外网(8.8.8.8)：${q.internet ? `${q.internet.lossPct}% / ${q.internet.avg}ms / ${q.internet.verdict}` : '未测'}`,
        `- DNS(75.75.75.75)：${q.dns ? `${q.dns.lossPct}% / ${q.dns.avg}ms` : '未测'}`,
        q.weakLinks && q.weakLinks.length
          ? `- 薄弱环节 ${q.weakLinks.length} 处：` + q.weakLinks.slice(0, 5).map((w) => `${w.ip}(丢包${w.lossPct}%,${w.avg}ms,${w.verdict})`).join('；')
          : '- 薄弱环节：无',
        q.wirelessSelf ? `- 探针无线：SSID ${q.wirelessSelf.ssid} · ${q.wirelessSelf.band} · ${q.wirelessSelf.signal}` : '',
      ].join('\n')
    }
    const accts = maskedAccounts()
    if (accts.length) {
      md += ['', '## 配置记录（登录入口，密码已脱敏）', '| 设备 | IP | 用户名 | 说明 |', '| --- | --- | --- | --- |',
        ...accts.map((a) => `| ${a.device || '-'} | ${a.ip || '-'} | ${a.username || '-'} | ${a.notes || ''} |`),
      ].join('\n')
    }
    return sendJson(res, 200, { ok: true, markdown: md })
  }
  if (method === 'GET' && p === '/api/assets') return sendJson(res, 200, { ok: true, devices: await devicesEnriched(), manuals: kb.listManuals(), accounts: maskedAccounts() })
  if (method === 'POST' && p === '/api/asset') {
    const b = await readBody(req)
    const kind = String(b.kind || '')
    if (kind === 'device') return sendJson(res, 200, { ok: true, saved: await kb.upsertDeviceInfo({ ip: b.ip, mac: b.mac, name: b.name, type: b.type, upstream: b.upstream, notes: b.notes, band: b.band }) })
    if (kind === 'manual') return sendJson(res, 200, { ok: true, saved: await kb.upsertManual({ id: b.id, brand: b.brand, model: b.model, url: b.url, notes: b.notes }) })
    if (kind === 'account') return sendJson(res, 200, { ok: true, saved: (await kb.upsertAccount({ id: b.id, device: b.device, ip: b.ip, username: b.username, password: b.password, notes: b.notes })) && maskedAccounts().slice(-1)[0] })
    return sendJson(res, 400, { ok: false, reason: 'kind must be device|manual|account' })
  }
  if (method === 'GET' && p === '/api/events') return sendJson(res, 200, { ok: true, events: mem.events.slice(-50) })
  if (method === 'GET' && p === '/api/health') {
    const devices = await devicesEnriched()
    return sendJson(res, 200, { ok: true, health: reportHealth(devices) })
  }
  return sendJson(res, 404, { ok: false, reason: 'not found', path: p })
}

const server = http.createServer((req, res) => {
  routes(req, res).catch((e) => sendJson(res, 500, { ok: false, error: String(e && e.message || e) }))
})

// ---------------- 5 分钟 patrol ----------------
async function patrol() {
  try {
    const devices = await devicesEnriched()
    const gw = gatewayOf(devices)
    if (gw && !mem.gateway) mem.gateway = { ip: gw.ip, mac: gw.mac }
    const targets = [gw && gw.ip, ...devices.slice(0, 40).map((d) => d.ip)].filter(Boolean)
    let online = 0
    let gatewayOk = true
    for (const ip of targets) {
      const ok = await execPing(ip)
      if (ip === (gw && gw.ip)) { gatewayOk = ok; if (ok) online += 1; else pushEvent({ level: 'P1', kind: 'core_down', target: ip, detail: 'gateway unreachable during patrol' }) }
      else if (ok) online += 1
    }
    mem.patrol = { at: new Date().toISOString(), total: targets.length, online, gatewayOk, gateway: gw ? gw.ip : null }
    console.log(`[probe-server] patrol: ${online}/${targets.length} online gateway=${gatewayOk}`)
  } catch (e) {
    console.error('[probe-server] patrol error:', String(e))
  }
}
setInterval(patrol, 5 * 60 * 1000).unref()

server.listen(PORT, HOST, () => {
  console.log(`[probe-server] AegisNet 独立后端已启动 http://${HOST}:${PORT}`)
  console.log(`[probe-server] 数据目录: ${DATA_DIR}`)
  patrol()
})
