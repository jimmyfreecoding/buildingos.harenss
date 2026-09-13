# 里程碑（MILESTONES）

每个里程碑只写**交付物**和**可测验收**。不过验收不进下一个。

---

## M0 · 打通（1 周）

**交付**
1. `apps/probe`（Python，替换现有 8 个 .ps1）
   - 能力自检：出口接口 / 原始套接字 / Python 环境 / 无线网卡 → `capability` 事实
   - 发现：ARP 全段 + 并发 ICMP（96 并发，300ms 超时）
   - 指纹：top 端口 + banner + **离线 OUI 库** + 证书 CN + RTSP/ONVIF 响应
   - 质量：ICMP RTT/jitter/loss、TCP connect RTT（对 554/80/443）
   - 统一事实 JSON → MQTT `netops/{site}/probe/{id}/fact`
2. `apps/worker`：MQTT 消费者 → 落 PG（设备/链路/服务）+ TD（指标）
3. `apps/api`：`GET /devices`、`GET /devices/{mac}`、`GET /metrics?node=&metric=&from=&to=`
4. `apps/web`：设备列表页 + 链路质量页
5. `deploy/` 一条命令起得来

**验收**
| # | 条件 |
|---|---|
| A1 | 接入陌生 /24，**15 分钟内** Web 出现设备列表，覆盖实际设备 ≥ 90% |
| A2 | 质量页能一眼区分 Wi-Fi 与有线设备（jitter 差一个数量级） |
| A3 | 把某虚拟网卡的 metric 调到低于真实网卡 → 自检判 `misconfigured` 并给出修复命令 |

---

## M1 · 看懂（1.5 周）

**交付**
1. 拓扑图（2D SVG 先行，数据驱动自动布局 + 人工拖拽修正 → 写回 `topology/desired.yml`）
2. 设备卡片：身份 / 位置 / 链路 / 服务 / 治理级别 L0–L3 / 凭据引用 / 手册入口 / 历史 finding
3. 规则引擎 v1：阈值 **+ 同类对照**（同一交换机上有线 vs 无线的抖动对比）
4. Runbook 引擎骨架 + 3 份手册：`h3c-magic-ap` / `tapo-camera` / `hikvision-ipc`

**验收**
| # | 条件 |
|---|---|
| B1 | 复现本次结论：`.177` 抖动 31ms、`.119` 抖动 2.7ms → 自动生成 finding 并给出"瓶颈在 2.4G 空口" |
| B2 | 设备卡片能回答"这台是谁、在哪、连到哪、能管到什么程度" |
| B3 | finding 的每条证据可点回原始采样（TD 曲线或配置快照） |

---

## M2 · harness 接入（1.5 周）

**交付**
1. `harness/service`：DSH 包成 HTTP/WS，实现 `CONTRACTS.md` C1 / C2 / C3
2. `netops-toolbox-registrar` 插件（扫 `toolbox/` + `adapters/`，自动注册）
3. `netops-tools` 插件：7 个内置只读领域工具（probe_snapshot / device_detail / device_config / cctv_health / wifi_environment / topology_query / findings_query）
4. 每个功能页内嵌 Chat 面板（`page_context` 带当前页实体）
5. 造工具闭环：模型写 `toolbox/xxx.py` → 注册器扫到 → **下一步可调**

**验收**
| # | 条件 |
|---|---|
| C1 | 拓扑页选中摄像头问"为什么卡" → 返回带 `evidence[]` 的结论，证据可点回原始数据 |
| C2 | 让它生成一个此前不存在的工具（例：读 H3C AP 信道）→ 文件落在 `toolbox/` → `GET /v1/capabilities` 的 `python_tools` +1 → 下一个提问里该工具被调用成功 |
| C3 | 拔掉 WAN，Chat 仍能回答基于本地数据的问题（数据面不依赖外网） |

---

## M3 · 报告（1 周）

**交付**
1. 日报 / 周报 / RCA 三段模板
2. `worker` 定时触发（`REPORT_DAILY_CRON` / `REPORT_WEEKLY_CRON`）→ 调 harness `write_report`
3. 落 PG `reports` + 推客户 Git 仓 `reports/`

**验收**
| # | 条件 |
|---|---|
| D1 | 每日 07:00 自动出报告，不依赖人工触发 |
| D2 | RCA 报告 7 段结构齐全，**每段数据来自查询而非模型编造**（抽查任意 3 个数字能对上库） |

---

## M4+ · 后续

- 变更闭环：草案 → 审批 → 适配器执行 → 复测
- 3D / IOC：R3F + `location` 元数据，V1 只做可定位
- 分离式部署：探针盒 + 中央（多站点 / MSP）
- 域扩展：门禁、IoT 深适配

---

## 明确不在 M0–M2 范围

写配置、门禁远程开门、防火墙策略、多租户、3D 动画、IoT 固件升级。
这些进 M4+ 或由人与客户的协议决定。
