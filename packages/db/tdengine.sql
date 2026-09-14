-- NetOps 时序 schema（TDengine 3.x）
--
-- ⚠ taos -f 是【逐行执行】的：一条 SQL 必须写在一行里，不能跨行。
--
-- 保留策略：原始 30 天 → 1 分钟 1 年 → 1 小时 3 年。

CREATE DATABASE IF NOT EXISTS netops PRECISION 'ms' KEEP 3650 DURATION 10 WAL_LEVEL 1;

USE netops;

CREATE STABLE IF NOT EXISTS metric (ts TIMESTAMP, val DOUBLE) TAGS (site BINARY(64), node_id BINARY(64), metric BINARY(64), unit BINARY(16));

-- 列名用 val 而不是 value：VALUE 是 TDengine 保留字，直接当列名会报
-- syntax error near "value double"。这里不引号包裹，是为了后续所有 SQL 都不用反引号。
-- 对外 JSON（探针事实、接口返回值）里仍然叫 value，由后端做一次映射。

-- metric 命名约定（约定，不是约束）：
--   icmp.rtt.avg / icmp.rtt.max / icmp.rtt.jitter / icmp.loss
--   tcp.<port>.rtt.avg / rtsp.options.rtt.jitter / rtsp.bitrate.kbps / rtsp.frame_loss
--   wifi.channel.util / wifi.bss.count / wifi.client.rssi / wifi.client.retry
--   snmp.if.in_errors / snmp.if.out_discards / snmp.if.crc / snmp.if.duplex_mismatch
--   cctv.health.score / cctv.recording.gap_s / video.experience.score
--   probe.cpu / probe.mem
--
-- 降采样表由 worker 定时聚合写入（不用流计算，便于回放与重建）：
--   metric_1m  1 分钟粒度，保留 1 年
--   metric_1h  1 小时粒度，保留 3 年
