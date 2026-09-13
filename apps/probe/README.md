# probe/ — DSH 网络探针（自研）

> 依据：[docs/13-探针开发任务清单](../docs/13-探针开发任务清单.md)（M0–M9）。
> 执行：DSH agent 自研，无外包。双阶段：本机（Windows）验证 → Pi（Linux）部署。

## 目录

```
probe/
├── plugins/            # 插件原型（probe-1：开发/算法验证，非产品形态）
│   ├── host/index.js   # Host 半（工具/RPC/patrol）
│   └── client/index.js # Client 半（透明大屏原型）
├── engines/            # ★ 算法内核（前后端/插件/DSH 大脑共用）
│   ├── store.js discovery.js sweep.js snmp.js cctv.js
│   ├── topology.js rules.js report.js quality.js knowledge.js
├── server/server.js    # ★ v3 独立后端：REST API + patrol + 持久化
├── web/                # ★ v3 独立前端（index.html + app.js，无构建）
├── tests/              # 引擎单测（node tests/*.test.js）
├── data/               # 运行时数据（overrides/manuals/accounts/measurements）
├── deploy/             # Pi 部署（install-deps.sh / systemd / probe-image.md）
└── docs/验收报告.md
```

## 运行方式（v3 架构）

```bash
# 独立后端 + 前端（普通用户用这个）
cd probe
node server/server.js          # 打开 http://127.0.0.1:3210
# API：/api/status /api/topology /api/quality(POST 评估) /api/scan /api/report/* /api/assets
```

## 里程碑状态

| 里程碑 | 状态 |
| --- | --- |
| M0 插件壳 | ✅ 运行中（probe-1/pkg-6，9 工具 + RPC + patrol） |
| M1 数据层 | ✅ 通过（store.test.js） |
| M2 发现引擎 + 扫活链路 | ✅ 通过（scan_subnet 复刻摸盘 28 台） |
| M3 SNMP 引擎 | ✅ 通过（snmp_query 工具注册，Pi 上生效） |
| M4 CCTV 引擎 | ✅ 通过（inspect_rtsp 工具注册，Pi 上生效） |
| M5 拓扑构建 | ✅ 通过（topology_build 实测 28 节点） |
| M6 规则引擎 + 5 分钟巡检 | ✅ 通过（patrol 运行中） |
| M7 报告引擎 | ✅ 通过（health_report 实测输出日报） |
| M8 大屏与本地 Web | ✅ **透明大屏 v2**（probe-1/pkg-9：本地显隐驱动 ≤2.5s 必现 + 数据容错提示 + pointerEvents 显式开启） |
| M9 Pi 部署打包 | ✅ 交付物完成（deploy/ 三件套） |
| 最终验收 | ✅ [docs/验收报告.md](docs/验收报告.md) |
| 值守 preset | ✅ `probe` preset 已创建并挂载校验通过（`~/.dsh/.agent-presets/probe/`，探针值守 Operator 人设） |

## 测试

```bash
cd probe
node tests/store.test.js       # M1 数据层
node tests/discovery.test.js   # M2 发现（含真实端口探测）
node tests/sweep.test.js       # M2 扫活链路（真实 /24 扫描）
node tests/snmp.test.js        # M3 SNMP 解析
node tests/cctv.test.js        # M4 CCTV 解析
node tests/topology.test.js    # M5 拓扑（LLDP/CAM/ARP 交叉）
node tests/rules.test.js       # M6 规则引擎
node tests/report.test.js      # M7 报告引擎
```

## 插件运行（当前会话 PoC，probe-1/pkg-10，10 个工具）

| 工具 | 状态 | 说明 |
| --- | --- | --- |
| probe_ping | ✅ 实测 | 网关 10ms / 摄像头 13ms |
| arp_discovery | ✅ 实测 | 解析本机 ARP 表 |
| scan_subnet | ✅ 实测 | /24 扫活 + ARP 28 台（复刻摸盘） |
| port_scan | ✅ 实测 | 摄像头 443/554 识别 |
| snmp_query | ⚠️ 需 net-snmp | Windows 优雅降级；Pi 生效 |
| inspect_rtsp | ⚠️ 需 ffmpeg | Windows 优雅降级；Pi 生效 |
| topology_build | ✅ 实测 | 28 节点 + 网关自动识别 + 置信度标注 |
| health_report | ✅ 实测 | 健康分 + 日报 Markdown（100/100） |
| diagnostic_report | ✅ 实测 | 14 天《IT/安防健康诊断报告》（资产/事件/隐患/升级建议） |
| probe_status | ✅ 实测 | 全量运行时状态 |
| patrol（定时） | ✅ 运行中 | 每 5 分钟网关/设备探测 + 事件记录（M6） |

## 平台约束备忘（写插件时遵守）

- 无 `require`/`import`/`process`/`Buffer`/`fetch`/原生定时器
- 进程 → `ctx.get('subprocess')`（spawn spec：argv/cwd/stdio/graceMs）
- 定时 → `inject: ['timer']` + `ctx.interval`
- 持久化 → `ctx.get('fs')` / `ctx.get('storageDomain')`（JSON，禁止 require SQLite）
- 工具 → `harness.defineTool({ name, description, parameters, output:{schema,render}, execute })` + `harness.registerTool(ctx, tool)`
