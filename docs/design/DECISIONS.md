# 冻结决策（DECISIONS）

> 本文只记录**已定**的事，不讨论备选。有异议就改这一份，别在别处各说各话。
>
> **2026-09-24 修订**：按 `buildingos.ioc/docs/TECH-PLAN.md`（执行稿 v2.1，副本见 `TECH-PLAN-ioc-harness.md`）的 K8–K12，修订 D1、D4、D12，新增 D14、D15，并更新末尾目录结构。被修订的原文保留在 git 历史里。

## D1 · 分层（2026-09-24 修订）
本仓库由两部分组成：**harness 平台**（多个业务域共用）和 **netops 产品**。

```
harness 平台：harness-gateway（C 节） · DSH 镜像 · core 插件 · 业务域（ioc / iot / netops）
netops 产品：probe（周期采集） · netops-api（领域数据服务） · worker（报告/告警/任务） · 存储（PG + TDengine + MQTT）
呈现：统一走 buildingos.ioc 的 studio / player（见 D12、D14），本仓库不再维护独立前端
```

harness 跑在自己的容器里，调用方（buildingos/apps/ioc、netops-api）只感知 gateway 的 C 节契约，不感知 DSH。
换 harness = 换一个容器镜像。业务域之间权限隔离：**同一个镜像、按域分容器**（ioc、iot 普通网络；netops 特权网络）。

## D2 · 数据面 / 控制面分离
- 探针 → MQTT → 消费者 → PG/TD。**harness 不参与采集链路。**
- harness 只读存储、只输出结构化结论。

## D3 · 前端独立
- 前端只调 `netops-api`，**不直连 harness**。
- 页面渲染直接读 PG/TD，不经过 LLM。
- 每个功能页内嵌 Chat 面板，通过 `api` 转发到 `harness-service`。

## D4 · harness = DSH（2026-09-24 修订）
容器化，对外只经 harness-gateway 暴露 HTTP/SSE。模型用 deepseek 系，具体型号在各域 profile 里配置（D8）。
gateway 与 DSH 之间用 **DSH SDK 运行时（JSON-RPC over stdio）**，一个 AI 会话对应一个运行时进程（V0-4 验证，见 CONTRACTS C4）。

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

## D12 · 3D / IOC（2026-09-24 修订）
~~React Three Fiber~~ → **使用 buildingos.ioc 的 twin-runtime（Vue 3 + Three r115）**，不另起一套三维栈。
V1 只做「可定位的 3D」：楼层等轴图 + 设备图标 + 链路 + 状态着色。位置来自 `location` 元数据（floor/room/rack/x/y），
与模型 `semantics.json` 的楼层 / 房间 id 对齐；自动布局 + 人工拖拽修正。

## D13 · 任务串行化
Pi 上并发 agent 会话上限 2–3。交互 Chat 常驻 1 个；批量任务（日报、归因、造工具）**由队列一次跑 1 个**。

## D14 · 前端唯一来源（2026-09-24 新增）
IOC 前端的唯一来源是 `buildingos.ioc`。netops 与 iot 的 AI 交互呈现统一做成 ioc 的项目模板和基础组件
（`topology` / `device-card` / `finding` 等）。本仓库的 `apps/web` 是 ioc 前端的一份副本，**冻结**：
只允许修复性改动；其中唯一的 netops 专有部分 `HealthCheck.vue`（网络健康体检）在 ioc 的 P7a 迁移为
「网络治理」项目模板后，`apps/web` 整体删除（见 `apps/web/FROZEN.md`）。

## D15 · 具名查询（2026-09-24 新增）
页面上的业务数据由**领域数据服务**提供（netops → netops-api；iot → buildingos.ai 的数据接口）。
**AI 不写 SQL**：只能引用领域服务预先注册的查询模板并填写参数（CONTRACTS F）。页面刷新直接执行查询，不经过 LLM（延续 D3）。

---

## 目录结构（产品仓）

```
buildingos.harenss/
├── harness/                      harness 平台
│   ├── image/                    DSH 源码构建镜像（三个域共用；由原 service/Dockerfile 迁来）
│   ├── service/                  harness-gateway：C1–C4、按 domain 路由、队列、预算、审计
│   ├── core/                     共用 Cordis 插件：toolbox-registrar / evidence-guard / credential-ref / draft-gate
│   └── domains/
│       ├── ioc/                  profile / skills(ioc-designer) / prompts / rules
│       ├── iot/                  profile / skills / prompts / rules / tools / toolbox
│       └── netops/               profile / skills / prompts / rules / knowledge / tools / toolbox / adapters
│                                 （原 harness/profile、skills、prompts、rules、knowledge 迁入）
├── apps/
│   ├── probe/                    周期采集（host 网络）
│   ├── netops-api/               领域数据服务（设备 / 链路 / 指标 / finding + 具名查询模板）
│   ├── worker/                   报告 / 告警 / 任务队列消费者
│   └── web/                      【冻结】ioc 前端副本，P7a 后删除（D14）
├── packages/
│   ├── contracts/                C / F 节的 JSON Schema（ioc 侧契约见 @buildingos/ioc-contracts）
│   └── db/                       PG migrations + TDengine DDL
├── deploy/                       compose.yml（以 docker-compose.infra.yml 为基础）；v3-frozen 标记为 legacy
└── docs/                         本目录
```

目录迁移在 harness 平台的 H0 阶段进行（与 ioc 的 P4 同步），P0 只修订文档、不搬文件。

> 早前的 `netops-skeleton/` 由 `harness/profile/` 取代。
