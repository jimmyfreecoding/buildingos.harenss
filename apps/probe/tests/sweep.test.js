'use strict';

/**
 * M2 扫描链路单测：node tests/sweep.test.js
 * 覆盖：range 推导 / 注入式 execPing / 真实 ping 扫活（Windows）
 */

const assert = require('assert');
const { spawn } = require('child_process');
const { deriveRange, ipList, pingSweep, discoverNetwork } = require('../engines/sweep');
const { parseArpTable } = require('../engines/discovery');

// ---- 1) range 推导 ----
assert.deepStrictEqual(deriveRange('10.0.0.0/24'), { prefix: '10.0.0', range: [1, 254] });
assert.deepStrictEqual(deriveRange('10.0.0'), { prefix: '10.0.0', range: [1, 254] });
assert.deepStrictEqual(deriveRange('10.0.0.7'), { prefix: '10.0.0', range: [7, 7] });
assert.throws(() => deriveRange('10.0.0.0/22'), /unsupported/);
assert.deepStrictEqual(ipList({ prefix: '10.0.0', range: [1, 3] }), ['10.0.0.1', '10.0.0.2', '10.0.0.3']);

// ---- 2) 注入式 execPing（确定性）----
async function sweepFake() {
  const live = await pingSweep('10.0.0', {
    execPing: async (ip) => ip === '10.0.0.1' || ip === '10.0.0.94',
    concurrency: 8,
    range: [1, 100],
  });
  assert.deepStrictEqual(live, ['10.0.0.1', '10.0.0.94']);
  return true;
}

// ---- 3) 真实 ping 扫活（Windows ping，stdio ignore 避免管道捕获）----
function execPingWin(ip) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const child = spawn('ping', ['-n', '1', '-w', '500', ip], { stdio: 'ignore' });
    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
    setTimeout(() => { try { child.kill(); } catch {} finish(false); }, 2500);
  });
}

async function sweepReal() {
  const t0 = Date.now();
  const live = await pingSweep('10.0.0.0/24', { execPing: execPingWin, concurrency: 40 });
  const elapsed = Date.now() - t0;
  assert(live.includes('10.0.0.1'), 'gateway must be live');
  assert(live.length >= 20, `expected >=20 live hosts, got ${live.length}`);
  console.log(`REAL SWEEP OK: ${live.length} live hosts in ${elapsed}ms`);
  return live;
}

// ---- 4) discoverNetwork 全链路（真实扫描 + ARP 解析）----
// 注：两次独立扫活结果会有波动（Windows ICMP 限速/重试），只做下限与关键主机断言
async function networkChain(live) {
  const { execFile } = require('child_process');
  const arpText = await new Promise((resolve) => {
    execFile('arp', ['-a'], { encoding: 'utf8' }, (err, stdout) => resolve(err ? '' : stdout));
  });
  const res = await discoverNetwork('10.0.0.0/24', { execPing: execPingWin, arpText, concurrency: 40 });
  assert(res.liveCount >= 20, `expected >=20 live, got ${res.liveCount}`);
  assert(res.live.includes('10.0.0.1'), 'gateway in live list');
  assert(res.devices.length >= 1, 'parsed at least one ARP device');
  console.log(`CHAIN OK: live=${res.liveCount} arpDevices=${res.arpDevices}`);
  return res;
}

sweepFake()
  .then(sweepReal)
  .then(networkChain)
  .then(() => {
    console.log('ALL SWEEP TESTS PASSED  ✔');
  })
  .catch((e) => { console.error(e); process.exit(1); });
