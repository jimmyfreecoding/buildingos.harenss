'use strict';

/**
 * M5 拓扑构建单测：node tests/topology.test.js
 * 覆盖：LLDP 高置信链路 / CAM 交叉 / ARP 星型降级 / 真实摸盘数据
 */

const assert = require('assert');
const { buildTopology, inferNodeType } = require('../engines/topology');

// ---- 1) 类型推断 ----
assert.strictEqual(inferNodeType({ ports: { 554: true } }), 'camera');
assert.strictEqual(inferNodeType({ randomMac: true }), 'phone_or_laptop');
assert.strictEqual(inferNodeType({ vendor: 'Vantiva (Xfinity)' }), 'router');
assert.strictEqual(inferNodeType({ vendor: 'Hikvision' }), 'camera');
assert.strictEqual(inferNodeType({ vendor: 'New H3C' }), 'network_device');

// ---- 2) 合成数据：LLDP + CAM + ARP 三源交叉 ----
const devices = [
  { ip: '10.0.0.1', mac: 'f8:d0:0e:a6:5e:27', vendor: 'Vantiva (Xfinity)' },
  { ip: '10.0.0.94', mac: 'e0:d3:62:b9:d3:0d', vendor: 'TP-Link', ports: { 554: true } },
  { ip: '10.0.0.119', mac: '08:54:11:b6:c5:47', vendor: 'Hikvision' },
  { ip: '10.0.0.251', mac: 'a0:48:1c:9c:a9:34', vendor: 'Hewlett Packard' },
];
const lldp = [
  { localPort: 5, chassisId: 'e0d362b9d30d', portId: 'Gi1/0/2', sysName: 'cam-east' },
];
const cam = [
  { mac: 'e0d362b9d30d', port: 5 },
  { mac: '085411b6c547', port: 7 },
];
const topo = buildTopology({ devices, lldp, cam, gatewayIp: '10.0.0.1' });

assert.strictEqual(topo.nodes.length, 4);
const camNode = topo.nodes.find((n) => n.mac === 'e0:d3:62:b9:d3:0d');
assert.strictEqual(camNode.confidence, 'high', 'LLDP+CAM → high');
assert(camNode.sources.includes('lldp') && camNode.sources.includes('cam'));

const camLinks = topo.links.filter((l) => l.target === camNode.id);
assert(camLinks.some((l) => l.via === 'lldp' && l.localPort === 5 && l.confidence === 'high'), 'lldp link high');
assert(camLinks.some((l) => l.via === 'cam' && l.localPort === 5), 'cam link');

const hik = topo.nodes.find((n) => n.mac === '08:54:11:b6:c5:47');
assert(topo.links.some((l) => l.target === hik.id && l.via === 'cam' && l.confidence === 'medium'), 'cam-only medium');

// ARP 星型：HP 打印机挂网关
const hp = topo.nodes.find((n) => n.mac === 'a0:48:1c:9c:a9:34');
const gwNode = topo.nodes.find((n) => n.ip === '10.0.0.1');
assert(topo.links.some((l) => l.source === gwNode.id && l.target === hp.id && l.via === 'arp' && l.confidence === 'medium'), 'arp star link');
assert.strictEqual(topo.gateway.id, gwNode.id);

// ---- 3) 纯 ARP（无 LLDP/CAM）：全星型 medium，如实标注 ----
const arpOnly = buildTopology({ devices, lldp: [], cam: [], gatewayIp: '10.0.0.1' });
assert.strictEqual(arpOnly.links.length, 3, '3 arp links (all non-gateway)');
assert(arpOnly.links.every((l) => l.via === 'arp' && l.confidence === 'medium'));
assert.deepStrictEqual(arpOnly.sources, { lldp: 0, cam: 0, arp: 4 });

console.log('ALL TOPOLOGY TESTS PASSED  ✔');
