'use strict';

/**
 * M2 发现引擎单测：node tests/discovery.test.js
 * 覆盖：ARP 解析 / 随机 MAC / OUI / 设备分类 / 真实端口探测（网关 443 开、22 关）
 */

const assert = require('assert');
const { parseArpTable, isRandomMac, lookupOui, classifyDevice, probePort } = require('../engines/discovery');

// ---- 1) ARP 解析（Windows 真实样本 + Linux 样本）----
const winArp = `
Interface: 10.0.0.232 --- 0x7
  Internet Address      Physical Address      Type
  10.0.0.1              f8-d0-0e-a6-5e-27     dynamic
  10.0.0.94             e0-d3-62-b9-d3-0d     dynamic
  10.0.0.209            3c-6a-d2-76-e3-20     dynamic
  10.0.0.33             46-76-f8-b8-ed-c4     dynamic
  10.0.0.255            ff-ff-ff-ff-ff-ff     static
  224.0.0.22            01-00-5e-00-00-16     static
`;
const rows = parseArpTable(winArp);
assert.strictEqual(rows.length, 4, 'filters broadcast/multicast, keeps 4 hosts');
const gw = rows.find((r) => r.ip === '10.0.0.1');
assert.strictEqual(gw.vendor, 'Vantiva (Xfinity)');
assert.strictEqual(gw.randomMac, false);
const cam = rows.find((r) => r.ip === '10.0.0.94');
assert.strictEqual(cam.vendor, 'TP-Link');

const linuxNeigh = `
10.0.0.1 dev eth0 lladdr f8:d0:0e:a6:5e:27 REACHABLE
10.0.0.105 dev eth0 lladdr 60:e3:2b:c8:0f:91 STALE
`;
const lrows = parseArpTable(linuxNeigh);
assert.strictEqual(lrows.length, 2, 'parses ip neigh format');

// ---- 2) 随机 MAC ----
assert.strictEqual(isRandomMac('46-76-f8-b8-ed-c4'), true, '0x46 has local bit');
assert.strictEqual(isRandomMac('72-aa-0e-60-7a-10'), true, '0x72 has local bit');
assert.strictEqual(isRandomMac('e0-d3-62-b9-d3-0d'), false, '0xE0 no local bit');
assert.strictEqual(isRandomMac('cc-5e-f8-5c-d4-e1'), false);

// ---- 3) OUI ----
assert.strictEqual(lookupOui('08:54:11:b6:c5:47'), 'Hikvision');
assert.strictEqual(lookupOui('a0:48:1c:9c:a9:34'), 'Hewlett Packard');
assert.strictEqual(lookupOui('aa:bb:cc:00:00:01'), 'Unknown');

// ---- 4) 设备分类 ----
assert.strictEqual(classifyDevice({ ports: { 554: true } }), 'camera');
assert.strictEqual(classifyDevice({ randomMac: true }), 'phone_or_laptop');
assert.strictEqual(classifyDevice({ vendor: 'Hikvision' }), 'camera');
assert.strictEqual(classifyDevice({ vendor: 'Vantiva (Xfinity)', ports: { 80: true } }), 'router');
assert.strictEqual(classifyDevice({ vendor: 'Hewlett Packard' }), 'printer');

// ---- 5) 真实端口探测（本机网关，来自 11 文档实测：443 开 / 22 关）----
async function portProbe() {
  const open = await probePort('10.0.0.1', 443, 2000);
  assert.strictEqual(open, true, 'gateway 443 open');
  const closed = await probePort('10.0.0.1', 22, 2000);
  assert.strictEqual(closed, false, 'gateway 22 closed');
  console.log('REAL PORT PROBE OK  (10.0.0.1:443 open, 22 closed)');
}

portProbe().then(() => {
  console.log('ALL DISCOVERY TESTS PASSED  ✔');
}).catch((e) => { console.error(e); process.exit(1); });
