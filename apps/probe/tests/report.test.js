'use strict';

/**
 * M7 报告引擎单测：node tests/report.test.js
 * 覆盖：健康评分（掉线/黑屏/端口错误扣分）/ 日报模板 / 诊断报告模板
 */

const assert = require('assert');
const { computeHealth, renderDailyReport, renderDiagnosticReport } = require('../engines/report');

// ---- 1) 全健康 ----
const all = computeHealth({
  devices: [
    { type: 'router', status: 'online' },
    { type: 'camera', status: 'online' },
    { type: 'camera', status: 'online' },
    { type: 'computer', status: 'online' },
  ],
  events: [],
});
assert.strictEqual(all.overall, 100);
assert.strictEqual(all.network, 100);
assert.strictEqual(all.security, 100);

// ---- 2) 掉线摄像头 + 黑屏 + 端口错误 → 扣分 ----
const bad = computeHealth({
  devices: [
    { type: 'router', status: 'online' },
    { type: 'camera', status: 'offline' },
    { type: 'camera', status: 'online' },
    { type: 'computer', status: 'offline' },
  ],
  events: [{ level: 'P2', kind: 'device_down' }],
  blackFrames: 1,
  portErrorPorts: ['Gi1/0/3'],
});
assert(bad.overall < 100, 'issues reduce overall');
assert(bad.network < 100, 'offline reduces network');
assert(bad.security < 100, 'offline camera + black reduces security');
assert(bad.issues.length >= 3, 'issues collected');

// ---- 3) 日报模板 ----
const daily = renderDailyReport({
  site: 'Test Warehouse',
  date: new Date('2026-08-18T00:00:00Z'),
  health: all,
  deviceCount: 4,
  eventCount: 2,
  tips: ['NVR 存储已用 78%，建议扩容。'],
});
assert(daily.includes('Test Warehouse'));
assert(daily.includes('2026-08-18'));
assert(daily.includes('整体健康分：100 / 100'));
assert(daily.includes('AI 小贴士'));
assert(daily.includes('NVR 存储'));

// ---- 4) 诊断报告模板 ----
const diag = renderDiagnosticReport({
  site: 'Test Warehouse',
  devices: [
    { ip: '10.0.0.1', mac: 'f8:d0:0e:a6:5e:27', vendor: 'Vantiva', type: 'router', randomMac: false },
    { ip: '10.0.0.94', mac: 'e0:d3:62:b9:d3:0d', vendor: 'TP-Link', type: 'camera', randomMac: false },
  ],
  events: [{ level: 'P2', kind: 'device_down' }],
  health: bad,
  topologySummary: { links: 2, sources: { lldp: 0, cam: 0, arp: 2 } },
});
assert(diag.includes('执行摘要'));
assert(diag.includes('资产清单'));
assert(diag.includes('10.0.0.94'));
assert(diag.includes('拓扑摘要'));
assert(diag.includes('事件统计'));
assert(diag.includes('隐患清单'));
assert(diag.includes('升级建议'));

console.log('ALL REPORT TESTS PASSED  ✔');
