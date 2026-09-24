# buildingos.harenss

**harness 平台 + 网络治理（netops）产品。**

> 2026-09-24 起，本仓库的 `harness/` 升级为多个业务域（ioc / iot / netops）共用的 harness 平台，呈现统一走 `buildingos.ioc`。
> 决策见 `docs/design/DECISIONS.md` D1、D12、D14、D15；总体方案见 `docs/design/TECH-PLAN-ioc-harness.md`。

一台小盒子插进客户网络，自己把网络摸清楚——有哪些设备、连得好不好、哪里有问题——然后跟人对话解释、出报告、给建议。覆盖有线、无线、摄像头、门禁、智能设备五类。

---

## 从哪开始读

| 想了解 | 读这个 |
|---|---|
| 产品到底做什么、怎么卖、怎么交付 | `docs/plan/01-总览与执行路线图.md` |
| 完整技术方案（大白话，无行话） | `docs/design/技术方案-完整版.md` |
| 已经定死的技术决定 | `docs/design/DECISIONS.md` |
| 各部件之间的接口约定 | `docs/design/CONTRACTS.md` |
| 分几步做、每步怎么算完成 | `docs/design/MILESTONES.md` |
| 真实案例（为什么会有这个产品） | `docs/analysis/网络拓扑与卡顿根因分析.md` |

---

## 目录结构

```
buildingos.harenss/
├── docs/
│   ├── plan/          17 篇业务与技术规划（路线图、定价、销售、合规、架构…）
│   ├── design/        冻结设计：技术方案完整版 / 决策 / 接口契约 / 里程碑
│   └── analysis/      现场案例与早期方案（含本项目的来龙去脉）
│
├── apps/
│   └── probe/         探针实现（v1/v2）：引擎、DSH 插件、服务端、页面、测试
│
├── harness/           AI 引擎侧
│   ├── profile/       DSH 配置档案（决定 AI 有哪些能力）
│   ├── skills/        network-diagnose 技能（含 telemetry-snapshot.py）
│   ├── rules/         只读原则、禁止外传数据
│   ├── knowledge/     网络知识、拓扑示例
│   └── prompts/       运维工程师人设
│
├── packages/
│   └── db/            数据库建表脚本（业务库 PostgreSQL + 指标库 TDengine）
│
├── deploy/
│   └── v3-frozen/     冻结版一键部署（Docker Compose）
│
├── customer-repo-template/   客户 Git 仓库模板（台账/策略/手册/授权）
├── tools/
│   └── probe-powershell/     最初的 11 个诊断脚本（探针重写的参照基准）
└── legacy/                   被取代的产物，仅作留档
```

---

## 三个东西别搞混

**探针（`apps/probe`）** —— 定时扫网络、收集数据。**不花钱**、不依赖外网、不改任何配置。

**AI 引擎（`harness/`）** —— 需要动脑时才出场：分析原因、写报告、**自己写新的查询工具**。花钱、只读、不改配置。

**网页与后端** —— 页面直接读数据库渲染，**不经过 AI**。所以页面快，AI 挂了页面照样能用。

---

## 快速开始

```bash
cd deploy/v3-frozen
cp .env.example .env      # 填好站点编号、信号出口网卡
docker compose up -d
```

首次接入流程见 `docs/design/技术方案-完整版.md` 第九部分。

---

## 关于本仓库的历史

这个仓库原来是另一个方向的设计：**把各家 AI 引擎（DSH / Codex 等）对齐成统一的 server 能力**（`adapters/`、`normalizer/`、`conformance/`、契约文档等）。

该方向已作废，工作区内容已删除，**但完整保存在 git 历史里**，随时可取回：

```bash
git log --oneline                # 旧设计的全部提交
git show 6161155:README.md       # 查看旧设计的总说明
git checkout 6161155 -- .        # 把旧设计取回到工作区（会覆盖当前文件）
```

`6161155` 是删除前的最后一次提交（`docs(philosophy): D22 engine security baseline`）。

旧设计里有一部分与现在方向重合，已抢救到 `harness/` 下：`skills/`（network-diagnose 技能）、`rules/`、`knowledge/`、`prompts/`。
