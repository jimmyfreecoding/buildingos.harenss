#!/bin/bash
# 网络健康体检 —— 在 DSH 容器里执行
#
# 两步：
#   1. 采集：网关延迟采样 + 全网段活动主机发现（确定性、不花 AI 的钱）
#   2. 分析：把事实交给 DSH 一次性任务，让它出结论和建议（花 AI 的钱）
#
# ⚠ 为什么不用 `nmap -sn` 做发现：
#   在 Docker Desktop 的 bridge 网络里，nmap -sn 会把整个 /24 报成"全部在线"
#   （连 .0 网络地址和 .255 广播地址都算上）。原因是 nmap 除了 ICMP 还发
#   TCP SYN，这些包被宿主机的 NAT 回了响应，于是被判为存活。
#   纯 ICMP ping 在同一环境里行为是正确的（不存在的地址 100% 丢包）。
#   所以这里用并发 ping 扫描。
#
# 输出：一个 JSON，前端直接渲染。
set -u

SEGMENT="${NETOPS_SEGMENT:-10.0.0.0/24}"
GATEWAY="${NETOPS_GATEWAY:-10.0.0.1}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# 只支持 /24（第一版够用）：10.0.0.0/24 -> "10.0.0."
PREFIX=$(echo "$SEGMENT" | cut -d/ -f1 | awk -F. '{print $1"."$2"."$3"."}')

echo "[体检] 采集 $SEGMENT ..." >&2

# ── 1. 网关延迟采样 ────────────────────────────────────────────
ping -c 10 -i 0.2 -W 1 "$GATEWAY" > "$TMP/ping.txt" 2>&1 || true

GW_RTT=$(grep -oE 'rtt min/avg/max/mdev = [0-9./]+' "$TMP/ping.txt" | head -1 | sed 's/.*= //')
GW_LOSS=$(grep -oE '[0-9]+% packet loss' "$TMP/ping.txt" | head -1)
[ -z "$GW_RTT" ] && GW_RTT="无响应"
[ -z "$GW_LOSS" ] && GW_LOSS="100% packet loss"

# ── 2. 活动主机发现：并发 ping（每批 60 个）─────────────────────
echo "[体检] 扫描网段（并发 ping）..." >&2
: > "$TMP/up.txt"
batch=0
for i in $(seq 1 254); do
  ip="${PREFIX}${i}"
  (
    if ping -c 1 -W 1 "$ip" > /dev/null 2>&1; then echo "$ip"; fi
  ) >> "$TMP/up.txt" &
  batch=$((batch + 1))
  if [ $((batch % 60)) -eq 0 ]; then wait; fi
done
wait

# 注意 paste -d 接的是【分隔符列表】，会在其中轮流取用。
# 写 `-d', '` 会变成「逗号、空格、逗号、空格…」交替，把两个 IP 连成一行。
HOST_LIST=$(sort -t. -k4 -n "$TMP/up.txt" | paste -sd, -)
HOSTS=$(wc -l < "$TMP/up.txt" | tr -d ' ')

echo "[体检] 发现 $HOSTS 台在线主机，交给 AI 分析..." >&2

# ── 3. 组装事实 ────────────────────────────────────────────────
python3 - "$SEGMENT" "$GATEWAY" "$GW_RTT" "$GW_LOSS" "$HOSTS" "$HOST_LIST" > "$TMP/facts.json" <<'PY'
import json, sys
seg, gw, rtt, loss, hosts, host_list = sys.argv[1:7]
json.dump({
    "segment": seg,
    "gateway": gw,
    "gateway_rtt": rtt,
    "gateway_loss": loss,
    "live_hosts": int(hosts or 0),
    "host_list": [h.strip() for h in host_list.split(',') if h.strip()],
    "scan_method": "并发 ICMP ping（每批 60，单次超时 1 秒）",
}, sys.stdout, ensure_ascii=False, indent=2)
PY

# ── 4. 让 DSH 分析 ─────────────────────────────────────────────
cat > "$TMP/prompt.txt" <<EOF
你是网络运维专家。下面是对一个局域网刚做完的基础体检事实（JSON）。

只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释文字。格式：
{
  "score": 0 到 100 的整数健康分,
  "summary": "一句话结论",
  "findings": [ { "severity": "p1|p2|p3|info", "title": "简短标题", "detail": "依据" } ],
  "suggestions": [ "按优先级排序的行动建议" ]
}

判断依据要落在给的事实上，不要编造没采集到的数据。事实本身有限时，
请在 summary 里说明本次只做了连通性体检，未采集无线质量/流量/配置。

事实：
$(cat "$TMP/facts.json")
EOF

dsh --profile headless "$(cat "$TMP/prompt.txt")" > "$TMP/raw.txt" 2>/dev/null || true

# ── 5. 合并输出 ────────────────────────────────────────────────
python3 /opt/netops/bin/assemble.py "$TMP"
