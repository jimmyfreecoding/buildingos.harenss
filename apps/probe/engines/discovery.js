'use strict';

/**
 * M2 发现引擎（规范实现，可单测；纯 Node，无第三方依赖）
 * - parseArpTable : 解析 `arp -a`（Windows）/ `ip neigh`（Linux）输出
 * - isRandomMac   : 本地管理位检测（隐私地址/随机 MAC）
 * - lookupOui     : 本地 OUI 前缀表 → 厂商（内置常见子集；部署时下载完整 IEEE 库到 data/oui.csv）
 * - probePort(s)  : TCP 端口探测（net.Socket + 超时，跨平台）
 * - classifyDevice: 基于端口/厂商/随机MAC 推断设备类型
 * 说明：插件内将内联等价逻辑（无 require）；本模块是规范实现与单测载体。
 */

const net = require('net');

// 内置常见 OUI 子集（源自本次真实摸盘 + 常用设备厂商；完整库运行时扩充）
const OUI_SUBSET = {
  'F8:D0:0E': 'Vantiva (Xfinity)',
  'E0:D3:62': 'TP-Link',
  '3C:6A:D2': 'TP-Link',
  '98:25:4A': 'TP-Link',
  'F0:09:0D': 'TP-Link',
  '60:83:E7': 'TP-Link',
  '24:2F:D0': 'TP-Link',
  'F0:A7:31': 'TP-Link',
  '20:23:51': 'TP-Link',
  'B8:06:0D': 'Tuya Smart',
  '08:54:11': 'Hikvision',
  '60:E3:2B': 'Intel',
  'A4:6B:B6': 'Intel',
  '18:C0:09': 'New H3C',
  'B8:2C:A0': 'Resideo (Honeywell)',
  'A0:48:1C': 'Hewlett Packard',
  'CC:5E:F8': 'MediaTek',
};

function normalizeMac(mac) {
  return String(mac || '').trim().toUpperCase().replace(/-/g, ':');
}

function ouiOf(mac) {
  const n = normalizeMac(mac);
  const parts = n.split(':');
  return parts.length >= 3 ? parts.slice(0, 3).join(':') : null;
}

function lookupOui(mac) {
  const oui = ouiOf(mac);
  return (oui && OUI_SUBSET[oui]) || 'Unknown';
}

function isRandomMac(mac) {
  const n = normalizeMac(mac);
  const first = parseInt(n.split(':')[0], 16);
  return !Number.isNaN(first) && (first & 0x02) !== 0;
}

/**
 * 解析 ARP 文本。兼容：
 *   Windows: "  10.0.0.1            f8-d0-0e-a6-5e-27     dynamic"
 *   Linux:   "10.0.0.1 dev eth0 lladdr f8:d0:0e:a6:5e:27 REACHABLE"
 * 过滤广播/组播条目；返回 { ip, mac, oui, vendor, randomMac }[]
 */
function parseArpTable(text) {
  const rows = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    // IP 可出现在行首（Windows/ip neigh 均如此），MAC 可在行内任意位置
    const ipMatch = line.match(/(\d{1,3}(?:\.\d{1,3}){3})/)
    if (!ipMatch) continue
    const ip = ipMatch[1]
    const macMatch = line.match(/([0-9a-fA-F]{2}([:-])[0-9a-fA-F]{2}(?:\2[0-9a-fA-F]{2}){4})/)
    if (!macMatch) continue
    const mac = macMatch[1].toLowerCase()
    if (ip.endsWith('.255')) continue
    const norm = normalizeMac(mac)
    if (norm === 'FF:FF:FF:FF:FF:FF' || norm.startsWith('01:00:5E')) continue
    const vendor = lookupOui(mac)
    rows.push({ ip, mac, oui: ouiOf(mac), vendor, randomMac: isRandomMac(mac) })
  }
  // 去重（ip 优先保留非随机 MAC 条目）
  const seen = new Map()
  for (const r of rows) {
    if (!seen.has(r.ip) || (seen.get(r.ip).randomMac && !r.randomMac)) seen.set(r.ip, r)
  }
  return [...seen.values()]
}

/** 单端口 TCP 探测，超时返回 false */
function probePort(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timer = setTimeout(() => { socket.destroy(); resolve(false) }, timeoutMs)
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true) })
    socket.once('error', () => { clearTimeout(timer); socket.destroy(); resolve(false) })
    socket.once('timeout', () => { clearTimeout(timer); socket.destroy(); resolve(false) })
    socket.connect(port, host)
  })
}

/** 多端口并发探测（限速），返回 { port: boolean } */
async function probePorts(host, ports, opts = {}) {
  const results = {}
  const concurrency = opts.concurrency || 8
  const timeoutMs = opts.timeoutMs || 1500
  let i = 0
  async function worker() {
    while (i < ports.length) {
      const p = ports[i++]
      results[p] = await probePort(host, p, timeoutMs)
    }
  }
  const workers = Math.min(concurrency, ports.length)
  await Promise.all(Array.from({ length: workers }, worker))
  return results
}

/** 基于端口/厂商/随机MAC 推断设备类型（置信度见 11 文档摸盘经验） */
function classifyDevice({ ports = {}, vendor = '', randomMac = false } = {}) {
  if (ports[554]) return 'camera'
  if (randomMac) return 'phone_or_laptop'
  if (vendor === 'Hikvision') return 'camera'
  const v = String(vendor).toLowerCase()
  if (v.includes('vantiva') || v.includes('xfinity')) return 'router'
  if (v.includes('resideo') || v.includes('honeywell')) return 'thermostat'
  if (v.includes('tuya')) return 'smart_plug'
  if (v.includes('h3c')) return 'network_device'
  if (v.includes('hewlett') || v.includes('hp ')) return 'printer'
  if (v.includes('intel') || v.includes('mediatek')) return 'computer'
  if (v.includes('tp-link')) return 'tplink_device'
  return 'unknown'
}

module.exports = {
  OUI_SUBSET,
  normalizeMac,
  ouiOf,
  lookupOui,
  isRandomMac,
  parseArpTable,
  probePort,
  probePorts,
  classifyDevice,
}
