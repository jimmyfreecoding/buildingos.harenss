'use strict';

/**
 * M2 扫描链路引擎：ping 扫活 → ARP 解析 → 设备清单
 * 纯 Node 模块。ping 原语由调用方注入（execPing），插件侧用 subprocess Service 内联等价实现。
 */

const { parseArpTable } = require('./discovery');

function deriveRange(subnet, override) {
  const input = String(subnet || '').trim()
  if (Array.isArray(override) && override.length === 2) return { prefix: input.split('/')[0].split('.').slice(0, 3).join('.'), range: override }
  // a.b.c
  if (/^\d{1,3}(\.\d{1,3}){2}$/.test(input)) return { prefix: input, range: [1, 254] }
  // a.b.c.d/n
  const m = input.match(/^(\d{1,3}(?:\.\d{1,3}){2})\.\d{1,3}\/(\d+)$/)
  if (m) {
    const bits = Number(m[2])
    if (bits >= 24) return { prefix: m[1], range: [1, 254] }
    if (bits === 16) return { prefix: `${m[1].split('.')[0]}.${m[1].split('.')[1]}`, range: [0, 254] }
    throw new Error('unsupported mask; use /24 or /16')
  }
  // single IP
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(input)) {
    const p = input.split('.')
    return { prefix: p.slice(0, 3).join('.'), range: [Number(p[3]), Number(p[3])] }
  }
  throw new Error('unsupported subnet format: use a.b.c, a.b.c.0/24, a.b.0.0/16 or a.b.c.d')
}

function ipList({ prefix, range }) {
  const [lo, hi] = range
  const out = []
  for (let i = lo; i <= hi; i++) out.push(`${prefix}.${i}`)
  return out
}

/**
 * 并发 ping 扫活。execPing(ip) => Promise<boolean>
 */
async function pingSweep(subnet, opts = {}) {
  const { execPing, concurrency = 40, range } = opts
  if (typeof execPing !== 'function') throw new Error('pingSweep requires opts.execPing')
  const ips = ipList(deriveRange(subnet, range))
  const live = []
  let cursor = 0
  async function worker() {
    while (cursor < ips.length) {
      const ip = ips[cursor++]
      try {
        if (await execPing(ip)) live.push(ip)
      } catch {
        /* 单主机失败忽略 */
      }
    }
  }
  const workers = Math.min(concurrency, ips.length)
  await Promise.all(Array.from({ length: workers }, worker))
  live.sort((a, b) => a.split('.').map(Number)[3] - b.split('.').map(Number)[3])
  return live
}

/**
 * 完整链路：扫活 → ARP 解析。arpText 可缺省（依赖平台已填充的 ARP 表）。
 */
async function discoverNetwork(subnet, opts = {}) {
  const { execPing, arpText = '', concurrency, range } = opts
  const live = await pingSweep(subnet, { execPing, concurrency, range })
  const devices = parseArpTable(arpText)
  return {
    subnet: String(subnet),
    liveCount: live.length,
    live,
    arpDevices: devices.length,
    devices,
  }
}

module.exports = { deriveRange, ipList, pingSweep, discoverNetwork }
