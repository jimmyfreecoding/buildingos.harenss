# 接口契约（CONTRACTS）

> 这些是**冻结的边界**。改任何一个都要同步改 `packages/contracts`。

---

## A · 探针事实（probe → MQTT）

一轮采集 = 一个 `run`，批量发布。

```json
{
  "run_id": "2026-09-10T11:02:00Z/probe-01",
  "site": "home-01",
  "probe": { "id": "probe-01", "iface": "eth0", "ip": "10.0.0.236", "privilege": "root" },
  "facts": [ /* 见下 */ ],
  "errors": [ { "stage": "snmp", "target": "10.0.0.204", "message": "..." } ]
}
```

事实类型（`kind`）：

| kind | 关键字段 | 说明 |
|---|---|---|
| `host` | node_id, ip, vendor, model, role, confidence, evidence[] | 设备 |
| `link` | a, b, medium, band, channel, confidence, evidence[] | 链路 |
| `service` | node_id, port, proto, service, banner | 服务 |
| `metric` | node_id, metric, value, unit, window_s | 指标 |
| `capability` | metric, value, expected, verdict | 自检结果 |
| `config` | node_id, source, normalized_hash, payload_ref | 配置快照 |

`confidence` 必填（0–1）。探针只给候选事实，人工确认后写回。

---

## B · 工具约定（模型造工具 → DSH）

**一个 Python 文件 = 一个工具。零魔法。**

```
harness/toolbox/h3c_get_channel.py
```

```python
"""@tool
name: h3c_get_channel
description: 读取 H3C AP 当前 2.4G / 5G 信道
params:
  host: {type: string, required: true, desc: 管理地址}
returns:
  type: object
  properties:
    ch2g: {type: integer}
    ch5g: {type: integer}
"""
import json, sys

def main(args):
    host = args["host"]
    # ... 实际实现 ...
    return {"ch2g": 1, "ch5g": 36}

if __name__ == "__main__":
    args = json.load(sys.stdin)          # 参数从 stdin 进
    print(json.dumps(main(args)))        # 结果从 stdout 出
```

注册器插件（`harness/plugins/toolbox-registrar`）：
1. 扫 `toolbox/*.py` 与 `adapters/*.py`
2. 解析模块 docstring 的 `@tool` 块
3. 注册成 DSH 工具，执行体 = `python3 <path>`，stdin 喂 JSON 参数、stdout 读 JSON 结果
4. 目录变化即重扫（新造的工具**下一步就能调**）

约束：
- 脚本必须**幂等、只读**（M0–M2 阶段）
- 必须自己处理超时（默认 30s），失败时向 stderr 写原因、退出码非零
- 输出必须是**有界**的 JSON（超过 64KB 的列表要聚合或分页）

---

## C · harness-service（api ↔ harness）

### C1 任务（批处理，非交互）

```
POST /v1/tasks
{
  "type": "explain_anomaly" | "draft_change" | "generate_adapter" | "write_report" | "guide",
  "site_id": "home-01",
  "inputs": { ... },                       // 按 type 定义
  "budget": { "max_turns": 12, "max_usd": 0.20 },
  "priority": "interactive" | "batch"
}
→ 202 { "task_id": "tsk_01H...", "status": "queued" }

GET  /v1/tasks/{id}
→ { "task_id", "status": "queued|running|done|failed|cancelled",
    "result": { ... }, "usage": { "tokens": 0, "cost_usd": 0.0 },
    "artifacts": [ { "kind": "tool_source", "path": "toolbox/x.py" } ],
    "error": null }

GET  /v1/tasks/{id}/events?since=<cursor>     // SSE
   event: thinking | tool_call | tool_result | message | artifact | done | error

POST /v1/tasks/{id}/cancel  → 202
```

`type` → 输出 schema 内置在 `harness-service`，调用方不用传。

`explain_anomaly` 的输出：
```json
{
  "root_cause": "2.4GHz ch11 空口拥塞导致摄像头视频重传",
  "confidence": 0.82,
  "evidence": [
    { "kind": "metric",   "ref": "td://metric/node=e0:d3:62:b9:b9:87/icmp.rtt.jitter/1h", "note": "31.6ms" },
    { "kind": "topology", "ref": "pg://devices/e0:d3:62:b9:b9:87", "note": "Wi-Fi 接入" },
    { "kind": "contrast", "ref": "pg://devices/08:54:11:b6:c5:47", "note": "同交换机有线摄像头仅 2.7ms" }
  ],
  "impact": { "affected": ["e0:d3:62:b9:b9:87", "e0:d3:62:b9:d3:0d"], "since": "2026-09-09T18:00:00Z" },
  "actions": [
    { "priority": 1, "action": "把 H3C Geeqee2024 的 5G 从 ch36 改到 ch149", "risk": "medium", "runbook": "h3c-magic-ap#change-wifi-channel-5g" }
  ],
  "excluded": ["网关链路故障（网关 0–3ms 抖动 0.4ms）"]
}
```

### C2 会话（交互 Chat，每个功能页一个）

```
POST /v1/sessions                       → { "session_id": "ses_..." }
POST /v1/sessions/{id}/messages
{
  "text": "这台为什么卡？",
  "page_context": { "page": "topology", "selected": { "node_id": "e0:d3:62:b9:b9:87" } }
}
→ 202
WS   /v1/sessions/{id}/stream           // 事件同 C1
DELETE /v1/sessions/{id}
```

`page_context` 是需求 7 的落点：前端把当前页实体带过来，用户不用重复描述。

### C3 能力自检

```
GET /v1/capabilities
→ { "egress_iface": "eth0", "privileged": true, "raw_socket": true,
    "wlan_monitor": false, "python_tools": 12, "model": "deepseek-chat",
    "verdict": "ok", "degraded": ["wlan_monitor"] }
```

前端在设置页直接渲染这个，用户一眼看到"哪些能力不可用"。

---

## D · MQTT 主题

```
netops/{site}/probe/{probe_id}/fact      探针事实（批量 JSON）
netops/{site}/probe/{probe_id}/status    心跳与自检
netops/{site}/event/finding              生成的 finding
netops/{site}/task/{task_id}/status      任务状态（前端 SSE 之外的旁路）
```

QoS 1，全部 retain=false（事实类不 retain；`status` retain=true）。

---

## E · 结构化结果落库

harness 返回的 `result` 由 `worker` 落 PG：
- `explain_anomaly` → `findings` + `finding_evidence`
- `draft_change` → `changes`（status=`proposed`）
- `write_report` → `reports`（body 存 markdown）
- `generate_adapter` → 写文件到 `toolbox/`，并登记 `tool_artifacts`

**所有 LLM 产出的结论都必须带 `evidence[]`**，否则 `worker` 拒收（保证可审计）。
