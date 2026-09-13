-- NetOps 时序 schema（TDengine 3.x）
-- 一个超表按 metric 打标签；保留策略：原始 30 天 → 1 分钟 1 年 → 1 小时 3 年。

CREATE DATABASE IF NOT EXISTS netops
  PRECISION 'ms'
  KEEP 3650
  DURATION 10
  WAL_LEVEL 1;

USE netops;

CREATE STABLE IF NOT EXISTS metric (
  ts        TIMESTAMP,
  value     DOUBLE
) TAGS (
  site      BINARY(64),
  node_id   BINARY(64),
  metric    BINARY(64),
  unit      BINARY(16)
);

-- 建议的 metric 命名（约定，不是约束）
--   icmp.rtt.avg | icmp.rtt.max | icmp.rtt.jitter | icmp.loss
--   tcp.<port>.rtt.avg | rtsp.options.rtt.jitter | rtsp.bitrate.kbps | rtsp.frame_loss
--   wifi.channel.util | wifi.bss.count | wifi.client.rssi | wifi.client.retry
--   snmp.if.in_errors | snmp.if.out_discards | snmp.if.crc | snmp.if.duplex_mismatch
--   cctv.health.score | cctv.recording.gap_s
--   video.experience.score
--   probe.cpu | probe.mem

-- 降采样（由 worker 定时执行，非 TDengine 流计算，便于回放与重建）
-- CREATE STABLE metric_1m ... 由 worker 从 metric 聚合写入
-- CREATE STABLE metric_1h ... 同上
