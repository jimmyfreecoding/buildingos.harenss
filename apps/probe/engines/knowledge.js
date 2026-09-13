'use strict';

/**
 * 探针 v2 · 资产知识库
 * 人工补充/对话调整的持久化层（JSON，与 store.js 同模式）：
 *  - overrides.json：设备覆盖（名称/类型/上游设备/备注/无线频段）→ 支持「对话调整拓扑」
 *  - manuals.json  ：品牌/型号 → 配置手册（url/说明）
 *  - accounts.json ：设备登录配置记录（IP/用户名/密码，输出时脱敏）
 */

const fs = require('fs')
const path = require('path')

function createKnowledge(dataDir) {
  const dir = dataDir
  const file = (n) => path.join(dir, n)

  const readJson = (name, fallback) => {
    try { return JSON.parse(fs.readFileSync(file(name), 'utf8')) } catch { return fallback }
  }
  const writeJson = (name, data) => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file(name), JSON.stringify(data, null, 2), 'utf8')
  }
  const keyOf = (ipOrMac) => String(ipOrMac || '').toLowerCase()

  return {
    // ---- overrides ----
    listOverrides: () => readJson('overrides.json', []),
    upsertDeviceInfo(entry) {
      const list = this.listOverrides()
      const key = keyOf(entry.ip || entry.mac)
      const idx = list.findIndex((o) => keyOf(o.ip || o.mac) === key)
      const merged = idx >= 0 ? { ...list[idx], ...entry, ip: entry.ip || list[idx].ip, mac: entry.mac || list[idx].mac } : entry
      if (idx >= 0) list[idx] = merged
      else list.push(merged)
      writeJson('overrides.json', list)
      return merged
    },
    /** 把人工覆盖合入设备清单：名称/类型/备注/上游 */
    applyToDevices(devices) {
      const overrides = this.listOverrides()
      const byKey = new Map(overrides.map((o) => [keyOf(o.ip || o.mac), o]))
      return devices.map((d) => {
        const o = byKey.get(keyOf(d.ip || d.mac))
        if (!o) return d
        return {
          ...d,
          name: o.name || d.name,
          type: o.type || d.type,
          notes: o.notes,
          upstream: o.upstream,
          band: o.band,
          manualRef: o.manualRef,
        }
      })
    },

    // ---- manuals ----
    listManuals: () => readJson('manuals.json', []),
    upsertManual(entry) {
      const list = this.listManuals()
      const id = entry.id || `m${Date.now()}`
      const idx = list.findIndex((m) => m.id === id)
      const merged = { id, ...entry }
      if (idx >= 0) list[idx] = merged
      else list.push(merged)
      writeJson('manuals.json', list)
      return merged
    },

    // ---- accounts（登录配置记录）----
    listAccounts: () => readJson('accounts.json', []),
    upsertAccount(entry) {
      const list = this.listAccounts()
      const id = entry.id || `${entry.ip || entry.device}-${Date.now()}`
      const idx = list.findIndex((a) => a.id === id)
      const merged = { id, ...entry }
      if (idx >= 0) list[idx] = merged
      else list.push(merged)
      writeJson('accounts.json', list)
      return merged
    },
    /** 脱敏输出：密码打码、IP 保留 */
    maskedAccounts() {
      return this.listAccounts().map((a) => ({
        ...a,
        password: a.password ? '••••••••' : '',
      }))
    },
  }
}

module.exports = { createKnowledge }
