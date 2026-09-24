# 接口契约（CONTRACTS）

> 这些是**冻结的边界**。改任何一个都要同步改 `packages/contracts`。
>
> **2026-09-24 修订**（IOC TECH-PLAN 8.8）：B 节工具头增加 `domain`、`level`；C 节改为多域 harness-gateway，新增 C4（gateway ↔ DSH）；新增 F 节（具名查询）。

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
domain: netops            # 2026-09-24 新增：所属业务域（ioc / iot / netops），注册器按域加载
level: read               # 2026-09-24 新增：read | draft | write；M0–M2 与 iot 域只允许 read
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

## C · harness-gateway（调用方 ↔ harness）

> 2026-09-24 修订：原「harness-service」改为多域的 **harness-gateway**（端口 8090，新分配）。
> 调用方：buildingos/apps/ioc（domain=ioc）、netops-api（domain=netops）、以后的 iot 服务（domain=iot）。
> 所有请求增加 `domain` 字段；gateway 按 domain 路由到对应的 DSH 容器。

### C1 任务（批处理，非交互）

```
POST /v1/tasks
{
  "domain": "netops" | "iot" | "ioc",
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
   // artifact.kind（2026-09-24 扩充）：tool_source | finding | query | ioc.patch | ioc.block
   // 每个事件带单调递增的 seq；?since=<seq> 断线续接（gateway 记录事件日志，见 C4）

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
{ "domain": "ioc", "auth_ctx": { "user_id": "7", "project_id": "demo", "draft_id": "d1", "ops": ["read", "draft"] } }
// auth_ctx 由调用方给出，gateway 据此为该会话签发会话 token（见 C4），模型不可见
POST /v1/sessions/{id}/messages
{
  "text": "这台为什么卡？",
  "page_context": { "page": "topology", "selected": { "node_id": "e0:d3:62:b9:b9:87" } }
}
→ 202
WS   /v1/sessions/{id}/stream           // 事件同 C1
POST   /v1/sessions/{id}/cancel         → 202（结束该会话的运行时进程，已产生事件保留）
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

### C4 gateway ↔ DSH（2026-09-24 新增，V0-4 验证）

- 运行方式：gateway 为每个 AI 会话启动一个 DSH **SDK 运行时**进程（`dsh --profile sdk` + 该域的 patch），
  通过 stdio 上的 JSON-RPC 通信。只用三个方法：`initialize`、`session/prompt`、`shutdown`；
  通知：`session.event`（带 `seq` 的事件）、`session.status`（`idle` 表示一轮结束）。
- 会话 token：gateway 生成绑定 `auth_ctx` 的短期 token（15 分钟，可续期），写入该进程专用的 secrets 文件；
  profile 中 `@deepseek-ai/dsh-mcp-client` 的 `headers` 启动时读取。MCP 调用不携带会话标识（实测），
  因此由「一个会话一个进程 + 进程级 token」完成绑定。
- 取消：结束进程。续接：gateway 按 `seq` 记录事件日志，给调用方补发；进程重启后以新会话 + 前情摘要继续。
- 资源：单进程约 1.4 s 启动、约 315 MB 常驻（V0-4 实测），按内存设并发上限并排队（D13）。
- MCP 端点不可用时，profile 设 `failOnStartupError: true`，运行时启动失败并返回明确错误，不静默降级。

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

---

## F · 具名查询（2026-09-24 新增，iot / netops 共用）

**AI 不写 SQL。** 查询模板在领域数据服务里注册；AI 和页面只引用模板 id 并填参数。

### F1 模板注册（领域服务内部）

```json
{
  "id": "device.list",
  "domain": "netops",
  "description": "按网段列出设备",
  "params":  { "type": "object", "properties": { "cidr": { "type": "string" } }, "required": ["cidr"] },
  "result":  { "type": "array", "items": { "type": "object" } },
  "permission": "netops:read",
  "limits":  { "rows": 5000, "timeoutMs": 5000, "maxRange": "90d" },
  "cacheTtl": "30s",
  "subscribe": false,
  "offline": "snapshot"
}
```

### F2 目录与执行（领域服务对 apps/ioc 暴露）

```
GET  /catalog/queries                    → 模板目录（apps/ioc 转给 get_catalog 与 studio）
POST /query/run  { template, params }    → { rows, schema, executedAt }
GET  /query/subscribe?template=&params=  → SSE（仅 subscribe=true 的模板）
```

错误码：`E_PARAM`、`E_FORBIDDEN`、`E_LIMIT`、`E_TIMEOUT`、`E_UPSTREAM`。
领域授权在领域服务内完成；apps/ioc 只校验 AuthCtx 并代理（`POST /ioc/query/run`，见 apps/ioc `docs/openapi.yaml`）。

### F3 页面里的引用（ioc 侧，见 @buildingos/ioc-contracts 的 `query-ref.v1`）

```json
{ "domain": "netops", "template": "device.list", "params": { "cidr": "10.0.0.0/24" }, "refresh": "60s" }
```

导出离线包时每个引用执行一次，结果冻结为 `snapshot`，并记录执行时间。
