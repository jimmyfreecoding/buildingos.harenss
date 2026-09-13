'use strict';

/**
 * M4 CCTV 引擎：RTSP URL 启发式、ffprobe 码流解析、黑屏/静态帧检测（signalstats）
 * 纯 Node 模块。ffprobe/ffmpeg 执行由调用方注入。
 */

/** 常见摄像头 RTSP 路径（按品牌/通用排序，探测时逐个尝试直到可用） */
function buildRtspCandidates(host, port = 554, overrides = []) {
  const p = String(port)
  const base = `rtsp://${host}:${p}`
  const defaults = [
    `${base}/`,
    `${base}/stream1`,
    `${base}/stream2`,
    `${base}/live/ch0`,
    `${base}/live/ch1`,
    `${base}/h264/ch1/main/av_stream`,
    `${base}/h264/ch1/sub/av_stream`,
    `${base}/streaming/channels/101`,
    `${base}/onvif1`,
    `${base}/cam/realmonitor?channel=1&subtype=0`,
  ]
  return [...new Set([...overrides, ...defaults])]
}

/**
 * 解析 ffprobe `-show_streams -show_format` JSON。
 * 返回 { ok, streams:[...], format, video?, issues[] }
 */
function parseFfprobe(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json
    const streams = Array.isArray(data.streams) ? data.streams : []
    const format = data.format || {}
    const video = streams.find((s) => s.codec_type === 'video') || null
    const issues = []
    if (!video) issues.push('no_video_stream')
    else {
      if (!video.width || !video.height) issues.push('no_resolution')
      const fps = parseFps(video.avg_frame_rate || video.r_frame_rate)
      if (fps !== null && fps < 1) issues.push('fps_too_low')
    }
    return {
      ok: issues.length === 0,
      issues,
      streams: streams.map((s) => ({
        codec_type: s.codec_type,
        codec_name: s.codec_name,
        width: s.width,
        height: s.height,
        avg_frame_rate: s.avg_frame_rate,
        bit_rate: s.bit_rate,
      })),
      format: {
        duration: Number(format.duration) || null,
        bit_rate: Number(format.bit_rate) || null,
      },
      video: video
        ? {
            codec_name: video.codec_name,
            width: video.width,
            height: video.height,
            avg_frame_rate: video.avg_frame_rate,
            bit_rate: video.bit_rate,
          }
        : null,
    }
  } catch (e) {
    return { ok: false, issues: ['parse_error'], streams: [], format: {}, video: null, error: String(e) }
  }
}

/** "30000/1001" → 29.97；"25/1" → 25；异常返回 null */
function parseFps(expr) {
  if (!expr) return null
  const m = String(expr).match(/^(\d+)\/(\d+)$/)
  if (!m) return null
  const d = Number(m[2])
  if (d === 0) return null
  const v = Number(m[1]) / d
  return v > 0 && Number.isFinite(v) ? Math.round(v * 100) / 100 : null
}

/**
 * 解析 ffmpeg signalstats 输出（metadata=print 文本）。
 * 例：lavfi.signalstats.YAVG=8.123456  lavfi.signalstats.YMAX=255
 * 返回 { yavg, ymax, ymin, satavg } | null
 */
function parseSignalStats(text) {
  const grab = (key) => {
    const m = String(text || '').match(new RegExp(`lavfi\\.signalstats\\.${key}=([\\d.]+)`))
    return m ? Number(m[1]) : null
  }
  const yavg = grab('YAVG')
  if (yavg === null) return null
  return { yavg, ymax: grab('YMAX'), ymin: grab('YMIN'), satavg: grab('SATAVG') }
}

/** 黑屏判定：YAVG 低于阈值视为黑帧 */
function isBlackFrame(stats, threshold = 10) {
  return stats !== null && stats.yavg !== null && stats.yavg < threshold
}

/** 静态帧判定（疑似冻结）：YAVG 连续两次几乎不变（外部比对 yavg 差值） */
function isStaticFrame(prevYavg, curYavg, delta = 0.5) {
  if (prevYavg === null || curYavg === null) return false
  return Math.abs(prevYavg - curYavg) <= delta
}

module.exports = {
  buildRtspCandidates,
  parseFfprobe,
  parseFps,
  parseSignalStats,
  isBlackFrame,
  isStaticFrame,
}
