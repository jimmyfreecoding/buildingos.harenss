'use strict';

/**
 * 探针 v2 · 链路质量引擎单测：node tests/quality.test.js
 */

const assert = require('assert');
const { spawn } = require('child_process');
const { measure, assessNetwork, parsePingLine, parseWirelessSelfWindows, detectStorm } = require('../engines/quality');

// ---- 1) 合成 pingOnce：确定性验证统计与判定 ----
async function qualityStats() {
  let n = 0;
  const m = await measure({
    ip: '10.0.0.1',
    count: 5,
    pingOnce: async () => {
      n += 1;
      return n <= 4 ? { ok: true, rttMs: 10, ttl: 64 } : { ok: false }; // 1/5 丢包
    },
  });
  assert.strictEqual(m.lossPct, 20, '1 of 5 lost → 20%');
  assert.strictEqual(m.avg, 10);
  assert.strictEqual(m.hops, 0, 'TTL 64 → 0 hops');
  assert.strictEqual(m.verdict, 'poor', 'loss>5% → poor');
  assert.strictEqual(m.weak, true);
  return true;
}

// ---- 2) TTL 跳数提示 ----
async function ttlHops() {
  const m1 = await measure({ ip: 'x', count: 1, pingOnce: async () => ({ ok: true, rttMs: 5, ttl: 127 }) });
  assert.strictEqual(m1.hops, 1, 'TTL 127 (from 128) → 1 hop');
  const m2 = await measure({ ip: 'x', count: 1, pingOnce: async () => ({ ok: true, rttMs: 5, ttl: 63 }) });
  assert.strictEqual(m2.hops, 1, 'TTL 63 (from 64) → 1 hop');
  const m3 = await measure({ ip: 'x', count: 1, pingOnce: async () => ({ ok: true, rttMs: 5, ttl: 117 }) });
  assert.strictEqual(m3.hops, 11, 'TTL 117 → 11 hops');
  return true;
}

// ---- 3) 丢包 0 / 抖动 ----
async function jitter() {
  const m = await measure({ ip: 'x', count: 4, pingOnce: async () => ({ ok: true, rttMs: 10, ttl: 64 }) });
  assert.strictEqual(m.lossPct, 0);
  assert.strictEqual(m.jitter, 0);
  const m2 = await measure({ ip: 'x', count: 4, pingOnce: async () => ({ ok: true, rttMs: 10 + Math.random() * 40, ttl: 64 }) });
  assert(m2.jitter > 0, 'jitter computed');
  return true;
}

// ---- 4) assessNetwork 薄弱环节排序 ----
async function assess() {
  const res = await assessNetwork({
    devices: [
      { ip: '10.0.0.10', vendor: 'A', type: 'camera' },
      { ip: '10.0.0.20', vendor: 'B', type: 'ap' },
      { ip: '10.0.0.30', vendor: 'C', type: 'computer' },
    ],
    gatewayIp: '10.0.0.1',
    count: 3,
    pingOnce: async (ip) => {
      if (ip === '10.0.0.10') return { ok: false };          // 全丢
      if (ip === '10.0.0.20') return { ok: true, rttMs: 5, ttl: 64 };
      return { ok: true, rttMs: 20, ttl: 64 };
    },
  });
  assert.strictEqual(res.weakLinks.length, 1);
  assert.strictEqual(res.weakLinks[0].ip, '10.0.0.10');
  assert.strictEqual(res.summary.weakCount, 1);
  assert.strictEqual(res.gateway.lossPct, 0);
  return true;
}

// ---- 5) Windows ping 行解析 ----
assert.deepStrictEqual(parsePingLine('Reply from 10.0.0.1: bytes=32 time=10ms TTL=64'), { ok: true, rttMs: 10, ttl: 64 });
assert.deepStrictEqual(parsePingLine('Request timed out.'), { ok: false });
assert.strictEqual(parsePingLine('Ping statistics for 10.0.0.1:'), null);

// ---- 6) netsh 无线解析 ----
const wlan = parseWirelessSelfWindows('SSID : geeqee\nBand : 5 GHz\nChannel : 157\nSignal : 63%\nRssi : -73 dBm\nReceive rate (Mbps) : 306.3\nAuthentication : WPA3-Personal');
assert.strictEqual(wlan.ssid, 'geeqee');
assert.strictEqual(wlan.band, '5 GHz');
assert.strictEqual(wlan.signal, '63%');
assert.strictEqual(wlan.rssi, '-73 dBm');
assert.strictEqual(parseWirelessSelfWindows('garbage'), null);

// ---- 7) 风暴检测 ----
const calm = detectStorm({ octetsA: 1e9, octetsB: 1.1e9, discardsA: 0, discardsB: 10, intervalSec: 60 });
assert.strictEqual(calm.storm, false);
const storm = detectStorm({ octetsA: 1e9, octetsB: 4e9, discardsA: 0, discardsB: 5000, intervalSec: 60 });
assert.strictEqual(storm.storm, true, '3GB/60s + 5k discards → storm');
assert(storm.rateMbps > 300);

// ---- 8) 真实网关测量（Windows ping）----
function pingOnceWin(ip) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const child = spawn('ping', ['-n', '1', '-w', '500', ip], { stdio: 'ignore' });
    child.on('error', () => finish({ ok: false }));
    child.on('close', (code) => finish({ ok: code === 0, rttMs: 5, ttl: code === 0 ? 64 : null }));
    setTimeout(() => { try { child.kill(); } catch {} finish({ ok: false }); }, 2000);
  });
}

async function realGateway() {
  const m = await measure({ ip: '10.0.0.1', pingOnce: pingOnceWin, count: 3 });
  assert.strictEqual(m.lossPct, 0, 'gateway reachable');
  assert(m.avg > 0);
  console.log(`REAL GATEWAY QUALITY: loss=${m.lossPct}% avg=${m.avg}ms hops=${m.hops} verdict=${m.verdict}`);
  return true;
}

qualityStats()
  .then(ttlHops)
  .then(jitter)
  .then(assess)
  .then(realGateway)
  .then(() => { console.log('ALL QUALITY TESTS PASSED  ✔'); })
  .catch((e) => { console.error(e); process.exit(1); });
