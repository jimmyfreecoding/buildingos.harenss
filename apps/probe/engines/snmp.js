'use strict';

/**
 * M3 SNMP 引擎：net-snmp CLI（snmpwalk/snmpget）输出解析 + MIB 语义提取
 * 纯 Node 模块。CLI 执行由调用方注入（runCli）；本模块负责解析与结构化。
 * 参考 MIB：
 *  LLDP-MIB 1.0.8802.1.1.2 (lldpRemTable: .1.0.8802.1.1.2.1.4.1.1)
 *  BRIDGE-MIB dot1dTpFdbTable (.1.3.6.1.2.1.17.4.3.1)
 *  IF-MIB ifTable (.1.3.6.1.2.1.2.2.1)
 *  POWER-ETHERNET-MIB pethPsePort (.1.3.6.1.2.1.105.1.1.1)
 */

/** 解析单行 snmpwalk 输出 → { oid, type, value } | null */
function parseWalkLine(line) {
  // 类型名允许连字符（Hex-STRING）与括号枚举（INTEGER(1)）
  const m = String(line || '').match(/^([\w.:-]+)\s*=\s*([\w-]+(?:\(\d+\))?):\s*(.*)$/)
  if (!m) return null
  return { oid: m[1], type: m[2], value: m[3].trim() }
}

/** 解析整段 snmpwalk 输出 */
function parseWalk(text) {
  const out = []
  for (const line of String(text || '').split(/\r?\n/)) {
    const entry = parseWalkLine(line)
    if (entry) out.push(entry)
  }
  return out
}

/** Hex-STRING "30 30 30 43 30 30 45 32" → 归一化字符串 */
function hexStringToAscii(hex) {
  try {
    return hex
      .split(/\s+/)
      .filter(Boolean)
      .map((b) => String.fromCharCode(parseInt(b, 16)))
      .join('')
  } catch {
    return hex
  }
}

/** Hex-STRING "30 30 30 43..." 或 "303043..." → 压缩 hex（去空格小写） */
function hexStringToHex(hex) {
  return String(hex || '').replace(/\s+/g, '').toLowerCase()
}

/**
 * 提取 LLDP 邻居（lldpRemTable: .1.0.8802.1.1.2.1.4.1.1.<field>.<localPort>.<idx>）
 * 返回 [{ localPort, chassisId, portId, sysName }]
 */
function parseLldpNeighbors(entries) {
  const byIdx = new Map()
  const prefix = '.1.0.8802.1.1.2.1.4.1.1.'
  for (const e of entries) {
    if (!e.oid.startsWith(prefix)) continue
    const rest = e.oid.slice(prefix.length)
    const parts = rest.split('.')
    if (parts.length < 3) continue
    const field = Number(parts[0])
    const localPort = Number(parts[1])
    const idx = parts.slice(2).join('.')
    // lldpRemIndex 在每个端口内重新计数 → 分组键必须是 localPort + idx
    const key = `${localPort}.${idx}`
    if (!byIdx.has(key)) byIdx.set(key, { localPort })
    const row = byIdx.get(key)
    // 5=chassisId 7=portId 9=sysName (STRING) / 6=portIdSubtype 4=chassisSubtype
    if (field === 5) {
      // 6 字节 MAC 型 chassis（12 位 hex）→ 保留 hex 供与 CAM/ARP 交叉比对；否则按 ASCII 解读
      const hex = hexStringToHex(e.value)
      row.chassisId = hex.length === 12 ? hex : hexStringToAscii(e.value)
    }
    if (field === 7) row.portId = e.type === 'STRING' ? e.value : hexStringToAscii(e.value)
    if (field === 9) row.sysName = e.value
  }
  return [...byIdx.values()].filter((r) => r.chassisId || r.portId || r.sysName)
}

/**
 * 提取 CAM 表（dot1dTpFdbTable .1.3.6.1.2.1.17.4.3.1.1.<mac-hex> = INTEGER: port）
 * 返回 [{ mac, port }]
 */
function parseCamTable(entries) {
  const out = []
  const prefix = '.1.3.6.1.2.1.17.4.3.1.1.'
  for (const e of entries) {
    if (!e.oid.startsWith(prefix)) continue
    // OID 尾段为 MAC 的十进制字节（如 0.224.211.98.185.211.13）→ 逐字节转 hex
    const macHex = e.oid
      .slice(prefix.length)
      .split('.')
      .map((o) => Number(o).toString(16).padStart(2, '0'))
      .join('')
    const port = Number(e.value)
    if (macHex && !Number.isNaN(port)) out.push({ mac: macHex, port })
  }
  return out
}

/** IF-MIB ifTable：端口名/状态/速率/错误包 → [{ ifIndex, name, status, speed, inErrors }] */
function parseIfTable(entries) {
  const rows = new Map()
  const prefix = '.1.3.6.1.2.1.2.2.1.'
  for (const e of entries) {
    if (!e.oid.startsWith(prefix)) continue
    const rest = e.oid.slice(prefix.length).split('.')
    const field = Number(rest[0])
    const idx = Number(rest[1])
    if (!rows.has(idx)) rows.set(idx, { ifIndex: idx })
    const row = rows.get(idx)
    if (field === 2) row.name = e.value            // ifDescr
    if (field === 7) row.adminStatus = Number(e.value)
    if (field === 8) row.status = Number(e.value)   // ifOperStatus
    if (field === 5) row.speed = Number(e.value)    // ifSpeed
    if (field === 14) row.inErrors = Number(e.value) // ifInErrors
  }
  return [...rows.values()]
}

/** PoE（POWER-ETHERNET-MIB pethPsePort .1.3.6.1.2.1.105.1.1.1）：1=adminEnable 2=adminStatus 3=powerPriority 5=power */
function parsePoePorts(entries) {
  const rows = new Map()
  const prefix = '.1.3.6.1.2.1.105.1.1.1.'
  for (const e of entries) {
    if (!e.oid.startsWith(prefix)) continue
    const rest = e.oid.slice(prefix.length).split('.')
    const field = Number(rest[0])
    const idx = Number(rest[1])
    if (!rows.has(idx)) rows.set(idx, { port: idx })
    const row = rows.get(idx)
    if (field === 1) row.adminEnable = Number(e.value)
    if (field === 2) row.adminStatus = Number(e.value)
    if (field === 5) row.powerMilliwatts = Number(e.value)
    if (field === 6) row.class = e.value
  }
  return [...rows.values()]
}

/** 组合一次 SNMP 采集：runCli(argv) => Promise<string> */
async function collectSwitch(host, community, runCli, opts = {}) {
  const base = ['snmpwalk', '-v2c', '-c', community, '-On', host]
  const out = {}
  try {
    out.lldp = parseLldpNeighbors(parseWalk(await runCli([...base, '1.0.8802.1.1.2'])))
  } catch { out.lldp = [] }
  try {
    out.cam = parseCamTable(parseWalk(await runCli([...base, '1.3.6.1.2.1.17.4.3.1.1'])))
  } catch { out.cam = [] }
  try {
    out.ifTable = parseIfTable(parseWalk(await runCli([...base, '1.3.6.1.2.1.2.2.1'])))
  } catch { out.ifTable = [] }
  try {
    out.poe = parsePoePorts(parseWalk(await runCli([...base, '1.3.6.1.2.1.105.1.1.1'])))
  } catch { out.poe = [] }
  return out
}

module.exports = {
  parseWalkLine,
  parseWalk,
  hexStringToAscii,
  hexStringToHex,
  parseLldpNeighbors,
  parseCamTable,
  parseIfTable,
  parsePoePorts,
  collectSwitch,
}
