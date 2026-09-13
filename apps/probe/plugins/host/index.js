/**
 * DSH 探针 · Host 半（v2 运维内核 · JSON 守卫修复 + node 子进程持久化）—— canonical source
 * 工具：probe_ping / arp_discovery / scan_subnet / port_scan / snmp_query / inspect_rtsp / topology_build / topology_describe / link_quality / asset_update / assets_list / health_report / diagnostic_report / probe_status
 * RPC：probe.snapshot / probe.toggle / probe.report
 * 知识库：probe/data/{overrides,manuals,accounts}.json（经 node -e 子进程读写，规避 fs 服务路径语义差异）
 */

const OUI_SUBSET = {
  'F8:D0:0E': 'Vantiva (Xfinity)', 'E0:D3:62': 'TP-Link', '3C:6A:D2': 'TP-Link',
  '98:25:4A': 'TP-Link', 'F0:09:0D': 'TP-Link', '60:83:E7': 'TP-Link',
  '24:2F:D0': 'TP-Link', 'F0:A7:31': 'TP-Link', '20:23:51': 'TP-Link',
  'B8:06:0D': 'Tuya Smart', '08:54:11': 'Hikvision', '60:E3:2B': 'Intel',
  'A4:6B:B6': 'Intel', '18:C0:09': 'New H3C', 'B8:2C:A0': 'Resideo (Honeywell)',
  'A0:48:1C': 'Hewlett Packard', 'CC:5E:F8': 'MediaTek',
}
const normMac = (mac) => String(mac || '').trim().toUpperCase().replace(/-/g, ':')
const ouiOf = (mac) => { const p = normMac(mac).split(':'); return p.length >= 3 ? p.slice(0, 3).join(':') : null }
const vendorOf = (mac) => { const o = ouiOf(mac); return (o && OUI_SUBSET[o]) || 'Unknown' }
const isRandomMac = (mac) => { const f = parseInt(normMac(mac).split(':')[0], 16); return !Number.isNaN(f) && (f & 0x02) !== 0 }
const parseArp = (text) => {
  const rows = []
  const seen = new Map()
  for (const line of String(text || '').split(/\r?\n/)) {
    const ipMatch = line.match(/(\d{1,3}(?:\.\d{1,3}){3})/)
    if (!ipMatch) continue
    const ip = ipMatch[1]
    const macMatch = line.match(/([0-9a-fA-F]{2}([:-])[0-9a-fA-F]{2}(?:\2[0-9a-fA-F]{2}){4})/)
    if (!macMatch) continue
    const mac = macMatch[1].toLowerCase()
    const norm = normMac(mac)
    if (ip.endsWith('.255') || norm === 'FF:FF:FF:FF:FF:FF' || norm.startsWith('01:00:5E')) continue
    const row = { ip, mac, vendor: vendorOf(mac), randomMac: isRandomMac(mac) }
    if (!seen.has(ip) || (seen.get(ip).randomMac && !row.randomMac)) seen.set(ip, row)
  }
  return [...seen.values()]
}
const extractRtt = (out) => { const m = /time[=<](\d+(?:\.\d+)?)\s*ms/.exec(out || ''); return m ? Number(m[1]) : null }
const parseWalkLine = (line) => { const m = String(line || '').match(/^([\w.:-]+)\s*=\s*([\w-]+(?:\(\d+\))?):\s*(.*)$/); return m ? { oid: m[1], type: m[2], value: m[3].trim() } : null }
const buildRtspCandidates = (host, port) => { const base = `rtsp://${host}:${port}`; return [`${base}/`, `${base}/stream1`, `${base}/stream2`, `${base}/live/ch0`, `${base}/live/ch1`, `${base}/h264/ch1/main/av_stream`, `${base}/streaming/channels/101`, `${base}/onvif1`] }
const inferType = (d) => {
  if (!d) return 'unknown'
  const v = String(d.vendor || '').toLowerCase()
  if (v.includes('vantiva') || v.includes('xfinity')) return 'router'
  if (v.includes('hikvision')) return 'camera'
  if (v.includes('resideo') || v.includes('honeywell')) return 'thermostat'
  if (v.includes('tuya')) return 'smart_plug'
  if (v.includes('h3c')) return 'network_device'
  if (v.includes('hewlett') || v.includes('hp ')) return 'printer'
  if (v.includes('intel') || v.includes('mediatek')) return 'computer'
  if (v.includes('tp-link')) return 'tplink_device'
  if (d.randomMac) return 'phone_or_laptop'
  return 'unknown'
}
const computeHealth = ({ devices = [], events = [], blackFrames = 0, portErrorPorts = [] }) => {
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
  const infrastructure = Math.round(100 * (1 - Math.min(0.3, p1 * 0.15 + p2 * 0.05)))
  const overall = Math.round(0.4 * network + 0.4 * security + 0.2 * infrastructure)
  const issues = []
  if (p1) issues.push(`P1 核心设备故障 ×${p1}`)
  if (p2) issues.push(`P2 设备掉线/自愈 ×${p2}`)
  if (portErrorPorts.length) issues.push(`端口错误率超标：${portErrorPorts.join(', ')}`)
  if (blackFrames) issues.push(`黑屏/异常画面摄像头 ×${blackFrames}`)
  return { overall, network, security, infrastructure, onlineRatio, camRatio, issues }
}
const renderDiagnostic = ({ site = '探针站点', devices = [], events = [], health }) => {
  const lines = [
    `# 《${site} IT/安防健康诊断报告》`,
    `生成时间：${new Date().toISOString()}`,
    '',
    '## 1. 执行摘要',
    `- 整体健康分：**${health.overall} / 100**（网络 ${health.network} / 安防 ${health.security} / 基础设施 ${health.infrastructure}）`,
    `- 发现设备：${devices.length} 台`,
    `- 隐患：${health.issues.length ? health.issues.join('；') : '无'}`,
    '',
    '## 2. 资产清单',
    '| IP | MAC | 厂商 | 类型 | 随机MAC |',
    '| --- | --- | --- | --- | --- |',
    ...devices.slice(0, 200).map((d) => `| ${d.ip || '-'} | ${d.mac || '-'} | ${d.vendor || '-'} | ${d.type || '-'} | ${d.randomMac ? '是' : '否'} |`),
    '',
    '## 3. 事件统计',
    `- P1: ${events.filter((e) => e.level === 'P1').length} · P2: ${events.filter((e) => e.level === 'P2').length} · P3: ${events.filter((e) => e.level === 'P3').length} · P4: ${events.filter((e) => e.level === 'P4').length}`,
    '',
    '## 4. 隐患清单（按优先级）',
    ...(health.issues.length ? health.issues.map((i, n) => `${n + 1}. ${i}`) : ['- 无']),
    '',
    '## 5. 升级建议（CapEx 参考）',
    '- 由隐患清单导出：Wi-Fi 覆盖补盲 / CCTV 增装 / 机房理线（详见报价单）',
    '',
  ]
  return lines.join('\n')
}
const renderDiagnosticV2 = ({ site, devices, events, health, quality, accounts }) => {
  const base = renderDiagnostic({ site, devices, events, health })
  const q = quality
  const qBlock = q
    ? ['', '## 链路质量与薄弱环节',
        `- 网关：${q.gateway ? `${q.gateway.lossPct}% 丢包 / ${q.gateway.avg}ms / ${q.gateway.verdict}` : '未测'}`,
        `- 外网(8.8.8.8)：${q.internet ? `${q.internet.lossPct}% / ${q.internet.avg}ms / ${q.internet.verdict}` : '未测'}`,
        `- DNS(75.75.75.75)：${q.dns ? `${q.dns.lossPct}% / ${q.dns.avg}ms` : '未测'}`,
        q.weakLinks && q.weakLinks.length
          ? `- 薄弱环节 ${q.weakLinks.length} 处：` + q.weakLinks.slice(0, 5).map((w) => `${w.ip}(丢包${w.lossPct}%,${w.avg}ms,${w.verdict})`).join('；')
          : '- 薄弱环节：无',
        q.wirelessSelf ? `- 探针无线：SSID ${q.wirelessSelf.ssid} · ${q.wirelessSelf.band} · ${q.wirelessSelf.signal}` : '',
      ].join('\n')
    : ''
  const acctBlock = accounts && accounts.length
    ? ['', '## 配置记录（登录入口，密码已脱敏）',
        '| 设备 | IP | 用户名 | 说明 |',
        '| --- | --- | --- | --- |',
        ...accounts.map((a) => `| ${a.device || '-'} | ${a.ip || '-'} | ${a.username || '-'} | ${a.notes || ''} |`),
      ].join('\n')
    : ''
  return base + qBlock + acctBlock
}

return {
  name: 'probe-host',
  inject: ['tools', 'timer'],
  apply(ctx) {
    const state = {
      startedAt: new Date().toISOString(), ticks: 0, lastTick: null, lastPing: null, lastArp: null,
      lastScan: null, lastSnmp: null, lastRtsp: null, lastTopology: null, lastReport: null,
      lastQuality: null, patrol: null, gateway: null, devices: 0, events: [], ui: { open: false },
    }
    const subprocess = ctx.get('subprocess')
    const clean = (o) => { try { return JSON.parse(JSON.stringify(o)) } catch { return null } }
    const pushEvent = (e) => { state.events.push({ ts: new Date().toISOString(), ...e }); if (state.events.length > 100) state.events.splice(0, state.events.length - 100) }

    async function isWindows() {
      if (!subprocess) return false
      try { await subprocess.resolveExecutable('cmd.exe'); return true } catch { return false }
    }
    function collect(argv, maxBytes = 65536, graceMs = 8000) {
      const handle = subprocess.spawn({ argv, cwd: '/', stdio: { stdin: 'ignore', stdout: { maxBytes, spill: { maxBytes: maxBytes * 4 } }, stderr: { maxBytes: 8192 } }, graceMs })
      return handle.done.then((outcome) => ({ exitCode: outcome.exitCode, stdout: handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : '', stderr: handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : '' }))
    }
    async function pingHost(ip) {
      const win = await isWindows()
      const argv = win ? ['ping', '-n', '1', '-w', '500', ip] : ['ping', '-c', '1', '-W', '1', ip]
      try { const r = await collect(argv, 512, 4000); return r.exitCode === 0 } catch { return false }
    }
    const PROBE_SCRIPT =
      "const n=require('net');const s=new n.Socket();const t=setTimeout(()=>{s.destroy();process.exit(1)},1200);s.setTimeout(1200);s.once('connect',()=>{clearTimeout(t);s.destroy();process.exit(0)});s.once('error',()=>{clearTimeout(t);process.exit(1)});s.once('timeout',()=>{clearTimeout(t);process.exit(1)});s.connect(Number(process.argv[2]),process.argv[1])"
    async function tcpOpen(host, port) {
      try { const r = await collect(['node', '-e', PROBE_SCRIPT, String(host), String(port)], 256, 4000); return r.exitCode === 0 } catch { return false }
    }
    async function runArp() {
      const win = await isWindows()
      const r = await collect(win ? ['arp', '-a'] : ['ip', 'neigh'], 262144, 8000)
      return r.stdout
    }

    // ---------- v2：知识库（node -e 子进程持久化，规避 fs 服务路径语义差异）----------
    const KB_DIR = 'C:\\project\\networking\\probe\\data'
    const kbMemory = { overrides: [], manuals: [], accounts: [] }
    const kv = {
      async read(name, fallback) {
        try {
          const r = await collect(['node', '-e', "try{process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))}catch(e){process.exit(1)}", `${KB_DIR}\\${name}.json`], 65536, 8000)
          if (r.exitCode !== 0 || !r.stdout) return fallback
          return JSON.parse(r.stdout)
        } catch { return fallback }
      },
      async write(name, data) {
        try {
          await collect(['node', '-e', "require('fs').writeFileSync(process.argv[1], process.argv[2])", `${KB_DIR}\\${name}.json`, JSON.stringify(data, null, 2)], 256, 8000)
        } catch (e) { console.error('[probe] kb write failed:', String(e)) }
      },
    }
    ;(async () => {
      kbMemory.overrides = await kv.read('overrides', kbMemory.overrides)
      kbMemory.manuals = await kv.read('manuals', kbMemory.manuals)
      kbMemory.accounts = await kv.read('accounts', kbMemory.accounts)
    })().catch(() => {})
    const kbKey = (ipOrMac) => String(ipOrMac || '').toLowerCase()
    const kbUpsertDevice = async (entry) => {
      const e = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined))
      const list = kbMemory.overrides
      const key = kbKey(e.ip || e.mac)
      const idx = list.findIndex((o) => kbKey(o.ip || o.mac) === key)
      const merged = idx >= 0 ? { ...list[idx], ...e, ip: e.ip || list[idx].ip, mac: e.mac || list[idx].mac } : e
      if (idx >= 0) list[idx] = merged; else list.push(merged)
      await kv.write('overrides', list)
      return merged
    }
    const kbApply = (devices) => devices.map((d) => {
      const o = kbMemory.overrides.find((x) => kbKey(x.ip || x.mac) === kbKey(d.ip || d.mac))
      if (!o) return d
      return {
        ip: d.ip, mac: d.mac || null, vendor: d.vendor || 'Unknown', randomMac: !!d.randomMac,
        name: o.name || null, type: o.type || d.type || 'unknown', notes: o.notes || null,
        upstream: o.upstream || null, band: o.band || null, manualRef: o.manualRef || null,
      }
    })
    const enrich = (devices) => kbApply(devices).map((d) => ({ ...d, type: d.type || inferType(d) }))

    // ---------- v2：链路质量 ----------
    const pingOnceQ = async (ip) => {
      const win = await isWindows()
      const argv = win ? ['ping', '-n', '1', '-w', '500', ip] : ['ping', '-c', '1', '-W', '1', ip]
      try {
        const r = await collect(argv, 1024, 4000)
        if (r.exitCode !== 0) return { ok: false }
        const ttlM = r.stdout.match(/TTL=(\d+)/i)
        const timeM = r.stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i)
        return { ok: true, rttMs: timeM ? Number(timeM[1]) : null, ttl: ttlM ? Number(ttlM[1]) : null }
      } catch { return { ok: false } }
    }
    const measureQ = async (ip, count) => {
      const rtts = []
      let ttlSum = 0, ttlN = 0
      for (let i = 0; i < count; i++) {
        const r = await pingOnceQ(ip)
        if (r.ok) {
          if (r.rttMs != null) rtts.push(r.rttMs)
          if (r.ttl != null) { ttlSum += r.ttl; ttlN += 1 }
        }
      }
      const lossPct = count ? Math.round(((count - rtts.length) / count) * 100) : 100
      const avg = rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null
      const min = rtts.length ? Math.min(...rtts) : null
      const max = rtts.length ? Math.max(...rtts) : null
      const jitter = rtts.length > 1 ? Math.round(Math.sqrt(rtts.reduce((s, v) => s + (v - avg) * (v - avg), 0) / rtts.length) * 100) / 100 : 0
      const avgTtl = ttlN ? ttlSum / ttlN : null
      const hops = avgTtl == null ? null : Math.max(0, (avgTtl <= 64 ? 64 : 128) - avgTtl)
      const verdict = lossPct > 5 ? 'poor' : avg != null && avg > 150 ? 'slow' : jitter > 20 ? 'unstable' : 'good'
      return { ip, count, lossPct, avg: avg == null ? null : Math.round(avg * 10) / 10, min, max, jitter, avgTtl: avgTtl == null ? null : Math.round(avgTtl * 10) / 10, hops, verdict, weak: verdict !== 'good' }
    }
    const wirelessSelfQ = async () => {
      if (!(await isWindows())) return null
      try {
        const r = await collect(['netsh', 'wlan', 'show', 'interfaces'], 8192, 5000)
        const t = r.stdout
        if (!/SSID\s*:/.test(t)) return null
        const g = (k) => { const m = t.match(new RegExp(`\\s*${k}\\s*:\\s*(.+)`)); return m ? m[1].trim() : null }
        return { ssid: g('SSID'), band: g('Band'), channel: g('Channel'), signal: g('Signal'), rssi: g('Rssi'), rate: g('Receive rate'), auth: g('Authentication') }
      } catch { return null }
    }

    const defineProbeTool = (def) => {
      harness.registerTool(ctx, harness.defineTool({
        name: def.name,
        description: def.description,
        parameters: def.parameters || {},
        output: { schema: { type: 'object', additionalProperties: true }, render(_args, value) { return [{ type: 'text', text: JSON.stringify(value, null, 2) }] } },
        async execute(args) { return def.execute(args) },
      }))
    }

    defineProbeTool({
      name: 'probe_ping',
      description: 'Probe a host with ICMP ping and return reachability, RTT and raw output.',
      parameters: { target: { type: 'string', required: true } },
      async execute(args) {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const target = String(args.target)
        const win = await isWindows()
        const argv = win ? ['ping', '-n', '1', '-w', '500', target] : ['ping', '-c', '1', '-W', '1', target]
        const r = await collect(argv, 8192, 5000)
        const reachable = r.exitCode === 0
        const result = { ok: true, tool: 'probe_ping', target, reachable, exitCode: r.exitCode, rttMs: extractRtt(r.stdout), platform: win ? 'windows' : 'posix', stdout: r.stdout.slice(0, 300), stderr: r.stderr.slice(0, 200) }
        state.lastPing = { at: new Date().toISOString(), target, reachable, rttMs: result.rttMs }
        return result
      },
    })

    defineProbeTool({
      name: 'arp_discovery',
      description: 'Parse the local ARP table into a device inventory with vendor and random-MAC flags.',
      parameters: {},
      async execute() {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const devices = parseArp(await runArp())
        state.lastArp = { at: new Date().toISOString(), count: devices.length }
        state.devices = devices.length
        return { ok: true, tool: 'arp_discovery', platform: (await isWindows()) ? 'windows' : 'posix', count: devices.length, devices }
      },
    })

    defineProbeTool({
      name: 'scan_subnet',
      description: 'Ping-sweep a /24 subnet, then parse the ARP table into a device inventory.',
      parameters: { subnet: { type: 'string', required: true } },
      async execute(args) {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const input = String(args.subnet || '')
        let prefix, lo, hi
        if (/^\d{1,3}(\.\d{1,3}){2}$/.test(input)) { prefix = input; lo = 1; hi = 254 }
        else if (/^(\d{1,3}(?:\.\d{1,3}){2})\.\d{1,3}\/\d+$/.test(input)) { prefix = input.split('/')[0].split('.').slice(0, 3).join('.'); lo = 1; hi = 254 }
        else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(input)) { const p = input.split('.'); prefix = p.slice(0, 3).join('.'); lo = hi = Number(p[3]) }
        else return { ok: false, reason: 'unsupported subnet format' }
        const live = []
        let cursor = lo
        const workers = Array.from({ length: Math.min(40, hi - lo + 1) }, async () => {
          while (cursor <= hi) {
            const ip = `${prefix}.${cursor++}`
            if (await pingHost(ip)) live.push(ip)
          }
        })
        await Promise.all(workers)
        live.sort((a, b) => Number(a.split('.')[3]) - Number(b.split('.')[3]))
        const devices = parseArp(await runArp())
        const gw = devices.find((d) => inferType(d) === 'router') || null
        if (gw && !state.gateway) state.gateway = { ip: gw.ip, mac: gw.mac }
        state.lastScan = { at: new Date().toISOString(), liveCount: live.length, arpCount: devices.length }
        state.devices = devices.length
        return { ok: true, tool: 'scan_subnet', subnet: `${prefix}.0/24`, liveCount: live.length, live, arpDevices: devices.length, gateway: gw ? gw.ip : null, devices }
      },
    })

    defineProbeTool({
      name: 'port_scan',
      description: 'TCP port scan on a host (default 554,80,443,8080,22) with bounded concurrency.',
      parameters: { host: { type: 'string', required: true }, ports: { type: 'string' } },
      async execute(args) {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const host = String(args.host)
        const ports = (args.ports ? String(args.ports).split(',') : ['554', '80', '443', '8080', '22'])
          .map((p) => Number(String(p).trim())).filter((p) => p > 0 && p < 65536)
        const results = {}
        let cursor = 0
        const workers = Array.from({ length: Math.min(6, ports.length) }, async () => {
          while (cursor < ports.length) {
            const p = ports[cursor++]
            results[p] = await tcpOpen(host, p)
          }
        })
        await Promise.all(workers)
        return { ok: true, tool: 'port_scan', host, results, openPorts: ports.filter((p) => results[p]) }
      },
    })

    defineProbeTool({
      name: 'snmp_query',
      description: 'SNMP v2c walk via snmpwalk CLI (requires net-snmp; install on the probe).',
      parameters: { host: { type: 'string', required: true }, community: { type: 'string' }, oid: { type: 'string' } },
      async execute(args) {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        let snmpwalk
        try { snmpwalk = await subprocess.resolveExecutable('snmpwalk') } catch {
          return { ok: false, reason: 'snmpwalk not found', hint: 'install net-snmp on the probe (apt install snmp)' }
        }
        const host = String(args.host)
        const community = args.community ? String(args.community) : 'public'
        const oid = args.oid ? String(args.oid) : '1.3.6.1.2.1.1'
        const r = await collect([snmpwalk, '-v2c', '-c', community, '-On', '-t', '2', '-r', '1', host, oid], 262144, 15000)
        const entries = r.stdout.split(/\r?\n/).map(parseWalkLine).filter(Boolean)
        state.lastSnmp = { at: new Date().toISOString(), host, count: entries.length }
        return { ok: r.exitCode === 0, tool: 'snmp_query', host, community, oid, exitCode: r.exitCode, count: entries.length, entries: entries.slice(0, 200), stderr: r.stderr.slice(0, 300) }
      },
    })

    defineProbeTool({
      name: 'inspect_rtsp',
      description: 'Probe an RTSP camera stream with ffprobe (requires ffmpeg; install on the probe).',
      parameters: { host: { type: 'string', required: true }, port: { type: 'number' }, path: { type: 'string' } },
      async execute(args) {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        let ffprobe
        try { ffprobe = await subprocess.resolveExecutable('ffprobe') } catch {
          return { ok: false, reason: 'ffprobe not found', hint: 'install ffmpeg on the probe (apt install ffmpeg)' }
        }
        const host = String(args.host)
        const port = args.port ? Number(args.port) : 554
        const paths = args.path ? [String(args.path)] : buildRtspCandidates(host, port)
        for (const p of paths) {
          const url = `rtsp://${host}:${port}${p}`
          try {
            const r = await collect([ffprobe, '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', '-rtsp_transport', 'tcp', url], 65536, 8000)
            if (r.exitCode !== 0) continue
            let data
            try { data = JSON.parse(r.stdout) } catch { continue }
            const streams = Array.isArray(data.streams) ? data.streams : []
            const video = streams.find((s) => s.codec_type === 'video') || null
            if (!video) continue
            state.lastRtsp = { at: new Date().toISOString(), host, url, ok: true }
            return { ok: true, tool: 'inspect_rtsp', url, status: 'online', video: { codec: video.codec_name, width: video.width, height: video.height, avgFrameRate: video.avg_frame_rate, bitRate: video.bit_rate }, streamCount: streams.length }
          } catch { /* next path */ }
        }
        state.lastRtsp = { at: new Date().toISOString(), host, ok: false }
        return { ok: false, tool: 'inspect_rtsp', host, reason: 'no reachable RTSP stream on common paths', tried: paths.slice(0, 8) }
      },
    })

    defineProbeTool({
      name: 'topology_build',
      description: 'Build the network topology graph from the ARP table (LLDP/CAM upgrade confidence with SNMP on the Pi).',
      parameters: {},
      async execute() {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const devices = parseArp(await runArp())
        const gw = devices.find((d) => inferType(d) === 'router') || null
        if (gw && !state.gateway) state.gateway = { ip: gw.ip, mac: gw.mac }
        const nodes = devices.map((d) => ({ id: d.mac || d.ip, ip: d.ip, mac: d.mac, vendor: d.vendor, type: inferType(d), randomMac: d.randomMac, confidence: 'medium', sources: ['arp'] }))
        const links = []
        for (const node of nodes) {
          if (gw && node.id === (gw.mac || gw.ip)) continue
          links.push({ source: gw ? (gw.mac || gw.ip) : 'gateway', target: node.id, via: 'arp', confidence: 'medium' })
        }
        state.lastTopology = { at: new Date().toISOString(), nodes: nodes.length, links: links.length }
        state.devices = nodes.length
        return { ok: true, tool: 'topology_build', gateway: gw ? { ip: gw.ip, mac: gw.mac } : null, nodes, links, sources: { lldp: 0, cam: 0, arp: nodes.length }, note: 'LLDP/CAM 需 Pi + 交换机 SNMP 凭据' }
      },
    })

    defineProbeTool({
      name: 'topology_describe',
      description: 'Describe the network topology in natural language, merging conversational corrections (overrides) and the latest quality weak-link hints.',
      parameters: {},
      async execute() {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const devices = enrich(parseArp(await runArp()))
        const gw = devices.find((d) => d.type === 'router') || null
        const lines = []
        lines.push(`站点共发现 ${devices.length} 台设备。`)
        lines.push(`- 网关/主路由：${gw ? `${gw.ip}（${gw.name || gw.vendor}）` : '未识别'}`)
        lines.push('设备挂载：')
        for (const d of devices) {
          if (gw && (d.ip === gw.ip || d.mac === gw.mac)) continue
          const up = d.upstream || (gw ? gw.ip : '未知')
          lines.push(`  - ${d.name || d.ip} [${d.type}] 上游 ${up}${d.band ? ` · ${d.band}` : ''}${d.notes ? ` · ${d.notes}` : ''}`)
        }
        const q = state.lastQuality
        if (q && q.weakLinks && q.weakLinks.length) {
          lines.push('薄弱环节（最近质量评估）：')
          q.weakLinks.slice(0, 5).forEach((w) => lines.push(`  - ${w.ip}（${w.vendor}/${w.type}）丢包 ${w.lossPct}% · 平均 ${w.avg}ms · 判定 ${w.verdict}`))
        }
        return { ok: true, tool: 'topology_describe', nodeCount: devices.length, overridesApplied: kbMemory.overrides.length, markdown: lines.join('\n') }
      },
    })

    defineProbeTool({
      name: 'link_quality',
      description: "Per-device link quality: packet loss / RTT / jitter / hop hints (wired via TTL), plus gateway, internet and DNS quality and the probe's own wireless info. Finds weak links.",
      parameters: { target: { type: 'string' }, count: { type: 'number' } },
      async execute(args) {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const count = Math.min(Math.max(args.count ? Number(args.count) : 3, 1), 10)
        if (args.target) {
          const m = await measureQ(String(args.target), count)
          return { ok: true, tool: 'link_quality', target: m.ip, measurement: m }
        }
        const devices = parseArp(await runArp())
        const gw = devices.find((d) => inferType(d) === 'router') || null
        const deviceResults = []
        for (const d of devices.slice(0, 40)) {
          const m = await measureQ(d.ip, count)
          deviceResults.push({ ip: d.ip, mac: d.mac, vendor: d.vendor, type: inferType(d), ...m })
        }
        const gateway = gw ? await measureQ(gw.ip, count) : null
        const internet = await measureQ('8.8.8.8', count)
        const dns = await measureQ('75.75.75.75', count)
        const wirelessSelf = await wirelessSelfQ()
        const weakLinks = deviceResults.filter((d) => d.weak).sort((a, b) => b.lossPct - a.lossPct || (b.avg || 0) - (a.avg || 0))
        state.lastQuality = {
          at: new Date().toISOString(),
          deviceCount: deviceResults.length,
          weakCount: weakLinks.length,
          online: deviceResults.filter((d) => d.lossPct < 100).length,
          gateway, internet, dns,
          weakLinks: weakLinks.map((w) => ({ ip: w.ip, vendor: w.vendor, type: w.type, lossPct: w.lossPct, avg: w.avg, jitter: w.jitter, hops: w.hops, verdict: w.verdict })),
        }
        return clean({
          ok: true, tool: 'link_quality', count, devices: deviceResults, gateway, internet, dns, wirelessSelf, weakLinks,
          summary: { deviceCount: deviceResults.length, weakCount: weakLinks.length, online: state.lastQuality.online, gatewayVerdict: gateway ? gateway.verdict : null, internetVerdict: internet ? internet.verdict : null },
        })
      },
    })

    defineProbeTool({
      name: 'asset_update',
      description: 'Persist user-supplied knowledge: device name/type/upstream/notes, brand manuals, or login records (accounts). Supports conversational topology adjustment.',
      parameters: {
        kind: { type: 'string', required: true },
        ip: { type: 'string' }, mac: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' },
        upstream: { type: 'string' }, notes: { type: 'string' }, band: { type: 'string' },
        brand: { type: 'string' }, model: { type: 'string' }, url: { type: 'string' },
        device: { type: 'string' }, username: { type: 'string' }, password: { type: 'string' },
      },
      async execute(args) {
        const kind = String(args.kind)
        if (kind === 'device') {
          const saved = await kbUpsertDevice({ ip: args.ip, mac: args.mac, name: args.name, type: args.type, upstream: args.upstream, notes: args.notes, band: args.band })
          return clean({ ok: true, tool: 'asset_update', kind, saved, note: '设备信息已持久化（拓扑与报告将引用）' })
        }
        if (kind === 'manual') {
          const entry = { id: args.id || `m${Date.now()}`, brand: args.brand, model: args.model, url: args.url, notes: args.notes }
          kbMemory.manuals.push(entry)
          await kv.write('manuals', kbMemory.manuals)
          return clean({ ok: true, tool: 'asset_update', kind, saved: entry })
        }
        if (kind === 'account') {
          const entry = { id: args.id || `${args.ip || args.device}-${Date.now()}`, device: args.device, ip: args.ip, username: args.username, password: args.password, notes: args.notes }
          kbMemory.accounts.push(entry)
          await kv.write('accounts', kbMemory.accounts)
          return clean({ ok: true, tool: 'asset_update', kind, saved: { ...entry, password: entry.password ? '••••' : '' }, note: '登录记录已保存（报告输出自动脱敏）' })
        }
        return { ok: false, reason: 'kind must be device|manual|account' }
      },
    })

    defineProbeTool({
      name: 'assets_list',
      description: 'List the knowledge base: devices merged with manual overrides, brand manuals, and masked login records.',
      parameters: {},
      async execute() {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const devices = enrich(parseArp(await runArp())).map((d) => ({ ip: d.ip, mac: d.mac, vendor: d.vendor, type: d.type, name: d.name || null, upstream: d.upstream || null, band: d.band || null, notes: d.notes || null, manualRef: d.manualRef || null }))
        const manuals = kbMemory.manuals
        const accounts = kbMemory.accounts.map((a) => ({ ...a, password: a.password ? '••••' : '' }))
        return clean({ ok: true, tool: 'assets_list', deviceCount: devices.length, devices, manuals, accounts })
      },
    })

    defineProbeTool({
      name: 'health_report',
      description: 'Compute network health scores and render the daily report in Markdown.',
      parameters: {},
      async execute() {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const devices = parseArp(await runArp()).map((d) => ({ ...d, type: inferType(d), status: 'online' }))
        const health = computeHealth({ devices, events: state.events })
        const q = state.lastQuality
        const date = new Date().toISOString().slice(0, 10)
        const markdown = [
          `【AegisNet 运行健康日报】${date}`,
          '────────────────────────────',
          `整体健康分：${health.overall} / 100`,
          `网络：在线 ${Math.round(health.onlineRatio * 100)}% · 健康 ${health.network}`,
          `安防：摄像头在线 ${Math.round(health.camRatio * 100)}% · 健康 ${health.security}`,
          `基础设施：${health.infrastructure}`,
          `资产数：${devices.length} · 今日事件：${state.events.length}`,
          q ? `链路质量：薄弱 ${q.weakCount} 处 · 网关 ${q.gateway ? q.gateway.verdict : '未测'} · 外网 ${q.internet ? q.internet.verdict : '未测'}` : '链路质量：尚未评估（运行 link_quality）',
          health.issues.length ? `隐患：${health.issues.join('；')}` : '隐患：无',
          'AI 小贴士：全网运行平稳。',
          '────────────────────────────',
          '如需人工上门排查，回复本邮件或致电 713-XXX-XXXX',
        ].join('\n')
        state.lastReport = { at: new Date().toISOString(), overall: health.overall }
        return { ok: true, tool: 'health_report', health, deviceCount: devices.length, eventCount: state.events.length, markdown }
      },
    })

    defineProbeTool({
      name: 'diagnostic_report',
      description: 'Generate the 14-day IT/security diagnostic report (《IT/安防健康诊断报告》) including link quality and masked config records.',
      parameters: { site: { type: 'string' } },
      async execute(args) {
        if (!subprocess) return { ok: false, reason: 'subprocess service unavailable' }
        const devices = enrich(parseArp(await runArp()))
        const health = computeHealth({ devices: devices.map((d) => ({ ...d, status: 'online' })), events: state.events })
        const site = args.site ? String(args.site) : '探针站点'
        const accounts = kbMemory.accounts.map((a) => ({ ...a, password: a.password ? '••••' : '' }))
        const markdown = renderDiagnosticV2({ site, devices, events: state.events, health, quality: state.lastQuality, accounts })
        return { ok: true, tool: 'diagnostic_report', site, generatedAt: new Date().toISOString(), health, deviceCount: devices.length, weakCount: state.lastQuality ? state.lastQuality.weakCount : 0, markdown }
      },
    })

    defineProbeTool({
      name: 'probe_status',
      description: 'Read the DSH network probe runtime status.',
      parameters: {},
      async execute() {
        return clean({
          ok: true, tool: 'probe_status', state: {
            startedAt: state.startedAt, ticks: state.ticks, lastTick: state.lastTick,
            patrol: state.patrol, gateway: state.gateway, devices: state.devices,
            lastPing: state.lastPing, lastArp: state.lastArp, lastScan: state.lastScan,
            lastSnmp: state.lastSnmp, lastRtsp: state.lastRtsp,
            lastTopology: state.lastTopology, lastReport: state.lastReport,
            lastQuality: state.lastQuality ? { at: state.lastQuality.at, weakCount: state.lastQuality.weakCount, online: state.lastQuality.online, gateway: state.lastQuality.gateway, internet: state.lastQuality.internet } : null,
            kb: { overrides: kbMemory.overrides.length, manuals: kbMemory.manuals.length, accounts: kbMemory.accounts.length },
            events: state.events.slice(-10),
          },
        })
      },
    })

    // ---------- RPC ----------
    const snapshot = async () => {
      let devices = []
      try { devices = enrich(parseArp(await runArp())) } catch { devices = [] }
      const health = computeHealth({ devices: devices.map((d) => ({ ...d, status: 'online' })), events: state.events })
      return clean({
        ui: { open: !!state.ui.open },
        startedAt: state.startedAt,
        ticks: state.ticks,
        patrol: state.patrol,
        gateway: state.gateway,
        health,
        deviceCount: devices.length,
        events: state.events.slice(-8),
        devices: devices.slice(0, 60).map((d) => ({ ip: d.ip, mac: d.mac, vendor: d.vendor, type: d.type, name: d.name || null, randomMac: d.randomMac })),
      })
    }
    ctx.effect(() => harness.handle('probe.snapshot', async () => snapshot()))
    ctx.effect(() => harness.handle('probe.toggle', async () => { state.ui.open = !state.ui.open; return { open: state.ui.open } }))
    ctx.effect(() =>
      harness.handle('probe.report', async () => {
        let devices = []
        try { devices = enrich(parseArp(await runArp())) } catch { devices = [] }
        const health = computeHealth({ devices: devices.map((d) => ({ ...d, status: 'online' })), events: state.events })
        const q = state.lastQuality
        const daily = [
          `【AegisNet 运行健康日报】${new Date().toISOString().slice(0, 10)}`,
          '────────────────────────────',
          `整体健康分：${health.overall} / 100`,
          `网络：在线 ${Math.round(health.onlineRatio * 100)}% · 健康 ${health.network}`,
          `安防：摄像头在线 ${Math.round(health.camRatio * 100)}% · 健康 ${health.security}`,
          `基础设施：${health.infrastructure}`,
          `资产数：${devices.length} · 今日事件：${state.events.length}`,
          q ? `链路质量：薄弱 ${q.weakCount} 处 · 网关 ${q.gateway ? q.gateway.verdict : '未测'} · 外网 ${q.internet ? q.internet.verdict : '未测'}` : '链路质量：尚未评估（运行 link_quality）',
          health.issues.length ? `隐患：${health.issues.join('；')}` : '隐患：无',
          '────────────────────────────',
          '如需人工上门排查，回复本邮件或致电 713-XXX-XXXX',
        ].join('\n')
        const accounts = kbMemory.accounts.map((a) => ({ ...a, password: a.password ? '••••' : '' }))
        const diagnostic = renderDiagnosticV2({ site: '探针站点', devices, events: state.events, health, quality: q, accounts })
        return clean({ ok: true, daily, diagnostic, generatedAt: new Date().toISOString(), health, deviceCount: devices.length })
      }),
    )

    // ---------- M6：5 分钟巡检 patrol ----------
    ctx.interval(async () => {
      state.ticks += 1
      state.lastTick = new Date().toISOString()
      try {
        const devices = parseArp(await runArp())
        const gw = devices.find((d) => inferType(d) === 'router') || null
        if (gw && !state.gateway) state.gateway = { ip: gw.ip, mac: gw.mac }
        const targets = [gw && gw.ip, ...devices.slice(0, 40).map((d) => d.ip)].filter(Boolean)
        let online = 0
        let gatewayOk = true
        for (const ip of targets) {
          if (ip === (gw && gw.ip)) {
            gatewayOk = await pingHost(ip)
            if (gatewayOk) online += 1
            else pushEvent({ level: 'P1', kind: 'core_down', target: ip, detail: 'gateway unreachable during patrol' })
          } else if (await pingHost(ip)) {
            online += 1
          }
        }
        state.patrol = { at: new Date().toISOString(), total: targets.length, online, gatewayOk, gateway: gw ? gw.ip : null }
        console.log(`[probe] patrol #${state.ticks}: ${online}/${targets.length} online gateway=${gatewayOk}`)
      } catch (e) {
        console.error('[probe] patrol error:', String(e))
      }
    }, 300000)
  },
}
