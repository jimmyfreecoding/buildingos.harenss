'use strict';

/**
 * M5 拓扑构建：三源交叉验证（LLDP / CAM / ARP）→ 图 JSON + 置信度
 * 纯 Node 模块。数据来源：arp 设备清单（engines/discovery）、LLDP/CAM（engines/snmp）。
 * 置信度规则：LLDP=high；CAM+ARP 交叉=medium-high；纯 ARP=medium（如实标注，宁低勿假）。
 */

/** 基于厂商/端口/随机MAC 推断节点类型（与 discovery.classifyDevice 同源） */
function inferNodeType(d) {
  if (!d) return 'unknown'
  if (d.type) return d.type
  if (d.ports && d.ports[554]) return 'camera'
  if (d.randomMac) return 'phone_or_laptop'
  const v = String(d.vendor || '').toLowerCase()
  if (v.includes('vantiva') || v.includes('xfinity')) return 'router'
  if (v.includes('hikvision')) return 'camera'
  if (v.includes('resideo') || v.includes('honeywell')) return 'thermostat'
  if (v.includes('tuya')) return 'smart_plug'
  if (v.includes('h3c')) return 'network_device'
  if (v.includes('hewlett') || v.includes('hp ')) return 'printer'
  if (v.includes('intel') || v.includes('mediatek')) return 'computer'
  if (v.includes('tp-link')) return 'tplink_device'
  return 'unknown'
}

/**
 * @param {Object} opts
 * @param {Array} opts.devices  ARP 设备清单 [{ip,mac,vendor,randomMac,ports?}]
 * @param {Array} opts.lldp     LLDP 邻居 [{localPort, chassisId, portId, sysName}]
 * @param {Array} opts.cam      CAM 表 [{mac, port}]
 * @param {string} opts.gatewayIp 默认网关 IP（用于 ARP 星型挂载）
 * @param {string} opts.gatewayMac 默认网关 MAC（可选，更稳）
 */
function buildTopology({ devices = [], lldp = [], cam = [], gatewayIp = '', gatewayMac = '' } = {}) {
  const nodes = []
  const links = []
  const byMac = new Map()
  const byIp = new Map()

  for (const d of devices) {
    const type = inferNodeType(d)
    const node = {
      id: d.mac || d.ip,
      ip: d.ip,
      mac: d.mac || null,
      vendor: d.vendor || 'Unknown',
      type,
      randomMac: !!d.randomMac,
      sources: ['arp'],
      confidence: 'medium',
    }
    nodes.push(node)
    // 统一 MAC 归一化键：小写、剥离 : 与 -
    const key = d.mac ? String(d.mac).toLowerCase().replace(/[:-]/g, '') : null
    if (key) byMac.set(key, node)
    if (d.ip) byIp.set(d.ip, node)
  }

  // 1) LLDP 链路：switch:localPort ↔ 邻居（chassisId 为 MAC 时精确匹配；否则按 sysName 尽力）
  for (const n of lldp) {
    let target = null
    if (n.chassisId && /^[0-9a-f]{12}$/.test(String(n.chassisId))) {
      target = byMac.get(String(n.chassisId).toLowerCase().replace(/[:-]/g, ''))
    }
    if (!target && n.sysName) {
      target = nodes.find((x) => x.type === 'network_device' && x.vendor === 'Unknown') || null
    }
    if (target) {
      links.push({
        source: 'switch',
        target: target.id,
        via: 'lldp',
        localPort: n.localPort,
        remotePort: n.portId,
        confidence: 'high',
      })
      if (!target.sources.includes('lldp')) target.sources.push('lldp')
      target.confidence = 'high'
    }
  }

  // 2) CAM：MAC → switch:port；与 LLDP 并存的升级为 high
  for (const c of cam) {
    const node = byMac.get(String(c.mac).toLowerCase().replace(/[:-]/g, ''))
    if (!node) continue
    const hasLldp = links.some((l) => l.target === node.id && l.via === 'lldp')
    links.push({
      source: 'switch',
      target: node.id,
      via: 'cam',
      localPort: c.port,
      confidence: hasLldp ? 'high' : 'medium',
    })
    if (!node.sources.includes('cam')) node.sources.push('cam')
    if (hasLldp) node.confidence = 'high'
  }

  // 3) 纯 ARP 设备 → 挂到网关（星型，如实标注 medium）
  const gateway = gatewayMac
    ? byMac.get(String(gatewayMac).toLowerCase().replace(/[:-]/g, ''))
    : byIp.get(gatewayIp)
  for (const node of nodes) {
    if (gateway && node.id === gateway.id) continue
    const alreadyLinked = links.some((l) => l.target === node.id)
    if (!alreadyLinked) {
      links.push({
        source: gateway ? gateway.id : 'gateway',
        target: node.id,
        via: 'arp',
        confidence: 'medium',
      })
    }
  }

  return {
    nodes,
    links,
    sources: { lldp: lldp.length, cam: cam.length, arp: devices.length },
    gateway: gateway ? { id: gateway.id, ip: gateway.ip, mac: gateway.mac } : null,
  }
}

module.exports = { inferNodeType, buildTopology }
