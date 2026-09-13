'use strict';

/**
 * 数据层单测（M1 验收）：node tests/store.test.js
 * 覆盖：devices CRUD / events / config / audit / 跨实例持久化
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../engines/store');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-store-'));
const store = createStore(tmp);

// 1) device create
const d1 = store.upsertDevice({
  ip: '10.0.0.1',
  mac: 'f8:d0:0e:a6:5e:27',
  vendor: 'Vantiva',
  type: 'router',
  ports: [80, 443],
  status: 'online',
  confidence: 'high',
});
assert.strictEqual(store.listDevices().length, 1, 'create adds one device');
assert(d1.firstSeen && d1.lastSeen, 'firstSeen/lastSeen set on create');

// 2) device upsert preserves firstSeen, updates lastSeen
const d1b = store.upsertDevice({ ip: '10.0.0.1', status: 'degraded' });
assert.strictEqual(d1b.firstSeen, d1.firstSeen, 'upsert preserves firstSeen');
assert.strictEqual(d1b.status, 'degraded', 'upsert merges fields');
assert.strictEqual(store.listDevices().length, 1, 'upsert does not duplicate');

// 3) multi devices
store.upsertDevice({ ip: '10.0.0.94', mac: 'e0:d3:62:b9:d3:0d', vendor: 'TP-Link', type: 'camera', ports: [443, 554], status: 'online', confidence: 'high' });
assert.strictEqual(store.listDevices().length, 2);

// 4) events
store.appendEvent({ level: 'P2', kind: 'device_down', target: '10.0.0.94', detail: 'camera offline', autoHealed: true });
store.appendEvent({ level: 'P3', kind: 'port_errors', target: 'switch', detail: 'err rate 5%', autoHealed: false });
const events = store.listEvents();
assert.strictEqual(events.length, 2, 'events appended');
assert(events[0].ts, 'event has ts');
assert.strictEqual(events[1].level, 'P3');

// 5) config
store.setConfig({ site: 'Test Warehouse', selfHealEnabled: false, pollIntervalMs: 300000 });
const cfg = store.getConfig();
assert.strictEqual(cfg.site, 'Test Warehouse');
assert.strictEqual(cfg.selfHealEnabled, false);
store.setConfig({ notifyEmail: 'ops@example.com' });
assert.strictEqual(store.getConfig().notifyEmail, 'ops@example.com', 'config merges');

// 6) audit trail: upsert x3 + event x2 + config x2 = 7 writes
const audit = store.listAudit();
assert.strictEqual(audit.length, 7, `audit length = ${audit.length}`);
assert(audit.every((a) => a.ts && a.op), 'every audit entry has ts+op');
assert(audit.some((a) => a.op === 'upsertDevice' && a.ip === '10.0.0.94'), 'audit records device ip');

// 7) persistence across store instances (same dir)
const store2 = createStore(tmp);
assert.strictEqual(store2.listDevices().length, 2, 'persists across instances');
assert.strictEqual(store2.listEvents().length, 2);

// 8) removeDevice
assert.strictEqual(store.removeDevice('10.0.0.1'), true);
assert.strictEqual(store.removeDevice('10.0.0.1'), false, 'second remove is no-op');
assert.strictEqual(store.listDevices().length, 1);

console.log('ALL STORE TESTS PASSED  ✔');
