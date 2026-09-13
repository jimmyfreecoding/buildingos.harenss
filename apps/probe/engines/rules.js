'use strict';

/**
 * M6 规则引擎：事件分级（P1–P4）+ 自愈决策
 * 纯 Node 模块，无副作用。自愈写动作由执行器负责（授权门在 canSelfHeal 与插件层）。
 * 安全原则（02 §6）：核心设备永不自动写；默认只读 30 天；单端口日上限 3 次。
 */

const LEVEL_ORDER = { P1: 1, P2: 2, P3: 3, P4: 4 }

const CORE_TYPES = ['router', 'switch', 'network_device']
const HEALABLE_TYPES = ['camera', 'ap', 'tplink_device', 'smart_plug']

/**
 * 判定一次检查结果 → { level, kind, action }
 * action: 'none' | 'record' | 'alert' | 'self_heal_poe'
 */
function decide({ device = null, consecutiveFailures = 0, portErrorRate = 0, isNew = false, config = {} } = {}) {
  const type = device && device.type ? device.type : 'unknown'

  if (isNew) return { level: 'P4', kind: 'new_device', action: 'record' }

  // 核心设备：掉线即 P1，只告警不自愈（避免误伤业务）
  if (CORE_TYPES.includes(type)) {
    if (consecutiveFailures >= 1) return { level: 'P1', kind: 'core_down', action: 'alert' }
  }

  // 摄像头/AP/智能设备：连续 3 次掉线 → 自愈（授权后）或告警
  if (HEALABLE_TYPES.includes(type) && consecutiveFailures >= 3) {
    if (config.selfHealEnabled && device && device.mac) {
      return { level: 'P2', kind: 'device_down', action: 'self_heal_poe' }
    }
    return { level: 'P2', kind: 'device_down', action: 'alert' }
  }

  // 端口错误率超标
  if (portErrorRate > 0.05) return { level: 'P3', kind: 'port_errors', action: 'alert' }

  // 1–2 次失败：降级观察
  if (consecutiveFailures >= 1 && consecutiveFailures < 3) {
    return { level: 'P3', kind: 'degraded', action: 'alert' }
  }

  return { level: 'P4', kind: 'ok', action: 'none' }
}

/** 自愈前置校验：配置开关 / 设备白名单 / 日上限 */
function canSelfHeal(config = {}, { mac = null, type = '' } = {}, dailyCount = 0) {
  if (!config.selfHealEnabled) return { allowed: false, reason: 'selfHeal disabled (default read-only)' }
  if (!mac) return { allowed: false, reason: 'no mac address for target' }
  if (CORE_TYPES.includes(type)) return { allowed: false, reason: 'core device excluded from self-heal' }
  if (dailyCount >= (config.dailyHealLimit || 3)) {
    return { allowed: false, reason: `daily limit ${config.dailyHealLimit || 3} reached` }
  }
  return { allowed: true }
}

/** 事件按严重度排序（P1 在前） */
function prioritize(events = []) {
  return [...events].sort((a, b) => (LEVEL_ORDER[a.level] || 9) - (LEVEL_ORDER[b.level] || 9))
}

module.exports = { LEVEL_ORDER, CORE_TYPES, HEALABLE_TYPES, decide, canSelfHeal, prioritize }
