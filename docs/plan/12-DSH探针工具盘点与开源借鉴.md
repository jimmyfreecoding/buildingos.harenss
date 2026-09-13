# 12 · DSH 探针：工具盘点与开源借鉴

> 目标读者：创始人、技术负责人、开发外包。本文回答三个问题：① 探针会用到 DSH 的哪些工具？② 哪些现成、哪些必须新开发？③ 开源生态有哪些可借鉴的方案，如何让探针能力更强？
>
> 依据：本会话对 DSH 运行时（27 个可调用工具）与 harness 源码（packages/ 结构）的实测盘点 + 开源方案调研（2026 年公开资料）。

---

## 1. 一句话结论

- **DSH 平台层全部现成**：命令执行、后台任务、定时调度、MCP Client、子进程、动态插件（工具注册 + 大屏 UI）、7×24 自主循环、并行子代理、文件与报告 —— **零新开发**。
- **网络领域工具全部要新开发**，但绝大部分是「**薄壳**」：外壳（参数/授权/审计/输出）自研，内核直接调用成熟开源 CLI/库（arp-scan / nmap / net-snmp / ffprobe / ONVIF / Zeek）。
- **最值得借鉴的开源**：Netdisco（拓扑发现算法）、LibreNMS（SNMP 自动发现+告警）、Prometheus + exporters（轻量采集）、Grafana（大屏）、Zeek（被动元数据）、Frigate（本地视觉）、OpenWISP（车队管理思路）。

---

## 2. 探针能力 → DSH 工具映射表

| 探针需要的能力 | DSH 现状 | 证据 / 说明 |
| --- | --- | --- |
| 执行系统命令（arp/ping/snmp/ffprobe…） | ✅ **内置 `pwsh` 工具** | 本会话已实证：摸盘全部由 pwsh 完成 |
| 后台长任务（全子网扫描/端口探测） | ✅ **内置 `job_*` 工具** | 本会话实证：端口探测后台跑、job_output 收集 |
| 定时调度（每 5 分钟巡检） | ✅ **平台 `schedule` 包** | `packages/schedule/schedule` 存在；由探针 preset 挂载 |
| MCP 对接（连 Python FastMCP 驱动） | ✅ **平台 `mcp-client` 包** | `packages/mcp/mcp-client`（connection/transport/tools 类型齐全） |
| 子进程管理（起停驱动进程） | ✅ **平台 `subprocess` 包** | `packages/subprocess`（subprocess / subprocess-local） |
| 动态工具注册 | ✅ **cordis 插件机制** | 本会话可调用 cordis_define/run；Host 插件注册 Tools |
| 大屏 / 看板 UI | ✅ **Client 插件 Slot** | DSH Web GUI 本地渲染，HDMI kiosk 即交付物 |
| 7×24 自主循环（无人值守） | ✅ **goal 工具 + 探针 preset** | 自主续跑机制现成；headless 模式运行 |
| 并行车队协调（多探针） | ✅ **subagent / workflow** | 车队级并行巡检/报告 |
| LLM 报告与小贴士 | ✅ **DSH agent 本身** | deepseek 模型；可换本地 Ollama |
| 数据持久化（SQLite） | ⚠️ 需加 Node 依赖 | `better-sqlite3` 等（常见依赖，非网络能力） |
| 告警通知（邮件/短信/webhook） | ⚠️ 部分 | 平台有 web/webhook 类能力但需探针插件封装；也可借 Prometheus Alertmanager |

> 区分口径：**当前会话可直接调用**的 27 个工具（pwsh/read/write/job_*/goal/subagent/cordis_* 等）是「通用 agent 工具」；**探针 preset** 会挂载更精简的专用工具集，并启用 schedule/mcp/subprocess 等平台服务。两者共用同一运行时。

---

## 3. 必须新开发的工具（薄壳清单，内核借开源）

对应 02 §7 的 7 个 MCP 工具 + 车队管理，开发量估算（外包口径：1 人周 ≈ $1,000–1,500）：

| 工具 | 职责 | 内核实现（开源借力） | 开发量 |
| --- | --- | --- | --- |
| `arp_discovery` | 资产发现 | `arp-scan`（Linux 原生）/ scapy | S（0.5 周） |
| `snmp_query_switch` | 交换机端口/PoE/错误率 | `net-snmp`（snmpget/snmpwalk）或 pysnmp | M（1 周） |
| `inspect_rtsp_cctv` | 摄像头健康/黑屏 | `ffprobe`（FFmpeg）+ ONVIF 库 | M（1 周） |
| `topology_build` | LLDP/CAM 交叉验证拓扑 | **借鉴 Netdisco 算法流程**（02 §4.2 即其核心思想） | M（1–1.5 周） |
| `health_report` | 评分 + 诊断报告 | 模板渲染（自研，无开源可抄） | M（1 周） |
| `self_heal` | PoE 重启 + 回滚 + 审计 | `net-snmp` 写操作 + 自研白名单/回滚 | M（1 周） |
| `local_ai_analyze` | 隐患分析小贴士 | DSH LLM / 本地 Ollama | S（0.5 周） |
| 车队 OTA/心跳 | 探针升级/在线 | 自研轻量（**借鉴 OpenWISP 思路**） | L（1.5 周） |
| **合计** | | | **≈ 7–8 人周** |

> 与 07 财务的「开发外包 $10k」吻合（P0 优先做前 6 项 ≈ 5–6 人周）。P1 车队 OTA 可延后。

---

## 4. 开源方案盘点与借鉴（重点）

| 开源项目 | 是什么 | 借鉴什么 | 集成方式 | 适合度 |
| --- | --- | --- | --- | --- |
| **[Netdisco](https://en.wikipedia.org/wiki/Netdisco)** | SNMP 网络发现 + 拓扑 + MAC 追踪（LLDP/CDP，端口级，20 年成熟） | **02 §4.2 交叉验证算法的源头**：LLDP 邻居 + CAM 表 + ARP 三源比对；设备→端口定位 | 参考其算法与 MIB 用法自研（轻）；或直接部署作后台引擎（重） | ⭐⭐⭐⭐⭐ |
| **[LibreNMS](https://community.librenms.org/t/autodiscover-by-ip-working-with-cdp-but-not-lldp/26812/2)** | SNMP 自动发现 + 轮询 + 告警 + 网络地图（全栈 NMS） | 自动发现流程（IP 发现→SNMP 轮询→LLDP/CDP 拓扑）；告警规则设计 | 可选整体部署在探针后台（Pi 上偏重）；或借鉴发现逻辑 | ⭐⭐⭐⭐ |
| **Prometheus + [snmp_exporter](https://prometheus.io/docs/guides/multi-target-exporter/) + blackbox_exporter** | 轻量指标采集（SNMP 模板化轮询；ICMP/TCP/HTTP 探活） | **探针数据层首选**：模块化 exporter 免写轮询代码；多目标模式适合「一探针管全网」 | 独立进程被 DSH 插件调用；SQLite 仍存事件/资产 | ⭐⭐⭐⭐⭐ |
| **Grafana** | 开源可视化看板 | 「透明大屏」的现成实现（拓扑/健康分/告警面板，kiosk 模式，可白标） | 与 DSH Web GUI 插件二选一或并存 | ⭐⭐⭐⭐ |
| **Zeek（原 Bro）** | 被动流量元数据引擎（连接日志、协议识别，**不落载荷**） | 02 §4.3「被动监听降级链」的正规军：防火墙禁广播时自动启用；合规（无内容） | 独立进程，DSH 读取其 conn.log | ⭐⭐⭐⭐ |
| **nmap + NSE** | 端口/服务/OS 指纹 + 漏洞脚本 | 替代自研端口探测与设备类型推断（本会话 3 台摄像头即靠 554 端口识别） | CLI 调用；限速 `-T3 -Pn` | ⭐⭐⭐⭐⭐ |
| **arp-scan** | 极快 L2 发现（Linux） | 替代 Windows arp 缓存方案，秒级全子网 | CLI 调用 | ⭐⭐⭐⭐⭐ |
| **Frigate + Coral TPU** | 本地 AI 安防（人形识别，无云） | 豪宅业务直接复用（02 §10 已列）；B2B 可做「摄像头画面有人进库」增值告警 | Docker/独立服务 | ⭐⭐⭐⭐（豪宅） |
| **Home Assistant** | 豪宅智能中枢 | 02 §10 核心；其 network scanner 组件可借鉴设备命名 | 独立服务 | ⭐⭐⭐⭐（豪宅） |
| **ZoneMinder / Motion** | 开源 NVR | CCTV 录像/运动检测备选 | 独立服务 | ⭐⭐⭐ |
| **[OpenWISP](https://scanopy.net/guides/open-source-network-documentation)** | 开源网络管理平台（设备注册/配置/地图） | **车队管理思路**：探针注册、版本、心跳、远程维护 | 自研轻量版（借鉴概念，不部署整套） | ⭐⭐⭐ |
| **NetBox** | IPAM/资产数据库 | 节点 >30 后的资产台账（IP/MAC/设备→客户/位置） | 可选；自研 SQLite 表亦可 | ⭐⭐ |
| **ONVIF Device Manager / python-onvif** | 摄像头标准发现与配置 | inspect_rtsp_cctv 的标准化底座 | FastMCP 驱动内调用 | ⭐⭐⭐⭐⭐ |
| **vis.js / d3.js** | 前端拓扑渲染 | 02 §9 大屏拓扑图 | DSH Client 插件内引用 | ⭐⭐⭐⭐ |

---

## 5. 推荐「开源基座」组合（探针 v1.0 架构）

```
┌──────────────────────── 树莓派小黑盒 ────────────────────────┐
│  DSH 实例（Node 20 LTS，systemd）                              │
│  ├─ 探针 preset：goal 7×24 循环 + schedule 定时巡检             │
│  ├─ Host 插件：7 个探针工具（薄壳：参数/授权/审计/输出）        │
│  ├─ Client 插件：大屏（DSH Web GUI，HDMI kiosk）               │
│  └─ MCP client（平台内置）──► Python FastMCP 驱动（子进程）     │
│                                                                 │
│  数据层（可选，节点 >10 启用）：                                │
│  Prometheus + snmp_exporter + blackbox_exporter + Alertmanager  │
│  └─ Grafana 大屏（白标 kiosk，与 DSH GUI 二选一）                │
│                                                                 │
│  发现/诊断内核（被工具调用）：                                  │
│  arp-scan · nmap(-T3 限速) · net-snmp · ffprobe · ONVIF         │
│  Zeek（被动兜底）· Frigate（豪宅视觉，可选）                     │
└──────────────────────────────────────────────────────────────┘
```

**选型原则：** 内核全部「借」，外壳全部「自研」；任何开源组件都是独立进程，通过 CLI/HTTP 被 DSH 工具调用 —— 不把第三方运行时塞进 DSH 内核，崩溃隔离、按需启用。

---

## 6. 结论：开发清单（必做 vs 可借）

### 必须自研（无开源替代，≈ 6–8 人周）
1. FastMCP 驱动外壳（7 工具：参数校验、授权令牌、audit.log、幂等）
2. DSH 探针插件（Host 工具注册 + schedule 挂载 + Client 大屏）
3. 健康评分与报告模板（商业价值的核心，须定制）
4. 自愈执行器（白名单 + 快照回滚 + 日上限，02 §6）
5. 车队 OTA/心跳（P1，轻量）

> ⚠️ **执行口径更新（2026）：** 上述自研项已确定由 **DSH agent 自研、无外包**，完整开发任务清单见 **[13-探针开发任务清单](13-探针开发任务清单.md)**（里程碑 M0–M9、验收标准、工作量 ≈11 个开发日）。

### 直接借开源（≈ 0 开发，只有部署成本）
- 扫描：arp-scan / nmap / net-snmp / ffprobe / python-onvif
- 数据：Prometheus exporters（可选启用）
- 大屏：Grafana（可选）
- 被动：Zeek（可选）
- 视觉：Frigate（豪宅）
- 算法：Netdisco / LibreNMS 的发现流程（参考实现，不部署整套）

---

## 7. 对既有文档的修订建议

| 文档 | 修订 |
| --- | --- |
| 02 §7 MCP 工具 | 补注：各工具内核调用开源 CLI/库（本文件 §3 表） |
| 02 §9 展示层 | 增加：Grafana 可选作为大屏后端（与 DSH GUI 二选一） |
| 02 §12 外包范围 | 拆分「自研壳」与「部署开源组件」两类交付，工作量 ≈7–8 人周 |
| 11 §5.4 PoC | D2 增加：用 arp-scan + net-snmp 在 Pi 上实测发现与 SNMP 轮询 |

---

## 8. 风险与注意事项

- **性能**：Pi 5 跑 Prometheus+Grafana+Zeek 偏重 → 默认只跑「DSH + 薄壳工具 + SQLite」；exporter/Grafana 按需启用（节点 >10 或豪宅现场）。
- **合规**：Zeek/nmap 属「只读探测」，符合零写入承诺；限速规则写死在工具层（nmap `-T3`、50pps），防止误触发客户 IPS。
- **授权**：SNMP 写（自愈）与凭据加密沿用 02 §6 设计，与开源组件无关。
- **版本**：全部开源组件固定版本 + 车队统一更新窗口，避免供应链漂移。
