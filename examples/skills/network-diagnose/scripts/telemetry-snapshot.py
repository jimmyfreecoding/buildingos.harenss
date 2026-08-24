#!/usr/bin/env python3
"""telemetry-snapshot.py —— 读取网络遥测快照（BuildingOS 示例技能脚本）。

被 Codex 隐式调用语义识别（运行本技能目录下的脚本即触发 network-diagnose 技能）。
真实实现中调用 mcp://telemetry/query-switch-status；此处为占位（TODO）。
"""

import json
import sys


def main() -> None:
    switch = sys.argv[1] if len(sys.argv) > 1 else "SW-03"
    # TODO: 真实遥测查询（telemetry MCP，见 configs/runtime.yaml mcp_servers）
    snapshot = {
        "device": switch,
        "p95_latency_ms": 62,
        "packet_loss_pct": 2.3,
        "crc_errors_1h": 45,
        "source": "placeholder",
    }
    print(json.dumps(snapshot, ensure_ascii=False))


if __name__ == "__main__":
    main()
