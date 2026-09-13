'use strict';

/**
 * M4 CCTV 引擎单测：node tests/cctv.test.js
 * 覆盖：RTSP URL 候选 / ffprobe JSON 解析 / 帧率解析 / signalstats 黑屏判定
 */

const assert = require('assert');
const {
  buildRtspCandidates,
  parseFfprobe,
  parseFps,
  parseSignalStats,
  isBlackFrame,
  isStaticFrame,
} = require('../engines/cctv');

// ---- 1) RTSP 候选 ----
const cands = buildRtspCandidates('10.0.0.94');
assert(cands.includes('rtsp://10.0.0.94:554/stream1'), 'tapo style path');
assert(cands.includes('rtsp://10.0.0.94:554/streaming/channels/101'), 'hikvision style path');
assert.strictEqual(cands[0], 'rtsp://10.0.0.94:554/', 'bare first');

// ---- 2) ffprobe JSON（模拟海康 1080p）----
const probeJson = {
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, avg_frame_rate: '30000/1001', bit_rate: '4096000' },
    { codec_type: 'audio', codec_name: 'aac', bit_rate: '128000' },
  ],
  format: { duration: '0.040000', bit_rate: '4224000' },
};
const parsed = parseFfprobe(probeJson);
assert.strictEqual(parsed.ok, true);
assert.strictEqual(parsed.video.width, 1920);
assert.strictEqual(parsed.video.height, 1080);
assert.strictEqual(parsed.format.duration, 0.04);
assert.strictEqual(parsed.issues.length, 0);

// 无视频流 → 异常
const noVideo = parseFfprobe({ streams: [], format: {} });
assert.strictEqual(noVideo.ok, false);
assert(noVideo.issues.includes('no_video_stream'));

// 坏 JSON
const bad = parseFfprobe('not json');
assert.strictEqual(bad.ok, false);
assert(bad.issues.includes('parse_error'));

// ---- 3) 帧率 ----
assert.strictEqual(parseFps('30000/1001'), 29.97);
assert.strictEqual(parseFps('25/1'), 25);
assert.strictEqual(parseFps(null), null);
assert.strictEqual(parseFps('0/1'), null);

// ---- 4) signalstats 黑屏 ----
const dark = parseSignalStats('frame:0    pts:0     pts_time:0\nlavfi.signalstats.YAVG=6.5123 lavfi.signalstats.YMAX=32 lavfi.signalstats.YMIN=0 lavfi.signalstats.SATAVG=1.2');
assert(dark && typeof dark.yavg === 'number');
assert.strictEqual(isBlackFrame(dark), true, 'YAVG=6.5 → black');
const bright = parseSignalStats('lavfi.signalstats.YAVG=128.4');
assert.strictEqual(isBlackFrame(bright), false, 'YAVG=128 → normal');

// ---- 5) 静态帧 ----
assert.strictEqual(isStaticFrame(128.4, 128.4), true);
assert.strictEqual(isStaticFrame(128.4, 90.0), false);
assert.strictEqual(isStaticFrame(null, 128.4), false);

console.log('ALL CCTV TESTS PASSED  ✔');
