/* AegisNet 探针控制台前端（独立 Web，无构建依赖） */
'use strict'

const $ = (sel) => document.querySelector(sel)
const TYPE_COLORS = {
  router: '#38bdf8', camera: '#f43f5e', printer: '#a78bfa', computer: '#34d399',
  smart_plug: '#fbbf24', thermostat: '#fb923c', network_device: '#818cf8',
  tplink_device: '#64748b', phone_or_laptop: '#94a3b8', unknown: '#6b7280',
}
const colorOf = (v) => (v >= 80 ? '#34d399' : v >= 60 ? '#fbbf24' : '#f87171')
let state = { view: 'dash' }

async function api(path, opts) {
  const r = await fetch(path, opts)
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.ok === false) throw new Error(j.reason || j.error || `HTTP ${r.status}`)
  return j
}
function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.style.display = 'block'
  setTimeout(() => { t.style.display = 'none' }, 5000)
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }
function rowHtml(label, value, cls) { return `<div class="row"><span>${esc(label)}</span><span class="${cls || ''}">${esc(value)}</span></div>` }

// ---------- 视图渲染 ----------
function renderStatus() {
  api('/api/status').then((s) => {
    $('#statusbar').innerHTML = `探针 · ${s.deviceCount} 设备 · 健康评估薄弱 ${s.weakCount} 处 · 最近质量 ${s.lastQualityAt ? new Date(s.lastQualityAt).toLocaleTimeString() : '未评估'} · 巡检 ${s.patrol ? `${s.patrol.online}/${s.patrol.total} 在线` : '等待首轮'}`
  }).catch((e) => { $('#statusbar').innerHTML = `<span style="color:#f87171">连接异常：${esc(e.message)}</span>` })
}

async function viewDash() {
  const [s, h] = await Promise.all([api('/api/status'), api('/api/health')])
  const H = h.health
  const score = (t, v, sub) => `<div class="score"><div class="v" style="color:${colorOf(v)}">${v}</div><div class="t">${t}${sub ? ` · ${sub}` : ''}</div></div>`
  $('#main').innerHTML = `
    <div class="grid g4">
      ${score('整体健康', H.overall, '40%网络+40%安防+20%基建')}
      ${score('网络', H.network, `在线 ${Math.round(H.onlineRatio * 100)}%`)}
      ${score('安防', H.security, `CCTV ${Math.round(H.camRatio * 100)}%`)}
      ${score('基础设施', H.infrastructure, '')}
    </div>
    <div class="card" style="margin-top:14px">
      <h2>运行概况</h2>
      ${rowHtml('资产总数', s.deviceCount)}
      ${rowHtml('薄弱环节', `${s.weakCount} 处`)}
      ${rowHtml('网关', s.gateway ? s.gateway.ip : '未识别')}
      ${rowHtml('最近巡检', s.patrol ? `${new Date(s.patrol.at).toLocaleString()} · ${s.patrol.online}/${s.patrol.total} 在线 · 网关可达 ${s.patrol.gatewayOk ? '是' : '否'}` : '等待首轮')}
      ${rowHtml('运行时长', Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 60000) + ' 分钟')}
    </div>`
}

function topoSvg(topo, weakIps) {
  if (!topo || !topo.nodes || !topo.nodes.length) return '<div style="color:var(--dim);padding:24px">（无拓扑数据）</div>'
  const W = 860, H = 620, CX = W / 2, CY = H / 2
  const gw = topo.gateway
  const others = topo.nodes.filter((d) => !(gw && d.ip === gw.ip))
  const R = Math.min(W, H) * 0.36
  const nodes = []
  if (gw) nodes.push({ ...gw, x: CX, y: CY, r: 24, isGw: true })
  others.forEach((d, i) => {
    const a = (i / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2
    const rr = R * (d.upstream && d.upstream !== (gw && gw.ip) ? 1.0 : 0.92)
    nodes.push({ ...d, x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, r: 11, isGw: false })
  })
  const weak = new Set(weakIps || [])
  const lines = nodes.filter((n) => !n.isGw).map((n) => {
    const up = topo.nodes.find((x) => x.ip === n.upstream)
    const t = up || gw || nodes[0]
    return `<line x1="${t.x}" y1="${t.y}" x2="${n.x}" y2="${n.y}" stroke="rgba(148,163,184,0.35)" stroke-width="1.2"/>`
  }).join('')
  const circles = nodes.map((n) => `
    <g>
      <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${TYPE_COLORS[n.type] || '#6b7280'}"
        stroke="${weak.has(n.ip) ? '#f87171' : 'rgba(255,255,255,0.45)'}" stroke-width="${weak.has(n.ip) ? 3 : 1.5}"
        ${n.isGw ? 'filter="url(#glow)"' : ''}/>
      <text x="${n.x}" y="${n.y + n.r + 15}" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="${n.isGw ? 700 : 400}">${esc(n.name || n.ip)}</text>
      <text x="${n.x}" y="${n.y - n.r - 7}" text-anchor="middle" fill="#64748b" font-size="9">${esc(n.type)}</text>
    </g>`).join('')
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-height:540px">
    <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${lines}${circles}
  </svg>`
}

async function viewTopo() {
  const [topo, q] = await Promise.all([api('/api/topology'), api('/api/quality').catch(() => ({ quality: null }))])
  const weakIps = q.quality ? q.quality.weakLinks.map((w) => w.ip) : []
  const legend = Object.entries(TYPE_COLORS).map(([t, c]) => `<span><span class="dot" style="background:${c}"></span>${t}</span>`).join('')
  $('#main').innerHTML = `
    <div class="card">
      <h2>网络拓扑图（${topo.nodes.length} 台设备）&nbsp; <span style="color:#f87171;font-size:12px">红圈 = 薄弱环节</span></h2>
      <div class="legend">${legend}</div>
      ${topoSvg(topo, weakIps)}
    </div>
    <div class="hint">提示：拓扑基于 ARP 发现 + 人工覆盖（对话/API 可调整设备名称与上游）。</div>`
}

async function viewQuality() {
  const j = await api('/api/quality')
  const q = j.quality
  $('#main').innerHTML = q
    ? `<div class="grid g3">
        <div class="card">
          <h2>骨干链路</h2>
          ${rowHtml('网关', q.gateway ? `${q.gateway.lossPct}% / ${q.gateway.avg}ms / ${q.gateway.verdict}` : '未测', q.gateway && q.gateway.verdict === 'good' ? 'good' : 'weak')}
          ${rowHtml('外网 8.8.8.8', q.internet ? `${q.internet.lossPct}% / ${q.internet.avg}ms / ${q.internet.verdict}` : '未测', q.internet && q.internet.verdict === 'good' ? 'good' : 'weak')}
          ${rowHtml('DNS', q.dns ? `${q.dns.lossPct}% / ${q.dns.avg}ms` : '未测')}
        </div>
        <div class="card">
          <h2>探针无线</h2>
          ${q.wirelessSelf ? rowHtml('SSID', `${q.wirelessSelf.ssid} · ${q.wirelessSelf.band} · 信道 ${q.wirelessSelf.channel}`) + rowHtml('信号', `${q.wirelessSelf.signal} · RSSI ${q.wirelessSelf.rssi} · ${q.wirelessSelf.auth}`) : '<div style="color:var(--dim)">非无线接入或未取到</div>'}
        </div>
        <div class="card">
          <h2>概况</h2>
          ${rowHtml('设备/在线', `${q.deviceCount} / ${q.online}`)}
          ${rowHtml('薄弱环节', `${q.weakCount} 处`, q.weakCount ? 'weak' : 'good')}
          ${rowHtml('评估时间', new Date(q.at).toLocaleString())}
        </div>
      </div>
      <div class="card">
        <h2>薄弱环节清单</h2>
        ${q.weakLinks && q.weakLinks.length
          ? `<table><thead><tr><th>#</th><th>IP</th><th>厂商/类型</th><th>丢包</th><th>平均</th><th>抖动</th><th>跳数</th><th>判定</th></tr></thead><tbody>` +
            q.weakLinks.map((w, i) => `<tr><td>${i + 1}</td><td>${esc(w.ip)}</td><td>${esc(w.vendor)}/${esc(w.type)}</td><td class="weak">${w.lossPct}%</td><td>${w.avg}</td><td>${w.jitter}ms</td><td>${w.hops != null ? w.hops : '—'}</td><td class="weak">${esc(w.verdict)}</td></tr>`).join('') +
            `</tbody></table>`
          : '<div class="good">（无薄弱环节）</div>'}
        <div class="hint">稳定性趋势（最近评估）：${j.history && j.history.length ? j.history.map((h) => `${new Date(h.at).toLocaleTimeString()} 薄弱${h.weakCount}`).join(' → ') : '暂无'}。点右上角「质量评估」实时刷新。</div>
      </div>`
    : '<div class="card"><h2>尚未评估</h2>点右上角「质量评估」开始全网质量检测（约 10 秒）。</div>'
}

async function viewReport() {
  const site = prompt('站点名称（可回车跳过）', '探针站点')
  const [d, x] = await Promise.all([
    api(`/api/report/daily?site=${encodeURIComponent(site || '探针站点')}`),
    api(`/api/report/diagnostic?site=${encodeURIComponent(site || '探针站点')}`),
  ])
  $('#main').innerHTML = `
    <div class="card"><h2>运行健康日报</h2><pre>${esc(d.markdown)}</pre></div>
    <div class="card"><h2>IT/安防健康诊断报告（14 天）</h2><pre>${esc(x.markdown)}</pre></div>`
}

async function viewAssets() {
  const j = await api('/api/assets')
  const deviceRows = j.devices.map((d) => `<tr><td>${esc(d.ip)}</td><td>${esc(d.mac || '')}</td><td>${esc(d.vendor)}</td><td>${esc(d.type)}</td><td>${esc(d.name || '')}</td><td>${esc(d.upstream || '')}</td><td>${esc(d.notes || '')}</td></tr>`).join('')
  const manualRows = j.manuals.map((m) => `<tr><td>${esc(m.brand)}</td><td>${esc(m.model)}</td><td>${esc(m.url || '')}</td><td>${esc(m.notes || '')}</td></tr>`).join('')
  const acctRows = j.accounts.map((a) => `<tr><td>${esc(a.device || '')}</td><td>${esc(a.ip || '')}</td><td>${esc(a.username || '')}</td><td>${esc(a.password)}</td><td>${esc(a.notes || '')}</td></tr>`).join('')
  $('#main').innerHTML = `
    <div class="card"><h2>设备清单（含人工覆盖）</h2>
      <table><thead><tr><th>IP</th><th>MAC</th><th>厂商</th><th>类型</th><th>名称</th><th>上游</th><th>备注</th></tr></thead><tbody>${deviceRows}</tbody></table></div>
    <div class="card"><h2>品牌手册</h2>
      ${manualRows ? `<table><thead><tr><th>品牌</th><th>型号</th><th>手册</th><th>说明</th></tr></thead><tbody>${manualRows}</tbody></table>` : '<div style="color:var(--dim)">（暂无，可对话补充）</div>'}</div>
    <div class="card"><h2>配置记录（登录入口，密码脱敏）</h2>
      ${acctRows ? `<table><thead><tr><th>设备</th><th>IP</th><th>用户名</th><th>密码</th><th>说明</th></tr></thead><tbody>${acctRows}</tbody></table>` : '<div style="color:var(--dim)">（暂无，可对话补充）</div>'}</div>`
}

const views = { dash: viewDash, topo: viewTopo, quality: viewQuality, report: viewReport, assets: viewAssets }
async function switchView(v) {
  state.view = v
  document.querySelectorAll('#nav button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v))
  try {
    await views[v]()
  } catch (e) {
    $('#main').innerHTML = `<div class="card" style="color:#f87171">加载失败：${esc(e.message)}</div>`
  }
}

// ---------- 事件与启动 ----------
document.querySelectorAll('#nav button[data-view]').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)))
$('#btn-scan').addEventListener('click', async () => {
  $('#btn-scan').textContent = '扫描中…'
  try { await api('/api/scan', { method: 'POST' }); toast('扫描完成'); await switchView(state.view) }
  catch (e) { toast('扫描失败：' + e.message) }
  finally { $('#btn-scan').textContent = '重新扫描' }
})
$('#btn-quality').addEventListener('click', async () => {
  $('#btn-quality').textContent = '评估中…'
  try { await api('/api/quality', { method: 'POST', body: '{"count":3}', headers: { 'Content-Type': 'application/json' } }); toast('质量评估完成'); await switchView('quality') }
  catch (e) { toast('评估失败：' + e.message) }
  finally { $('#btn-quality').textContent = '质量评估' }
})
setInterval(renderStatus, 30000)
switchView('dash')
renderStatus()
