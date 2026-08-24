---
name: network-diagnose
description: 基于网络遥测诊断交换机/AP 健康度，输出带置信度的结构化结论
metadata:
  short-description: 网络健康诊断
---

# 网络诊断

## 目标

定位目标设备（交换机 / AP）的异常根因，输出**带置信度**的结构化结论与建议动作。

## 触发场景

- 延迟升高（p95 超阈值）
- 丢包率异常
- 端口抖动（flapping）
- 设备离线

## 步骤

1. **查询设备状态**：调用 `mcp://telemetry/query-switch-status`（或 AP 延迟接口），取最近 15 分钟遥测。
2. **关联拓扑**：读取 `topology.yaml`，确认受影响设备的影响面（下联设备、级联链路）。
3. **对照阈值**：按 `references/thresholds.md` 判定严重级别（正常 / 关注 / 严重）。
4. **假设验证**：对每个发现给出根因假设（如光模块劣化、PoE 环路），并用遥测佐证；无法佐证的假设标注低置信度。
5. **报告**：输出结构化 JSON（见下），**禁止编造数据**；置信度低于 0.5 的结论必须显式标注"需人工复核"。

## 输出格式

```json
{
  "type": "diagnosis",
  "devices": ["SW-03"],
  "findings": [
    {
      "metric": "uplink.packet_loss",
      "value": "2.3%",
      "threshold": "2%",
      "severity": "warn",
      "hypothesis": "上行光模块劣化",
      "evidence": ["CRC errors growing"],
      "confidence": 0.71
    }
  ],
  "nextActions": ["检查光模块", "如获授权可重启 PoE 端口"],
  "requiresAuthorization": true
}
```

## 边界

- **只读默认**：本技能只读遥测与拓扑，不执行任何写操作。
- **写操作（如 PoE 端口重启）**：仅在获得用户书面授权（《自愈授权书》）后执行，且每次操作前再次确认。
- 不修改路由器 / 防火墙配置（超出租户权限范围，见 `rules/boundaries.md`）。
