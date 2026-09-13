/**
 * DSH 探针 · Client 半（M8 透明大屏 v5 · SVG 图形化拓扑）—— canonical source
 * 视图：大屏 dash / 拓扑 topo(SVG 图) / 质量 quality / 体检报告 report
 * 拓扑图：网关居中发光节点，设备环绕，按类型着色；红圈 = 质量薄弱环节；链路连线标注
 * 数据：host.call('probe.snapshot'/'probe.toggle'/'probe.report')，快照含 topology 与 quality
 */

return {
  name: 'probe-client',
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const ui = { open: false }
    const colorOf = (v) => (v >= 80 ? '#34d399' : v >= 60 ? '#fbbf24' : '#f87171')
    const TYPE_COLORS = {
      router: '#38bdf8', camera: '#f43f5e', printer: '#a78bfa', computer: '#34d399',
      smart_plug: '#fbbf24', thermostat: '#fb923c', network_device: '#818cf8',
      tplink_device: '#64748b', phone_or_laptop: '#94a3b8', unknown: '#6b7280',
    }
    const barStyle = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#cbd5e1', padding: '4px 10px', background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, backdropFilter: 'blur(6px)' }
    const btnStyle = { fontSize: 11, padding: '2px 10px', cursor: 'pointer', background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6 }
    const glassCard = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 18px' }
    const preStyle = { background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '60vh', color: '#e2e8f0', margin: 0 }
    const fetchSnapshot = () => host.call('probe.snapshot', {})

    // ---- SVG 拓扑图 ----
    const TopoGraph = ({ topology, weakIps }) => {
      if (!topology || !topology.nodes || !topology.nodes.length) return React.createElement('div', { style: { color: '#64748b', padding: 24 } }, '（拓扑数据未就绪，点「刷新」重试）')
      const W = 860, H = 620, CX = W / 2, CY = H / 2
      const gw = topology.gateway
      const others = topology.nodes.filter((d) => !(gw && d.ip === gw.ip))
      const R = Math.min(W, H) * 0.36
      const nodes = []
      if (gw) nodes.push({ ...gw, x: CX, y: CY, r: 24, isGw: true })
      others.forEach((d, i) => {
        const a = (i / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2
        const rr = R * (d.upstream && d.upstream !== (gw && gw.ip) ? 1.0 : 0.92)
        nodes.push({ ...d, x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, r: 11, isGw: false })
      })
      const weakSet = new Set(weakIps || [])
      const links = nodes.filter((n) => !n.isGw).map((n) => {
        const up = topology.nodes.find((x) => x.ip === n.upstream)
        const target = up || gw || nodes[0]
        return { x1: target.x, y1: target.y, x2: n.x, y2: n.y }
      })
      return React.createElement('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: '100%', style: { minHeight: 540 } },
        React.createElement('defs', null,
          React.createElement('filter', { id: 'probe-glow' },
            React.createElement('feGaussianBlur', { stdDeviation: 4, result: 'b' }),
            React.createElement('feMerge', null,
              React.createElement('feMergeNode', { in: 'b' }),
              React.createElement('feMergeNode', { in: 'SourceGraphic' }),
            ),
          ),
        ),
        links.map((l, i) => React.createElement('line', { key: `l${i}`, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, stroke: 'rgba(148,163,184,0.35)', strokeWidth: 1.2 })),
        nodes.map((n) => React.createElement('g', { key: n.ip },
          React.createElement('circle', {
            cx: n.x, cy: n.y, r: n.r,
            fill: TYPE_COLORS[n.type] || '#6b7280',
            stroke: weakSet.has(n.ip) ? '#f87171' : 'rgba(255,255,255,0.45)',
            strokeWidth: weakSet.has(n.ip) ? 3 : 1.5,
            filter: n.isGw ? 'url(#probe-glow)' : undefined,
          }),
          React.createElement('text', { x: n.x, y: n.y + n.r + 15, textAnchor: 'middle', fill: '#e2e8f0', fontSize: 11, fontWeight: n.isGw ? 700 : 400 }, n.name || n.ip),
          React.createElement('text', { x: n.x, y: n.y - n.r - 7, textAnchor: 'middle', fill: '#64748b', fontSize: 9 }, n.type),
        )),
      )
    }

    const StatusBar = () => {
      const [snap, setSnap] = React.useState(null)
      const [err, setErr] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        const load = () => { fetchSnapshot().then((s) => { if (alive) { setSnap(s); setErr(null) } }).catch((e) => { if (alive) setErr(String(e)) }) }
        load()
        const dispose = ctx.interval(load, 30000)
        return () => { alive = false; dispose() }
      }, [])
      const refresh = () => fetchSnapshot().then((s) => { setSnap(s); setErr(null) }).catch((e) => setErr(String(e)))
      const toggle = () => { ui.open = !ui.open; host.call('probe.toggle', {}).then(refresh).catch(() => refresh()) }
      const h = snap && snap.health
      const label = err ? '探针 · 数据连接异常（点刷新重试）'
        : snap ? `探针 · ${snap.deviceCount} 设备 · 健康 ${h ? h.overall : '–'} · 薄弱 ${snap.weakCount || 0}`
        : '探针 · 连接中…'
      return React.createElement('div', { style: barStyle },
        React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: err ? '#f87171' : '#34d399', boxShadow: `0 0 8px ${err ? '#f87171' : '#34d399'}`, display: 'inline-block' } }),
        React.createElement('span', { style: err ? { color: '#f87171' } : undefined }, label),
        React.createElement('button', { onClick: toggle, style: btnStyle }, ui.open ? '收起大屏' : '透明大屏'),
        React.createElement('button', { onClick: refresh, style: btnStyle }, '刷新'),
      )
    }

    const Dashboard = () => {
      const [, force] = React.useReducer((x) => x + 1, 0)
      const [snap, setSnap] = React.useState(null)
      const [err, setErr] = React.useState(null)
      const [view, setView] = React.useState('dash')
      const [report, setReport] = React.useState(null)
      const [reportErr, setReportErr] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        const load = () => { fetchSnapshot().then((s) => { if (alive) { setSnap(s); setErr(null) } }).catch((e) => { if (alive) setErr(String(e)) }) }
        load()
        const t1 = ctx.interval(load, 15000)
        const t2 = ctx.interval(() => { if (alive) force() }, 2500)
        return () => { alive = false; t1(); t2() }
      }, [])
      if (!ui.open) return null
      const h = snap ? snap.health : null
      const close = () => { ui.open = false; host.call('probe.toggle', {}).catch(() => {}); force() }
      const openReport = () => { setView('report'); if (!report && !reportErr) host.call('probe.report', {}).then((r) => setReport(r)).catch((e) => setReportErr(String(e))) }
      const rootStyle = { position: 'fixed', inset: 0, zIndex: 2147483000, pointerEvents: 'auto', background: 'rgba(7,11,22,0.9)', backdropFilter: 'blur(14px)', fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#e2e8f0', display: 'flex', flexDirection: 'column', padding: '28px 40px', overflowY: 'auto' }
      const header = React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
        React.createElement('div', { style: { fontSize: 24, fontWeight: 800, letterSpacing: 2 } }, 'AEGISNET · 探针大屏',
          React.createElement('span', { style: { fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 12 } }, 'AI-Powered Infrastructure & Security')),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { onClick: () => setView('dash'), style: { ...btnStyle, fontSize: 13, background: view === 'dash' ? 'rgba(56,189,248,0.3)' : btnStyle.background } }, '大屏'),
          React.createElement('button', { onClick: () => setView('topo'), style: { ...btnStyle, fontSize: 13, background: view === 'topo' ? 'rgba(56,189,248,0.3)' : btnStyle.background } }, '拓扑'),
          React.createElement('button', { onClick: () => setView('quality'), style: { ...btnStyle, fontSize: 13, background: view === 'quality' ? 'rgba(56,189,248,0.3)' : btnStyle.background } }, '质量'),
          React.createElement('button', { onClick: openReport, style: { ...btnStyle, fontSize: 13, background: view === 'report' ? 'rgba(56,189,248,0.3)' : btnStyle.background } }, '体检报告'),
          React.createElement('button', { onClick: close, style: { ...btnStyle, fontSize: 13 } }, '关闭'),
        ),
      )

      // ---- 拓扑视图（SVG 图）----
      if (view === 'topo') {
        const weakIps = snap && snap.quality ? snap.quality.weakLinks.map((w) => w.ip) : []
        const legend = Object.entries(TYPE_COLORS).map(([t, c]) => React.createElement('span', { key: t, style: { display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12, fontSize: 11, color: '#94a3b8' } },
          React.createElement('span', { style: { width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' } }), t))
        return React.createElement('div', { style: rootStyle },
          header,
          React.createElement('div', { style: glassCard, marginBottom: 12 },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
              React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700 } }, `网络拓扑图（${snap && snap.topology ? snap.topology.nodes.length : '—'} 台设备）`),
              React.createElement('div', null,
                React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12, fontSize: 11, color: '#f87171' } }, '红圈 = 薄弱环节'),
                legend,
              ),
            ),
            React.createElement('div', { style: { height: 560 } }, React.createElement(TopoGraph, { topology: snap && snap.topology, weakIps })),
          ),
          React.createElement('div', { style: { color: '#475569', fontSize: 12 } }, '提示：对话里说「把 X 改名/接到 Y」可调整拓扑（覆盖会合并进图）；红圈设备见「质量」视图。'),
        )
      }

      // ---- 质量视图 ----
      if (view === 'quality') {
        const q = snap && snap.quality
        const row = (label, m) => React.createElement('div', { key: label, style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
          React.createElement('span', { style: { color: '#cbd5e1' } }, label),
          React.createElement('span', { style: { color: m && m.verdict === 'good' ? '#34d399' : '#f87171', fontWeight: 600 } }, m ? `${m.lossPct}% 丢包 / ${m.avg}ms / ${m.jitter}ms 抖动 / ${m.hops != null ? m.hops + ' 跳' : '—'} / ${m.verdict}` : '未测'),
        )
        return React.createElement('div', { style: rootStyle },
          header,
          q
            ? React.createElement(React.Fragment, null,
                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 } },
                  React.createElement('div', { style: glassCard },
                    React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '骨干链路'),
                    row('网关', q.gateway),
                    row('外网 8.8.8.8', q.internet),
                    row('DNS 75.75.75.75', q.dns),
                  ),
                  React.createElement('div', { style: glassCard },
                    React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '探针无线'),
                    q.wirelessSelf
                      ? React.createElement(React.Fragment, null,
                          React.createElement('div', { style: { color: '#cbd5e1', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } }, `SSID ${q.wirelessSelf.ssid} · ${q.wirelessSelf.band} · 信道 ${q.wirelessSelf.channel}`),
                          React.createElement('div', { style: { color: '#94a3b8', fontSize: 12, marginTop: 6 } }, `信号 ${q.wirelessSelf.signal} · RSSI ${q.wirelessSelf.rssi} · ${q.wirelessSelf.auth}`),
                        )
                      : React.createElement('div', { style: { color: '#64748b' } }, '探针非无线接入或未取到'),
                  ),
                  React.createElement('div', { style: glassCard },
                    React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '概况'),
                    React.createElement('div', { style: { color: '#cbd5e1', padding: '4px 0' } }, `设备 ${q.deviceCount} · 在线 ${q.online}`),
                    React.createElement('div', { style: { color: q.weakCount ? '#f87171' : '#34d399', fontWeight: 700, padding: '4px 0' } }, `薄弱环节 ${q.weakCount} 处`),
                    React.createElement('div', { style: { color: '#64748b', fontSize: 12, marginTop: 4 } }, `评估时间：${new Date(q.at).toLocaleString()}`),
                  ),
                ),
                React.createElement('div', { style: glassCard },
                  React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '薄弱环节清单（丢包/抖动超标）'),
                  q.weakLinks && q.weakLinks.length
                    ? q.weakLinks.map((w, i) => React.createElement('div', { key: i, style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(248,113,113,0.15)' } },
                        React.createElement('span', { style: { color: '#fca5a5' } }, `${i + 1}. ${w.ip}（${w.vendor}/${w.type}）`),
                        React.createElement('span', { style: { color: '#f87171', fontWeight: 600 } }, `${w.lossPct}% / ${w.avg}ms / ${w.verdict}`),
                      ))
                    : React.createElement('div', { style: { color: '#34d399' } }, '（无薄弱环节）'),
                ),
                React.createElement('div', { style: { marginTop: 12, color: '#475569', fontSize: 12 } }, '提示：数据来自最近一次 link_quality。在对话里说「跑一次质量评估」可实时刷新。'),
              )
            : React.createElement('div', { style: { color: '#64748b', fontSize: 14, padding: 24 } }, '（尚未评估——在对话里运行 link_quality 后这里会出现数据）'),
        )
      }

      // ---- 体检报告视图 ----
      if (view === 'report') {
        return React.createElement('div', { style: rootStyle },
          header,
          reportErr
            ? React.createElement('div', { style: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8, padding: 12, color: '#fca5a5' } }, `报告生成失败：${reportErr}`)
            : !report
              ? React.createElement('div', { style: { color: '#64748b', fontSize: 14, padding: 24 } }, '正在生成体检报告…')
              : React.createElement(React.Fragment, null,
                  React.createElement('div', { style: { color: '#94a3b8', fontSize: 12, marginBottom: 10 } }, `生成时间：${report.generatedAt} · 资产 ${report.deviceCount} 台 · 健康分 ${report.health.overall}`),
                  React.createElement('div', { style: glassCard, marginBottom: 14 },
                    React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '运行健康日报'),
                    React.createElement('pre', { style: preStyle }, report.daily),
                  ),
                  React.createElement('div', { style: glassCard },
                    React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, 'IT/安防健康诊断报告（14 天 · 含链路质量/配置记录）'),
                    React.createElement('pre', { style: preStyle }, report.diagnostic),
                  ),
                ),
          React.createElement('div', { style: { marginTop: 16, color: '#475569', fontSize: 12, textAlign: 'center' } }, '透明信任承诺：本报告基于探针采集的全部公开网络信息 · 只读 · 不触碰业务数据'),
        )
      }

      // ---- 大屏视图 ----
      const card = (title, value, sub) => React.createElement('div', { key: title, style: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '18px 22px', textAlign: 'center' } },
        React.createElement('div', { style: { color: '#94a3b8', fontSize: 14, letterSpacing: 1 } }, title),
        React.createElement('div', { style: { color: colorOf(value || 0), fontSize: 44, fontWeight: 700, lineHeight: 1.2 } }, `${value ?? '–'}`),
        React.createElement('div', { style: { color: '#64748b', fontSize: 12 } }, sub || ''),
      )
      const cameras = snap ? snap.devices.filter((d) => d.type === 'camera').length : 0
      const camRow = (label, value) => React.createElement('div', { key: label, style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
        React.createElement('span', { style: { color: '#cbd5e1' } }, label),
        React.createElement('span', { style: { color: '#f8fafc', fontWeight: 600 } }, value),
      )
      return React.createElement('div', { style: rootStyle },
        header,
        err ? React.createElement('div', { style: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8, padding: 12, marginBottom: 16, color: '#fca5a5' } }, `数据连接异常：${err}`) : null,
        h
          ? React.createElement(React.Fragment, null,
              React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 } },
                React.createElement('div', { style: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 18 } },
                  React.createElement('div', { style: { color: colorOf(h.overall), fontSize: 88, fontWeight: 800, lineHeight: 1 } }, h.overall),
                  React.createElement('div', null,
                    React.createElement('div', { style: { color: '#f8fafc', fontSize: 20, fontWeight: 700 } }, '整体健康'),
                    React.createElement('div', { style: { color: '#94a3b8', fontSize: 13, marginTop: 4 } }, '40% 网络 + 40% 安防 + 20% 基础设施'),
                  ),
                ),
                card('网络', h.network, `在线 ${Math.round(h.onlineRatio * 100)}%`),
                card('安防', h.security, `CCTV ${Math.round(h.camRatio * 100)}%`),
                card('基础设施', h.infrastructure, ''),
              ),
              React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 } },
                React.createElement('div', { style: glassCard },
                  React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '运行指标'),
                  camRow('资产总数', `${snap.deviceCount}`),
                  camRow('摄像头', `${cameras} 台`),
                  camRow('网关', snap.gateway ? snap.gateway.ip : '未识别'),
                  camRow('薄弱环节', `${snap.weakCount || 0} 处`),
                ),
                React.createElement('div', { style: glassCard },
                  React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '巡检状态'),
                  camRow('最近巡检', snap.patrol ? new Date(snap.patrol.at).toLocaleTimeString() : '等待首轮'),
                  camRow('在线/探测', snap.patrol ? `${snap.patrol.online}/${snap.patrol.total}` : '—'),
                  camRow('网关可达', snap.patrol ? (snap.patrol.gatewayOk ? '是' : '否') : '—'),
                  camRow('运行时长', Math.floor((Date.now() - new Date(snap.startedAt).getTime()) / 60000) + ' 分钟'),
                ),
                React.createElement('div', { style: glassCard },
                  React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '最近事件'),
                  snap.events.length
                    ? snap.events.slice(0, 6).map((e, i) => React.createElement('div', { key: i, style: { padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12 } },
                        React.createElement('span', { style: { color: e.level === 'P1' ? '#f87171' : '#fbbf24', fontWeight: 700 } }, `[${e.level}]`),
                        React.createElement('span', { style: { color: '#cbd5e1', marginLeft: 6 } }, `${e.kind} @ ${e.target || ''}`),
                      ))
                    : React.createElement('div', { style: { color: '#64748b', fontSize: 12 } }, '（无事件，全网平稳）'),
                ),
              ),
              React.createElement('div', { style: { ...glassCard, padding: '14px 18px' } },
                React.createElement('div', { style: { color: '#f8fafc', fontWeight: 700, marginBottom: 8 } }, '设备清单（按厂商/类型）'),
                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxHeight: 260, overflowY: 'auto' } },
                  snap.devices.slice(0, 28).map((d) => React.createElement('div', { key: d.ip, style: { background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 10px', fontSize: 12, display: 'flex', justifyContent: 'space-between' } },
                    React.createElement('span', { style: { color: '#cbd5e1' } }, d.ip),
                    React.createElement('span', { style: { color: '#64748b' } }, `${d.name || d.vendor}${d.type === 'camera' ? ' · CCTV' : ''}`),
                  )),
                ),
              ),
            )
          : React.createElement('div', { style: { color: '#64748b', fontSize: 14, padding: 24, textAlign: 'center' } }, err ? '（数据连接异常，见上方提示）' : '（正在获取探针数据…）'),
        React.createElement('div', { style: { marginTop: 16, color: '#475569', fontSize: 12, textAlign: 'center' } }, '透明信任承诺：本屏展示的数据即探针采集的全部公开网络信息 · 只读 · 不触碰业务数据 · 拔线即止'),
      )
    }
    slots.inject('conversation.input.dock', () => slots.register({ name: 'conversation.input.dock', id: 'probe-dock' }, () => React.createElement(StatusBar)))
    slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'probe-panel' }, () => React.createElement(Dashboard)))
  },
}
