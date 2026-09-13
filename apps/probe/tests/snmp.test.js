'use strict';

/**
 * M3 SNMP 引擎单测：node tests/snmp.test.js
 * 覆盖：walk 行解析 / LLDP 邻居 / CAM 表 / IF 表 / PoE（全部用代表性样例输出）
 */

const assert = require('assert');
const {
  parseWalkLine,
  parseWalk,
  parseLldpNeighbors,
  parseCamTable,
  parseIfTable,
  parsePoePorts,
  hexStringToAscii,
} = require('../engines/snmp');

// ---- 1) walk 行解析 ----
const line = parseWalkLine('.1.3.6.1.2.1.2.2.1.2.1 = STRING: GigabitEthernet1/0/1');
assert.strictEqual(line.oid, '.1.3.6.1.2.1.2.2.1.2.1');
assert.strictEqual(line.type, 'STRING');
assert.strictEqual(line.value, 'GigabitEthernet1/0/1');
assert.strictEqual(parseWalkLine('garbage line'), null);
assert.strictEqual(parseWalkLine(''), null);

// Hex-STRING 转 ASCII
assert.strictEqual(hexStringToAscii('30 30 30 43 30 30 45 32'), '000C00E2');

// ---- 2) LLDP 邻居（lldpRemTable）----
const lldpText = [
  '.1.0.8802.1.1.2.1.4.1.1.4.2.1 = INTEGER: 4',
  '.1.0.8802.1.1.2.1.4.1.1.5.2.1 = Hex-STRING: 30 30 30 43 30 30 45 32',
  '.1.0.8802.1.1.2.1.4.1.1.6.2.1 = INTEGER: 5',
  '.1.0.8802.1.1.2.1.4.1.1.7.2.1 = STRING: GigabitEthernet1/0/2',
  '.1.0.8802.1.1.2.1.4.1.1.8.2.1 = STRING: Access Point',
  '.1.0.8802.1.1.2.1.4.1.1.9.2.1 = STRING: ap-warehouse',
  '.1.0.8802.1.1.2.1.4.1.1.5.3.1 = Hex-STRING: E0 D3 62 B9 D3 0D',
].join('\n');
const lldp = parseLldpNeighbors(parseWalk(lldpText));
assert.strictEqual(lldp.length, 2, 'two LLDP neighbors');
const n1 = lldp.find((r) => r.localPort === 2);
assert.strictEqual(n1.sysName, 'ap-warehouse');
assert.strictEqual(n1.portId, 'GigabitEthernet1/0/2');
const n2 = lldp.find((r) => r.localPort === 3);
assert.strictEqual(n2.chassisId, 'e0d362b9d30d', 'chassis hex normalized');

// ---- 3) CAM 表（dot1dTpFdbTable）----
const camText = [
  '.1.3.6.1.2.1.17.4.3.1.1.0.224.211.98.185.211.13 = INTEGER: 5',
  '.1.3.6.1.2.1.17.4.3.1.1.0.8.84.17.182.197.71 = INTEGER: 7',
  '.1.3.6.1.2.1.17.4.3.1.2.0.224.211.98.185.211.13 = INTEGER: 3',
].join('\n');
const cam = parseCamTable(parseWalk(camText));
assert.strictEqual(cam.length, 2, 'two CAM entries (field .1 only)');
assert.deepStrictEqual(cam[0], { mac: '00e0d362b9d30d', port: 5 });

// ---- 4) IF 表 ----
const ifText = [
  '.1.3.6.1.2.1.2.2.1.2.1 = STRING: Gi1/0/1',
  '.1.3.6.1.2.1.2.2.1.7.1 = INTEGER: 1',
  '.1.3.6.1.2.1.2.2.1.8.1 = INTEGER: 1',
  '.1.3.6.1.2.1.2.2.1.5.1 = Gauge32: 1000000000',
  '.1.3.6.1.2.1.2.2.1.14.1 = Counter32: 7',
].join('\n');
const ift = parseIfTable(parseWalk(ifText));
assert.strictEqual(ift.length, 1);
assert.strictEqual(ift[0].name, 'Gi1/0/1');
assert.strictEqual(ift[0].status, 1);
assert.strictEqual(ift[0].speed, 1000000000);
assert.strictEqual(ift[0].inErrors, 7);

// ---- 5) PoE ----
const poeText = [
  '.1.3.6.1.2.1.105.1.1.1.1.5 = INTEGER: 1',
  '.1.3.6.1.2.1.105.1.1.1.2.5 = INTEGER: 1',
  '.1.3.6.1.2.1.105.1.1.1.5.5 = Gauge32: 8900',
].join('\n');
const poe = parsePoePorts(parseWalk(poeText));
assert.strictEqual(poe.length, 1);
assert.strictEqual(poe[0].port, 5);
assert.strictEqual(poe[0].adminEnable, 1);
assert.strictEqual(poe[0].powerMilliwatts, 8900);

console.log('ALL SNMP TESTS PASSED  ✔');
