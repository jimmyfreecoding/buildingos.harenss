# 冻结决策（DECISIONS）

> 本文只记录**已定**的事，不讨论备选。有异议就改这一份，别在别处各说各话。

## D1 · 分层
产品由六件组成，**harness 只是其中一件可替换件**：

```
web（独立前端） · api（后端服务） · worker（报告/告警/任务）
probe（周期采集） · harness（DSH） · 存储（PG + TDengine + MQTT）
```

harness 跑在自己的容器里，前后端与存储都不感知它具体是谁。换 harness = 换一个容器镜像。

## D2 · 数据面 / 控制面分离
- 探针 → MQTT → 消费者 → PG/TD。**harness 不参与采集链路。**
- harness 只读存储、只输出结构化结论。

## D3 · 前端独立
- 前端只调 `netops-api`，**不直连 harness**。
- 页面渲染直接读 PG/TD，不经过 LLM。
- 每个功能页内嵌 Chat 面板，通过 `api` 转发到 `harness-service`。

## D4 · harness = DSH
容器化，对外只暴露 HTTP/WS。模型用 `dsh-llm-deepseek`，deepseek 系。

## D5 · harness 只读 + 最大权限
- `network_mode: host` + `NET_RAW` + `NET_ADMIN`。
- 可发广播/组播、可 ARP/端口扫描、可拉 RTSP、可写 Python 工具。**只读探索不做审批。**
- **D5b · probe 与 harness 的区别只有一个：是否有 LLM 参与。**
  - `probe`：确定性、周期性、**零 token** 的采集（基线指标、心跳、资产变更检测）。
  - `harness`：按需、探索性、**有 token 成本**的深挖（未知设备识别、异常归因、造新工具）。
  - 两者都是特权只读容器，都给 host 网络。

## D6 · 生成工具是产品能力，不是彩蛋
- 模型把 Python 工具写进 `harness/toolbox/`。
- 一个 DSH 插件负责扫描目录并**自动注册成工具**，下一步即可调用。
- 工具约定见 `CONTRACTS.md` B 节（stdin JSON 进、stdout JSON 出，零魔法）。

## D7 · 写操作不在 M0–M2 范围
改配置、下发变更由人与客户的协议决定。产品在当前阶段**只产出结构化变更草案**，不执行。

## D8 · 模型分级
便宜模型做汇总/叙述，强模型做根因与造工具。按任务类型在 `harness-service` 里路由。

## D9 · 存储分工
| 存储 | 放什么 |
|---|---|
| PostgreSQL | 站点/网段/设备/链路/服务/finding/任务/报告/审计 |
| TDengine | 指标时序（探针采样、空口、体验分）|
| MQTT (EMQX) | 事件总线：事实、finding、指令 |
| DSH 自带存储 | 只放会话，不放产品数据 |

## D10 · 客户配置
一客户一 Git 私有仓。仓里只放台账/期望态/策略/手册/报告；**凭据只放引用名**。

## D11 · 部署
Docker Compose。目标机：树莓派 5 / 8GB + **NVMe**（不用 SD 卡）、或 x86 迷你主机、或笔记本。
探针与 harness **必须显式声明出口接口**（`PROBE_EGRESS_IFACE`），否则广播/组播会被虚拟网卡抢走。

## D12 · 3D / IOC
React Three Fiber。V1 只做"可定位的 3D"：楼层等轴图 + 设备图标 + 链路 + 状态着色。位置来自 `location` 元数据（floor/room/rack/x/y），自动布局 + 人工拖拽修正。

## D13 · 任务串行化
Pi 上并发 agent 会话上限 2–3。交互 Chat 常驻 1 个；批量任务（日报、归因、造工具）**由队列一次跑 1 个**。

---

## 目录结构（产品仓）

```
netops/
├── apps/
│   ├── web/                前端（独立部署）
│   ├── api/                后端服务
│   ├── worker/             报告 / 告警 / 任务队列消费者
│   └── probe/              周期采集（host 网络）
├── harness/
│   ├── service/            HTTP/WS 包装层（把 DSH 包成服务）
│   ├── profile/            DSH netops profile（cordis.patch.yml）
│   ├── plugins/            Cordis 插件：toolbox 注册器、netops 工具、prompt 段
│   ├── toolbox/            模型生成的 Python 工具（运行时产物）
│   └── adapters/           人审通过的适配器（Git 版本化）
├── packages/
│   ├── contracts/          TS 类型 + JSON Schema（前后端共用）
│   └── db/                 PG migrations + TDengine DDL
├── deploy/                 docker-compose + overlay
└── docs/                   本目录
```

> 早前的 `netops-skeleton/` 由 `harness/profile/` 取代。
