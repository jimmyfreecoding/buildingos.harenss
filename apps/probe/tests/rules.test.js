'use strict';

/**
 * M6 规则引擎单测：node tests/rules.test.js
 * 覆盖：核心设备 P1 不自动写 / 摄像头连续掉线自愈 / 授权门 / 日上限 / 排序
 */

const assert = require('assert');
const { decide, canSelfHeal, prioritize } = require('../engines/rules');

// ---- 1) 核心设备掉线 → P1 只告警 ----
const core = decide({ device: { type: 'router' }, consecutiveFailures: 1, config: { selfHealEnabled: true } });
assert.strictEqual(core.level, 'P1');
assert.strictEqual(core.action, 'alert');

// ---- 2) 摄像头连续 3 次掉线 + 授权 → 自愈 ----
const camHeal = decide({ device: { type: 'camera', mac: 'aa:bb:cc:00:00:01' }, consecutiveFailures: 3, config: { selfHealEnabled: true } });
assert.strictEqual(camHeal.level, 'P2');
assert.strictEqual(camHeal.action, 'self_heal_poe');

// ---- 3) 未授权（默认只读）→ 只告警 ----
const camAlert = decide({ device: { type: 'camera', mac: 'aa:bb:cc:00:00:01' }, consecutiveFailures: 3, config: {} });
assert.strictEqual(camAlert.action, 'alert');

// ---- 4) 降级观察 / 正常 ----
assert.strictEqual(decide({ device: { type: 'camera' }, consecutiveFailures: 1 }).level, 'P3');
assert.strictEqual(decide({ device: { type: 'camera' }, consecutiveFailures: 0 }).level, 'P4');

// ---- 5) 端口错误率 ----
assert.strictEqual(decide({ portErrorRate: 0.08 }).level, 'P3');
assert.strictEqual(decide({ portErrorRate: 0.01 }).level, 'P4');

// ---- 6) 新设备 ----
assert.strictEqual(decide({ isNew: true }).kind, 'new_device');

// ---- 7) canSelfHeal 授权门 ----
assert.strictEqual(canSelfHeal({}, { mac: 'aa', type: 'camera' }, 0).allowed, false);
assert.strictEqual(canSelfHeal({ selfHealEnabled: true }, { mac: 'aa', type: 'camera' }, 0).allowed, true);
assert.strictEqual(canSelfHeal({ selfHealEnabled: true }, { mac: null, type: 'camera' }, 0).allowed, false);
assert.strictEqual(canSelfHeal({ selfHealEnabled: true }, { mac: 'aa', type: 'router' }, 0).allowed, false);
assert.strictEqual(canSelfHeal({ selfHealEnabled: true }, { mac: 'aa', type: 'camera' }, 3).allowed, false);

// ---- 8) 排序 ----
const ordered = prioritize([
  { level: 'P3', kind: 'a' },
  { level: 'P1', kind: 'b' },
  { level: 'P2', kind: 'c' },
]);
assert.deepStrictEqual(ordered.map((e) => e.level), ['P1', 'P2', 'P3']);

console.log('ALL RULES TESTS PASSED  ✔');
