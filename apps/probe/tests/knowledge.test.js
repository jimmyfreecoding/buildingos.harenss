'use strict';

/**
 * 探针 v2 · 资产知识库单测：node tests/knowledge.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKnowledge } = require('../engines/knowledge');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-kb-'));
const kb = createKnowledge(tmp);

// ---- 1) 设备覆盖（对话调整）----
kb.upsertDeviceInfo({ ip: '10.0.0.94', name: '东区摄像头', type: 'camera', upstream: '10.0.0.204', notes: 'TP-Link Tapo，接交换机2口', manualRef: 'm1' });
kb.upsertDeviceInfo({ ip: '10.0.0.94', upstream: '10.0.0.1' }); // 对话修正上游
const overrides = kb.listOverrides();
assert.strictEqual(overrides.length, 1, 'upsert merges by key');
assert.strictEqual(overrides[0].upstream, '10.0.0.1');
assert.strictEqual(overrides[0].name, '东区摄像头');

// ---- 2) 合入设备清单 ----
const merged = kb.applyToDevices([
  { ip: '10.0.0.94', mac: 'e0:d3:62:b9:d3:0d', vendor: 'TP-Link', type: 'tplink_device' },
  { ip: '10.0.0.5', mac: '98-25-4a-fa-92-ec', vendor: 'TP-Link', type: 'tplink_device' },
]);
const cam = merged.find((d) => d.ip === '10.0.0.94');
assert.strictEqual(cam.name, '东区摄像头');
assert.strictEqual(cam.type, 'camera');
assert.strictEqual(cam.upstream, '10.0.0.1');
assert.strictEqual(cam.manualRef, 'm1');
assert.strictEqual(merged.find((d) => d.ip === '10.0.0.5').name, undefined, '未覆盖设备不受影响');

// ---- 3) 手册库 ----
kb.upsertManual({ id: 'm1', brand: 'TP-Link', model: 'Tapo C210', kind: 'camera', url: 'https://www.tp-link.com/...', notes: 'RTSP 路径 /stream1' });
assert.strictEqual(kb.listManuals().length, 1);
assert.strictEqual(kb.listManuals()[0].brand, 'TP-Link');

// ---- 4) 账号记录 + 脱敏 ----
kb.upsertAccount({ id: 'a1', device: '防火墙', ip: '10.0.0.1', username: 'admin', password: 'secret123', note: '主路由' });
kb.upsertAccount({ id: 'a2', device: '海康NVR', ip: '10.0.0.119', username: 'admin', password: 'pass456' });
assert.strictEqual(kb.listAccounts().length, 2);
const masked = kb.maskedAccounts();
assert(masked.every((a) => !a.password.includes('secret') && !a.password.includes('pass456')), 'passwords masked');
assert.strictEqual(masked[0].ip, '10.0.0.1');
assert(masked[0].password.includes('••'), 'masked placeholder');

// ---- 5) 跨实例持久化 ----
const kb2 = createKnowledge(tmp);
assert.strictEqual(kb2.listOverrides().length, 1);
assert.strictEqual(kb2.listManuals().length, 1);

console.log('ALL KNOWLEDGE TESTS PASSED  ✔');
