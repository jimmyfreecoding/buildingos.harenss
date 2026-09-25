# BuildingOS IOC 重构技术方案 · 执行稿 v2.1

> 状态：**执行稿**（v1 评审稿 + 两份评审意见的合并修订）。第 2 节决策和第 11 节阶段计划按本稿执行；第 12 节剩余问题在 V0 验证阶段内关闭。
> 日期：2026-09-24
> 单一来源：`buildingos.ioc/docs/TECH-PLAN.md`。`buildingos.harenss/docs/design/TECH-PLAN-ioc-harness.md` 是同内容副本；以后改动只改 ioc 仓库，再同步副本（V0-0 把两份纳入 git，并加 sha256 一致性检查）。
> v1 → v2 的修改逐条记在附录 A「评审意见处理表」里。v2 → v2.1：写入 V0 验证结论（第 13 节，报告见 `docs/V0-REPORT.md`），并修正受影响的条目。

| 仓库 | 在本方案中的角色 |
|---|---|
| `buildingos.ioc` | **IOC 前端唯一来源**：模型运行时、.buildingosmap 编译、页面框架、studio / player、共享契约包 |
| `buildingos` | NestJS 宿主；新增微服务 `apps/ioc`（存储、事务、导出、MCP、托管前端） |
| `buildingos.harenss` | harness 平台（DSH 镜像、gateway、三个业务域）+ netops 产品（probe、netops-api） |
| `buildingos_webmap` | 旧格式 .acmap 与 AirocovMap 引擎（只参考，不改） |
| `deepseek-harness` | DSH 上游（只参考，不改） |
| `buildingos.ai` | IoT 实时数据（MQTT / TDengine / PostgreSQL）。数据获取规范待提供 |

---

## 0. 这一版改了什么（摘要）

1. **先验证后铺开**：新增 **V0 验证阶段**，打通 5 条最小链路（v1 真实文件、Smart 编译加拾取、DSH 会话调 MCP、exe 打开最小包、宿主挂载 SSE），并冻结契约之后，才开始多仓库改造。
2. **补齐 6 个契约**：模型语义映射、项目修订与草稿事务、身份授权、HTML/CSS/资源校验、领域数据接口、宿主挂载方式（第 4、5、7、8 节）。
3. **修正 v1 中 12 处不准确的事实依据**，附录 B 的引用表新增「核实状态」一列。
4. **内容块改成双轨**：结构化块（ARCHITECTURE §10 的路线 B）是可视化编辑的主力；HTML 块是 AI 的直出通道。两条轨道共用同一套样式注入和同一个校验关口。
5. **IOC 前端只保留一份代码**：harenss 的 `apps/web` 是 IOC 前端的逐字节副本，在 P0 内移除。

---

## 1. 目标与场景

| # | 场景 | 描述 |
|---|---|---|
| S1 | 嵌入模型 | 其他 web 项目引入 `ioc.js`，加载 .buildingosmap（或兼容导入 webmap 的旧格式 .acmap）和 .acstyle，显示三维楼宇 |
| S2 | 编排展示 | 选用户 → 选择或新建项目 → 可视化编排 + AI 对话 → 保存 → 导出 `web.zip`，用已有的本地浏览器 exe 离线运行 |
| S3 | 在线大屏 | S2 的大屏项目不导出，直接通过 URL 访问；语音或文字与 AI 交互，实时改变显示内容 |

同一个 harness 平台还要支撑两个业务域：**iot**（通过 AI 动态查询 buildingos.ai 的实际数据，规范待提供）和 **netops**（网络治理，按 harenss 的 `docs/design/*.md` 执行）。三个域的呈现全部走 ioc。

---

## 2. 决策

### 2.1 维持 v1 的决策

| 编号 | 决策 |
|---|---|
| K1 | 模型采用「共用运行时 + 独立模型文件」。渲染性能不低于现在的程序化版本，衡量指标见 4.7 |
| K2 | 新格式为 **.buildingosmap**（K21）；运行时兼容导入 webmap 的加密 .acmap；新格式不强制加密 |
| K3 | 本地浏览器 exe 已完成；本方案只保证导出的 `web.zip` 在它上面能运行（要记录它的 Chromium 版本，见第 6 节） |
| K4 | ioc 后端是 `buildingos/apps/ioc`，遵循宿主的微服务规范（按宿主实际实现做修正，见 7.1） |
| K5 | 第一版用文件存储，不用 Git；**但必须具备事务语义**（见 7.3） |
| K6 | 骨架结构化，内容可以自由（见第 5 节，本版细化为双轨） |
| K7 | AI 全部通过 DSH 以服务方式提供，Docker 封装，具体模型在 profile 里配置 |
| K8 | harness gateway 放在 `buildingos.harenss`，作为通用组件 |
| K9 | harenss 的 D12 改为：3D 使用 ioc twin-runtime |
| K10 | netops 和 iot 的呈现统一归到 ioc |
| K11 | 小盒子只跑 netops 的 DSH 容器，外加一个只读的 ioc 呈现 |

### 2.2 本版新增的决策

| 编号 | 决策 | 来源 |
|---|---|---|
| K12 | **IOC 前端唯一来源是 buildingos.ioc**。harenss 的 `apps/web` **冻结**（只允许修复性改动），其中唯一的 netops 专有组件 `HealthCheck.vue` 在 P7a 迁入 ioc 后整体删除（P0 执行时发现该目录有未提交的改动且含 netops 专有组件，故由「P0 删除」改为「冻结 + P7a 删除」，见 harenss DECISIONS D14） | 两份评审 |
| K13 | 内容块双轨：**结构化块**（`metric / list / ring / line / progress / text / table`，ARCHITECTURE §10 路线 B）承担没有 AI 时的可视化编辑；**HTML 块**是 AI 直出通道。两者都是布局里的一个 box | DeepSeek §4-§5 问题 2，并保留产品负责人「AI 直接生成 HTML」的要求 |
| K14 | 样式注入：HTML 块和结构化块都在 Shadow DOM 中渲染。令牌层（CSS 变量）天然穿透；**工具类和主题 skin 编译成 `CSSStyleSheet`，通过 `adoptedStyleSheets` 注入每个 shadow root** | DeepSeek B2 |
| K15 | 身份授权从 **P3 开始**就生效。所有写接口都要求宿主签发的 JWT，由 apps/ioc 用与宿主相同的密钥自行校验（V0-5）。「名单选人」只在本机演示模式下可用（只监听回环地址） | 两份评审 |
| K16 | 实时推送改用 **SSE**（宿主已有先例）。`local_module` 模式下子应用没有独立的 HTTP server，所以不做 WebSocket | DeepSeek B4 |
| K17 | 业务数据由**领域数据服务**负责（netops → netops-api；iot → buildingos.ai 的数据接口）。apps/ioc 只做项目、呈现和查询编排，不直接连业务库 | ChatGPT 5 |
| K18 | **AI 不写 SQL**。具名查询只能引用领域服务预先注册的查询模板，AI 只填参数 | DeepSeek B6 |
| K19 | 共享契约包 `@buildingos/ioc-contracts` 同时输出 ESM、CJS 和 `.d.ts`。开发时用 `file:` 引用，交付用固定版本的 tarball，版本号记在消费方的 lockfile 里 | 两份评审 |
| K20 | **新楼宇模型的生产方式 = 规范驱动的大模型建模**：把《模型编写规范》、效果图和 CAD 一起交给大模型，由它写出 `models-src/<id>/buildModel.js`，再用 `bosmap build` 编译、验收。webmap 的 DXF→acmap 工具链已经失败，**不考虑**；GLB→acmap 也不作为主路径 | 产品负责人 |
| K21 | **模型文件格式定名为 `.buildingosmap`**（zip：manifest + glb + 语义，manifest 里 `format: "buildingosmap"`、`version: 1`）。`.acmap` 只作为旧格式**兼容导入**，不再产出；运行时按文件内容识别格式，不看后缀。编译命令为 `bosmap`（`packages/map-tools`） | 负责人（P1 执行中） |
| K22 | **Three.js 从 r115 升级到 0.186.1（精确锁定）**。r115 是仓库初始提交带来的，没有必须保留的技术理由；新版 API 是《模型编写规范》和大模型建模的基础，并修复安全通告 GHSA-fq6p-x6j3-cmmq。现有场景通过 `twin-runtime/src/compat.js`（关闭色彩管理 + 灯光 ×π）保持 r115 的画面；是否整体改用物理正确的新设置，留作后续的视觉决策。详见 `docs/THREE-UPGRADE.md` | 负责人（P1 执行中） |

---

## 3. 总体架构

```
┌──────────────────────── 浏览器 ────────────────────────┐
│ studio（编排 + AI）  player（大屏 / 演示 / 离线）  第三方页面 + ioc.js │
│        └──── ioc-ui（布局 / 结构化块 / HTML 块 / 主题注入）────┘       │
│                     └── twin-runtime（Three 0.186）─┘                  │
└──────────┬───────────────────────────────────────────────┘
           │ REST + SSE（JWT）          离线 zip：只读静态文件，没有后端
┌──────────▼──────── buildingos 宿主进程（Node 22，Express）────────┐
│ /ioc  ← apps/ioc（local_module 同进程挂载；也支持独立进程运行）       │
│   REST · SSE /ioc/live · MCP /ioc/mcp · 静态 /ioc/app               │
│   ProjectStore（修订 / 草稿 / 原子发布）· 授权上下文 · 查询编排       │
└──────┬─────────────────────────────▲──────────────────┬──────────┘
       │ C2 会话（domain, authCtx）     │ MCP（服务 token + 会话绑定）│ 查询代理
┌──────▼──────── harness-gateway（独立容器，Node ≥22.19）──┴──┐  ┌──────▼──────────┐
│ 路由 · 队列（D13）· 预算 · 模型分级（D8）· 审计 · 事件恢复   │  │ 领域数据服务      │
│   ├ dsh-ioc    bridge 网络 · MCP→apps/ioc · 浏览器         │  │ netops-api       │
│   ├ dsh-iot    bridge 网络 · 只读工具 → 领域数据服务        │  │ buildingos.ai 数据 │
│   └ dsh-netops host 网络 + NET_RAW/ADMIN                  │  └─────────────────┘
└──────────────────────────────────────────────────────────┘
```

依赖只允许单向，前端不直连 harness（harenss D3）。gateway 独立成一个容器，原因有两个：DSH 要求 Node `^22.19 || >=24`，而宿主 CI 仍用 Node 20；另外还要隔离故障。gateway 与 DSH 之间怎么通信，由 V0-4 决定。

---

## 4. 模型层

### 4.1 拆分：`buildModel()` + Viewer

现有 `createXxx(container, callbacks, options)` 拆成两部分：

- `buildModel(options) → { root: THREE.Group, semantics, slots, behaviors, dispose }`：纯几何和语义。**不创建 renderer，不操作 DOM，不启动循环**；随机数使用固定种子；所有 mesh 的世界变换在这里定型。
- `Viewer`（twin-runtime）：负责渲染器（`SRGBColorSpace`、ACES、PCF 阴影、像素比上限 1.65；兼容外观见 K22）、相机、OrbitControls、灯光环境、拾取、标签、快照、行为插件、资源释放。

迁移期间 `procedural` provider 在运行时里调用 `buildModel()`；编译器也调用同一个 `buildModel()`。两条路径使用同一份建模代码。

### 4.2 能力矩阵（修正 v1 的漏项）

`SceneHost` 的实际行为：**只为已声明的能力生成方法**。已声明但 provider 没有实现的，调用时返回 `undefined`；**未声明的能力，方法本身不存在，直接调用会抛出 TypeError**。v1 写的「未声明的方法调用不报错」与实现不符。

本版改为：Viewer 为**完整能力表里的每一项**都生成方法。不支持的能力是 no-op，返回 `false`；`can()` 的语义保持不变。嵌入 API 的能力名单在 P0 冻结。

| 能力 | procedural（现状） | .buildingosmap | 旧格式 .acmap | stream | 不支持时 UI 的回落 |
|---|---|---|---|---|---|
| focus / reset / top / orbit / pause / view / labels / studio / environment / snapshots | ✔ | ✔ | ✔ | 部分 | 隐藏按钮 |
| select | jixing | ✔ | ✔ | 部分 | 不弹楼栋卡 |
| **explodeFloor / closeFloor**（v1 漏列） | jixing | ✔（楼层作为语义节点） | ✔（v1 本身按楼层组织） | ✘ | 改为只弹出室内视图（Smart 现状） |
| mode / layer / router | 部分站点 | 按语义声明 | ✘ | ✘ | 隐藏 |
| roomHighlight / planView | 室内 provider | ✔ | ✔ | ✘ | 隐藏 |
| **highlight**（新增） | ✘ | ✔ | ✔ | ✘ | no-op |

`highlight(ids, style)` 是新能力。目标 id 使用语义 id 的命名空间（`A`、`A-2F`、`A-2F-201`、`dev:<id>`）。`roomHighlight` 保留作为兼容别名，`select` 事件的 payload 统一为 `{id, type, path}`。

### 4.3 .buildingosmap

zip 容器（文件头 `PK`）：

```
xxx.buildingosmap
├─ manifest.json    format（= buildingosmap）、version（= 1）、id、units、up、bounds、home、runtime、entries、hashes
├─ scene.glb        主几何
├─ semantics.json   语义层
├─ pick.bin         （可选）三角形区间 → 语义 id 表，见 4.4
├─ bin/*.f32        实例变换
├─ floors/*.glb | floors/*.acmap（旧格式，兼容导入）
└─ thumb.png
```

**命名 ABI**（P0 冻结）：

- glTF 的 `material.name` = 材质槽名（`facade.glass`、`road` …）；
- glTF 的 `node.name` = `<语义id>|<槽名>`，例如 `A|facade.glass`；
- `extras.semantic` 放语义 id，作为冗余，方便外部工具读取。

`semantics.json`（完整 JSON Schema 在 P0 冻结）：

```jsonc
{
  "tree": [ { "id": "A", "type": "building", "name": "总部", "props": {...},
              "children": [ { "id": "A-2F", "type": "floor", "overlay": "floors/A-2F.glb",
                              "children": [ { "id": "A-2F-201", "type": "room" } ] } ] } ],
  "anchors":   [ { "id": "A-label", "target": "A", "position": [0,22,30],
                   "text": "总部", "style": "building-label", "facing": "camera", "minZoom": 0 } ],
  "cameras":   [ { "id": "overview", "position": [...], "target": [...] } ],
  "paths":     [ { "id": "road-1", "points": [[x,y,z], ...], "closed": false } ],
  "instances": [ { "id": "trees", "prototype": "tree-a", "slot": "green",
                   "transforms": "bin/trees.f32", "count": 240 } ],
  "behaviors": [ { "type": "traffic", "plugin": "traffic@1", "path": "road-1", "params": { "count": 8, "speed": 6 } } ]
}
```

- **实例二进制布局**：Float32、小端序、每个实例 16 个数（4×4 矩阵，**列主序**，与 `THREE.Matrix4.elements` 一致），stride 为 64 字节，数量等于 `count`。
- **行为插件接口**：`{ id, version, create(viewer, semanticsEntry, params) → { update(dt), dispose() } }`。插件随 twin-runtime 一起发布，第一批是 `traffic@1` 和 `flowline@1`。

### 4.4 合并粒度与拾取（修正 v1 的冲突）

v1 写的是「同材质槽全局合并」。这会破坏现有按 mesh 的拾取和高亮，例如 `userData.building`（`createCampus.js:366-372`）和替换房间几何（`createDesignCenterFloor.js:41`）。本版规定：

1. **合并键 = 语义实体 × 材质槽 × 渲染属性**（`castShadow`、`receiveShadow`、`side`、`transparent`、`vertexColors`）。合并**只在最细一级可拾取的语义实体内部进行**；楼栋级实体内部的装饰构件可以合并，但各房间、各楼层之间不能跨越合并。
2. 需要跨实体合并时（比如大量同材质的小房间），写入 `pick.bin`：`[startTriangle:uint32, count:uint32, semanticIndex:uint32]` 数组。射线命中后，用 `faceIndex` 二分查找得到语义 id。
3. 实例对象的拾取用 `InstancedMesh` 的 `instanceId` → `instances[].ids[instanceId]`。
4. **高亮不替换材质**：使用覆盖层（按命中区间复制一份几何，加上高亮材质）或者顶点色通道。显示和隐藏按节点控制；在 `pick.bin` 模式下，用 index 范围实现 drawRange 显隐。
5. 每个模型节点数设上限（初始 ≤ 300），编译器在超出时报警。

### 4.5 主题 .acstyle 与材质槽

- 材质槽名取自现有调色板键（`silver glass frame road white green dark ground studioSky studioGround`）。
- 幕墙 canvas 贴图和反射贴图（`smartFacadeMaterials.js`）作为运行时的**材质预设库**，按槽名引用。预设库随 `ioc.js` 一起分发。
- `.acstyle` 同时接受目录形式（`style/` → `style.json`）和文件形式。回落规则沿用 ioc 硬约束 4：主题没写的项用默认值。

### 4.6 兼容 v1（按实测结果修正）

实测 `23F.acmap`：

- 根键是 `MAP_VERSION(1.3.1), id, name, building_name, height, center, iv, extremums, floors`，**没有 `version` 键**；
- 图层是 `logo, room, floor, wall, seat, desk`。

因此：

- **识别**：文件头不是 `PK` 且内容是 Base64 文本 → 按 AES-256-CBC 解密。默认 key 和 IV 取自 webmap 的 `cryptoHandle.js`，可以通过参数覆盖。版本号读取 `MAP_VERSION`。
- **根对象的 `iv` 字段**：**已确认是楼栋平面偏移**，不是加密 IV（旧源码 `Object3D.js:155-173` 用它设置 `building.position.x/z`；全部样本都是 `[0,0]`）。
- **两代元数据**（V0-1）：1.3.1（`MAP_VERSION`、`iv`、`extremums`…）和 1.0.0（`version`、`createTime`），加载器用 `normalizeV1` 统一。
- **与 1.3.0 的样式差异**（V0-1，P1 移植）：`sType 1002` 画成平面；材质不关闭 depthTest；Map 级 `opacity` 配置；房间名称标签和图标。
- **图层覆盖**：第一批支持 `floor room wall door window logo seat desk furniture`，按 23F 的实际图层排序。未知图层记录告警，不中断加载。
- **几何**：移植 webmap 旧 ESM 源码 `src/acmap/core/Object3D.js` 的拉伸和合并逻辑。它用到的 `Geometry.vertices/faces`、`ExtrudeGeometry` 在 r115 中都还有；实际移植时已全部改写为 `BufferGeometry`，升级到 0.186 后画面不变（K22）。
- **一致性基准**：旧 ESM 源码目前无人引用，线上交付走的是 AirocovMap 1.3.0 的 UMD 包（内嵌 r122，没有源码）。**验收以 AirocovMap 1.3.0 在同一机位的实测截图为基准**，不以旧源码为准。
- **v1 只做兼容读取，不作为生产路径**：新楼宇和室内楼层都按 K20 与 4.10 生产。webmap 的 DXF→acmap 是一条失败的工具链，不考虑；GLB→acmap（`GlbToAcmapConverter.js`）只在拿到外部 GLB 时作为备用。
- **安全说明**：v1 的「加密」只是为了兼容读取。密钥公开在客户端源码里，不构成保密手段。

### 4.7 编译器与性能验证

**编译环境**：第一版在**受控的无头浏览器**（复用 `verify-ioc.mjs` 的无头 Edge 加调试端口）里执行 `buildModel()` 和 `GLTFExporter`（它依赖 `FileReader` 等浏览器接口）。编译结果需要可复现：同一份源码、同一个种子，得到的 glb 哈希一致。

**Draco**：`GLTFExporter` **不支持** Draco，要用外部工具（`gltf-transform`）后处理。运行时和离线包都要附带 DRACOLoader 的解码器文件（wasm 和 js），并写进 `manifest`。

**性能验证**（每个园区迁移都要通过；不通过就继续用 procedural）：

| 指标 | 定义 | 通过条件 |
|---|---|---|
| draw call | `renderer.info.render.calls`，固定机位，暂停行为插件 | ≤ 基准 × 0.5 且 ≤ 300 |
| 帧耗时 | 20 秒内的 p50 和 p95 | p95 ≤ 基准 p95 |
| 可交互首帧 | 从请求 .buildingosmap 开始，经过下载、解压、解析、GPU 上传，到第一帧可以响应拾取；分冷启动和缓存启动两种，固定限速 | 缓存启动 ≤ 基准；冷启动单独记录，预算在 V0-2 之后确定 |
| 包体积 | .buildingosmap 总字节数和首屏必需字节数 | 记录，并设预算 |
| 内存 | JS 堆和 GPU 估算（`renderer.info.memory`） | ≤ 基准 × 1.2 |
| 画面 | 分块 SSIM，差异图和基准图入库，差异区域人工确认 | 阈值在 V0-2 实测后确定 |
| **交互回归** | 拾取楼栋 / 楼层 / 房间、高亮、显隐、楼层切换、explodeFloor、视角保存与还原 | 用例全部通过 |

脚本：`scripts/perf-scene.mjs` 和 `scripts/interact-scene.mjs`。

### 4.8 嵌入接口（S1）

`ioc.esm.js` 和 `ioc.umd.js`（全局 `BuildingOSTwin`），内置 Three 0.186、材质预设库和行为插件；Draco 解码器通过 `decoderPath` 指定。

```js
const v = await BuildingOSTwin.create('#twin', { model: 'smart.buildingosmap', theme: 'light.acstyle', key, decoderPath });
v.focus('A');                       // 不支持的能力是 no-op，返回 false
v.highlight(['A-2F-201']);
v.on('select', e => e.id);
v.capabilities();                   // 当前模型支持的能力列表
```

### 4.9 ioc 硬约束的处理

| 约束 | 处理 |
|---|---|
| 1 上层只认名字 | 保留。清单改为**纯数据目录**（第 9 节）加上 provider 动态 import |
| 2 异步卡片 | 基础块和组件改为全局注册的 Custom Elements |
| 3 Three r115 | **取消**：升级到 0.186.1（K22、`docs/THREE-UPGRADE.md`）；现有场景通过兼容外观保持 r115 的画面 |
| 4 回落默认值 | 保留（材质槽） |
| 5 AI 只有一个写口 | 升级为「一个写入关口」，AI 和人工的写入都走同一个关口（7.4） |
| 6 style-dump | 保留 |

### 4.10 新模型的生产方式（K20）

现有的程序化模型（如 `createSmartCampus.js`「参考照片制作」）本来就是「看图写代码」生产出来的。重构后把这种方式固化成一份规范，以后新楼宇都走同一条路：

```
《模型编写规范》 + 效果图 + CAD（图纸截图 / PDF / 标注尺寸）
        │  交给大模型
        ▼
models-src/<id>/buildModel.js  +  semantics 片段  +  site 元数据
        │  bosmap build（无头浏览器）
        ▼
<id>.buildingosmap  →  bosmap inspect  →  perf-scene / interact-scene  →  人工看效果
        │  不通过：把报告回给大模型修改
        ▼
入库，发布
```

**交付物**：`docs/MODEL-AUTHORING-SPEC.md`（《模型编写规范》）。**在 P1 完成 Smart 重构之后，从实际跑通的 Smart 代码中总结出来**，而不是先写。规范至少包括：

| 章节 | 内容 |
|---|---|
| 输入清单 | 大模型需要的材料：效果图（至少主视角 + 俯视角）、CAD（总平面、各层平面、立面，标出尺寸和层高）、楼栋 / 楼层 / 房间清单、要点击的对象清单；缺什么时怎么估算、怎么标注「估算」 |
| `buildModel()` 契约 | 函数签名、返回结构、禁止事项（不建 renderer、不碰 DOM、不启循环）、固定随机种子、资源释放 |
| 坐标与单位 | 米、y 轴向上、原点和朝向的约定；CAD 尺寸怎么换算 |
| 语义命名 | 楼栋 / 楼层 / 房间 / 设备 id 的命名规则（与 4.2 的命名空间一致）、`node.name = <语义id>\|<槽名>` |
| 材质槽 | 可用槽名清单、每个槽的视觉含义、什么时候用预设库（幕墙、反射） |
| 合并与拾取 | 4.4 的合并键规则、节点数上限、哪些对象必须可拾取 |
| 实例、路径、行为 | 树、车等重复对象怎么写 `instances`；车流路径怎么写 `paths` 和 `behaviors` |
| 标签与机位 | `anchors` 的写法、默认机位和命名机位 |
| 室内楼层 | 室内覆盖层的建模粒度（墙、房间、门窗、家具到什么程度） |
| 性能预算 | draw call、三角形数、包体积上限 |
| 验收 | `bosmap build` / `inspect` / 性能与交互脚本全部通过，加一张与效果图同机位的对比截图 |
| 示例 | Smart 园区的完整 `buildModel.js` 作为范例；一段可以直接使用的提示词模板 |

规范同时作为 DSH 的一个技能（`model-author`）提供，以后可以在 studio 里上传效果图和 CAD，由 AI 生成模型草稿（放在 P1 之后的扩展，不进当前阶段）。

---

## 5. 页面层

### 5.1 三层结构和双轨内容

| 层 | 内容 | 没有 AI 时 | 有 AI 时 |
|---|---|---|---|
| 骨架 | 项目、页、布局、场景、数据源、翻页和态势 | 可视化编辑 | `apply_spec_patch` |
| 规范 | 令牌、工具类、skin、结构化块、Custom Elements、绑定语法 | 选主题、改令牌 | 作为技能 `ioc-designer` 提供给 AI |
| 内容 | **结构化块卡**（主力）/ **HTML 块**（直出） | 拖放、在属性面板里改 | 两种都可以写；复杂排版优先用 HTML 块 |

**结构化块**（ARCHITECTURE §10 路线 B）：

```jsonc
{ "kind": "blocks", "box": [...], "blocks": [
    { "kind": "metric", "label": "在园总人数", "bind": "main.people.total", "unit": "人" },
    { "kind": "list", "bind": "main.people.detail", "columns": ["名称","人数"], "max": 5 } ] }
```

第一批块：`metric list ring line progress text table`。现有 15 张 Vue 卡保留为 `kind: widget`，以后逐步改写成块组合。

**HTML 块**：AI 生成，或者从结构化块「转为 HTML」得到。满意的 HTML 块可以「存为我的组件」。

### 5.2 样式注入（K14）

- 令牌（CSS 变量）从宿主文档继承，天然穿透 shadow root。
- 主题包里的 `skin`（例如 `light-orange/skin.js` 导出的 CSS 字符串）和工具类，在主题加载时编译成 `CSSStyleSheet`，每个块的 shadow root 都通过 `adoptedStyleSheets = [utilities, skin, blockLocal]` 注入。换主题时替换同一个 sheet 对象，所有块同步更新。
- 块的局部 CSS 经过 7.5 的校验之后再编译成 sheet。

### 5.3 数据绑定和编辑回写

- `data-bind`：块渲染时扫描一次，登记到 DataProvider 的订阅表（沿用现有 `useDataSlot`），数据更新时只改被绑定节点的 `textContent` 或组件属性。**不用 MutationObserver**。
- 直接在画面上改字：只有带 `data-editable` 的元素开启 `contenteditable`。保存时从 DOM 序列化，过 7.5 的校验，再写回 `.html`。结构性改动（增删元素）不允许手工进行，要通过 AI 或「转为 HTML 后在代码视图里编辑」。

### 5.4 项目格式和现有站点的迁移

项目 = 一组页；`mode` 为 `dashboard` 或 `deck`。完整的 JSON Schema（`project.json`、`pages/*.json`、`queries/*.json`）在 P0 冻结，`specVersion` 从 1 开始。

**升版规则**：ioc-contracts 附带 `migrate(vN → vN+1)`；player 可以读取当前版本和上一个大版本；导出时统一写成当前版本。

**现有 `src/sites/` 和 `src/projects/` 的映射**（v1 遗漏了这部分）：

| 现有 | 新位置 |
|---|---|
| `sites/<id>/site.js` 元数据和默认值 | 模型的 `semantics.json`（楼栋、楼层、面积等），加上项目模板里的 `defaults` |
| `sites/<id>/views.js` 六个态势 | 项目模板的 `pages/*.json`（dashboard 下每个态势一页） |
| `sites/<id>/data/mock.js` | 项目的 `assets/data/mock.json`（`mock` 数据源） |
| `sites/<id>/models/*.js` | `models-src/<id>/buildModel.js`，编译成 `.buildingosmap` |
| `projects/*-dashboard/project.js`（稀疏覆盖） | 由迁移脚本展开成完整项目：园区默认值 + 覆盖 |
| `projects/jili-smart-deck/project.js`（`overrides.views` + 逐页机位） | 由迁移脚本转成 `pages/*.json`，机位写入 `scene.camera` |
| 大屏三块浮层（专题视图、楼栋档案、楼层平面图） | dashboard 外壳保留浮层；deck 下使用 `summary`、`building`、`plan` 三张卡（现状不变） |
| 本机草稿 `ioc:deck-views`、`ioc:deck-layouts` | 继续作为本机草稿；「保存到项目」改成调用 apps/ioc 写入草稿 |

迁移脚本 `scripts/migrate-legacy.mjs` 在 P2 交付。P1 和 P2 的「行为不变」边界见 11.3。

### 5.5 数据源

| type | 说明 |
|---|---|
| `mock` | 演示数据 |
| `snapshot` | 导出离线包时冻结下来的数据 |
| `query` | **具名查询引用**：`{ "domain": "netops", "template": "device.list", "params": {...}, "refresh": "60s" }`。由 apps/ioc 代理到领域数据服务执行（见 8.6） |
| `rest` / `ws` / `mqtt` | 保留 |

---

## 6. player、导出和离线

- player 只预构建一次；导出 = player 加上项目的**一个确定版本**（`revision`）。
- **目标内核**：V0-3 记录交付的 exe 的 Chromium 版本，player 的 `build.target` 与之对齐。
- `web.zip` 增加 `manifest.json`：`specVersion`、`revision`、player 构建号、文件清单和 sha256、运行时依赖清单（Draco 解码器、Worker、字体）。
- 断网验收包括：字体、Draco 解码器、Worker、全部数据源（`query` 自动冻结为 `snapshot`）。
- 离线包不含 AI。

---

## 7. 服务层：buildingos/apps/ioc

### 7.1 脚手架和手工修正清单

`npm run scaffold:micro -- ioc 数字孪生展示 3040` 生成的结果与宿主实际行为不一致，需要逐项修正（P0 交付）：

| 脚手架产物 | 问题 | 修正 |
|---|---|---|
| 不生成 `service-registry-entry.json` | 宿主 autoDiscover 找不到这个文件就跳过，服务不会被注册 | 手工补上：`mode: local_module`、`installMode: local_apps`、`entryModule: apps/ioc/dist/app.module.js`、`prefix: /ioc` |
| `menu.json` 是 `{groups:[…]}` 对象 | 注册流程要求数组，否则菜单是空的 | 改成规范要求的数组 |
| `app.module` 默认 `DB_TYPE=postgres`、`synchronize:false`，并捕获 42P01 | 与「不用数据库」冲突，会去连 PG | **删掉 TypeORM**，改为注入 ProjectStore |
| `main.ts` 没有前缀，Swagger 在 `api` | 宿主已经在 `/ioc` 挂载一层，再加前缀会变成双重前缀 | 前缀由环境变量 `IOC_STANDALONE_PREFIX` 控制：独立运行时为 `ioc`，挂载时为空；Swagger 使用宿主的合并文档 `/api-json-merged` |

端口 3040 空闲（实际已占用：3003、3010、3011、3012（report 的 .env.example）、3015、3016、3024–3038 的双数；3018/3020/3022 空闲，规范文档第 93 行的端口表已经过期，要一并更正）。

**两种运行模式**：宿主挂载（`local_module`，默认）和独立进程（`npm start`，用于开发和调试）。路由、静态资源路径、SSE 和 MCP 在两种模式下的地址都通过 `IOC_PUBLIC_BASE` 生成，不写死。

### 7.2 身份与授权（K15）

- 服务端**授权上下文** `AuthCtx = { userId, projectId, domain, sessionId?, draftId?, ops[] }`。REST、SSE 订阅、预览地址和 MCP 调用**都校验这个上下文**；不信任请求体里的项目 id，也不信任模型传进来的项目 id。
- apps/ioc 内置 `IocAuthGuard`，用宿主 auth 模块的同一密钥（`JWT_SECRET`，默认 `BuildingOS`）校验宿主签发的 JWT；不复用宿主的 passport 策略，因为子应用可能解析到另一个 passport 实例（V0-5）。宿主没有全局 `APP_GUARD`，所以 guard 要在 apps/ioc 的控制器上显式挂上。
- SSE 订阅无法带请求头，允许 GET 时用 `?access_token=`，日志必须脱敏；P3 可改为 fetch 读流，这样就能带请求头。
- 本机演示模式（`IOC_DEMO=1`）：名单选人、免登录，**只监听回环地址**，启动时打印警告。
- 预览地址带短时签名 token，绑定 `projectId + draftId`，15 分钟过期。
- S3 的 `scene_command`：要校验授权（观看端不能发指令）、限频（初始每个会话每秒 2 次），并按项目隔离广播。

### 7.3 存储事务（K5）

```
IOC_DATA_DIR/users/{u}/projects/{p}/
├─ project.meta.json          { currentRevision, revisions: [...] }
├─ revisions/{rev}/           不可变的完整版本（project.json、pages/、blocks/、queries/、assets 清单）
├─ assets/{sha256}.{ext}      资源按内容寻址，各版本共享
├─ drafts/{draftId}/          { baseRevision, owner, sessionId, changes/, tombstones.json }
└─ current → revisions/{rev}  当前版本指针（current.json，原子替换）
```

- **修订号**：`projectRevision` 单调递增。每个草稿记录 `draftId` 和 `baseRevision`。
- **并发**：每个 AI 会话或每次人工编辑各用一个独立草稿。发布时如果 `baseRevision ≠ currentRevision`，就返回冲突并给出 diff；不自动覆盖。
- **删除**：草稿中的删除操作记在 `tombstones.json` 里。
- **原子发布**：发布时先生成新的 `revisions/{rev+1}/`（写临时目录再 rename），然后原子替换 `current.json`（写临时文件再 rename）。中途失败不影响当前版本。
- **写锁**：每个项目一把进程内写锁，用于发布和恢复。多进程部署时改用文件锁，第一版只支持单进程。
- **导出和恢复**都绑定确定的 `revision`。
- **路径安全**：所有 id 必须匹配 `^[A-Za-z0-9_-]{1,64}$`；路径归一化后必须位于项目根目录之内。
- **上传和 zip**：限制单个文件大小、文件数量和解压后总体积（初始值：单文件 200MB，1000 个文件，解压后 1GB）；拒绝 `..` 和绝对路径；.buildingosmap 上传时要校验 manifest 和哈希（旧格式 .acmap 只校验能否解密）。
- **保留策略**：`revisions/` 默认保留最近 50 个版本，加上所有被导出引用过的版本；清理不再被引用的资源。

### 7.4 写入关口

AI（MCP）和人工（REST）的写入**走同一个服务端关口**：权限 → 净化和校验（7.5）→ 写入草稿 → SSE 推送。校验不通过就**拒绝写入**：AI 收到结构化错误后自行修正；人工在 studio 里看到错误，不能保存。

### 7.5 HTML / CSS / 资源校验规范

用 DOM 解析器实现（服务端 parse5 + DOMPurify；**不用正则**）。前后端共用 `ioc-contracts` 里的同一份规则表。

| 对象 | 规则 |
|---|---|
| 标签 | 白名单：常规排版标签，加上 `ioc-*` 组件标签；禁止 `script iframe object embed form link meta base svg>foreignObject` |
| 属性 | 禁止所有 `on*` 属性；`style` 属性按 CSS 规则校验；`href`/`src` 只允许项目内的相对路径或 `data:image/(png|jpeg|webp)` |
| CSS | 禁止 `@import`、`expression()`、`behavior`、`-moz-binding`；`url()` 只允许项目内的相对路径，归一化后要在 `assets/` 之内；颜色字面量给警告，令牌以外的颜色超过阈值时拒绝 |
| 组件属性 | 按各组件的 `propsSchema`（JSON Schema）校验 |
| `data-bind` | 数据源和槽必须存在，且当前用户有权访问 |
| `data-action` | 动作在白名单中；目标实体在模型语义里存在；当前用户对这个动作有权限；场景动作要求当前模型的 `capabilities` 包含它 |
| 体积 | 单个块 ≤ 32KB；单页块数 ≤ 40 |
| 页面 CSP | player 设置 `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'` |

XSS 用例集（包括 CSS 和 SVG 变体）在 P2 交付，并纳入 CI。

### 7.6 接口

REST（全部带 AuthCtx）：用户、项目、页、块、查询引用、资源、草稿（`GET/POST drafts`、`POST drafts/{id}/publish`、`DELETE drafts/{id}`）、版本（`GET revisions`、`POST revisions/{rev}/restore`）、导出（`POST export?revision=`）、AI 会话（转发到 gateway）、查询代理（`POST query/run`）。
SSE：`GET /ioc/live?project=&draft=`（推送草稿变更、AI 事件、场景指令）。
MCP：`/ioc/mcp`（Streamable HTTP）。静态资源：`/ioc/app/*`（SPA fallback 复用宿主已有的 `express.static` 写法）。

完整的 OpenAPI 在 P0 冻结。

---

## 8. AI：harness 平台

### 8.1 原则

AI 负责搭建，数据流动不经过 AI；结论必须带 `evidence[]`（harenss CONTRACTS E）；AI 不写 SQL（K18）。

### 8.2 harenss 仓库调整（现状 → 目标）

| 现状 | 目标 |
|---|---|
| `harness/service/`：Dockerfile、start.sh、assemble.py、health-check.sh | `harness/image/`（DSH 镜像，三个域共用）+ `harness/service/`（**新写** gateway，C1、C2、C3 目前没有任何实现） |
| `harness/profile|skills|prompts|rules|knowledge` | 移到 `harness/domains/netops/` |
| —— | `harness/core/`：toolbox-registrar、evidence-guard、credential-ref、draft-gate |
| —— | `harness/domains/ioc/`、`harness/domains/iot/` |
| `apps/web`（IOC 前端的逐字节副本，118 个文件，另有 netops 专有的 `HealthCheck.vue`） | **冻结**，P7a 迁出 `HealthCheck.vue` 后删除（K12） |
| `apps/probe`（Node/JS） | 不在 ioc 范围内。MILESTONES M0 写的是「Python 重写」，和现状不一致，**交 harenss 负责人确认**：改 M0 描述，或者按计划重写 |
| `apps/api`、`apps/worker` 不存在 | 新增 `apps/netops-api`（领域数据服务，K17），P7b 交付 |
| `packages/contracts` 不存在（CONTRACTS.md 要求有） | 新增。承载 C、F 两节的 JSON Schema；ioc 这边的契约由 `@buildingos/ioc-contracts` 提供 |
| `deploy/v3-frozen`（无法构建：构建上下文错误，`apps/worker`、`config/`、`harness/plugins` 都不存在；8090 映射在 3090 上是无效配置） | 标记为 legacy。以 `deploy/docker-compose.infra.yml`（3090）为基础新写 `deploy/compose.yml` |

### 8.3 DSH 部署

沿用 harenss 已经验证过的做法：源码构建并钉住 `DSH_REF` 到确定提交；凭据先落 `/run/secrets`，只在首次启动时以 600 权限装入；每次启动都覆盖 `cordis.patch.yml` 和 `package.json`；在 patch 层把 `webserver` 的 host 设为 `0.0.0.0`；替换 `code-runtime` 时覆盖同一个 id；使用 `tools.mode: ptc`。

端口：DSH 在容器内监听 **3090**（`NETOPS_DSH_PORT` 或各域自己的变量）；**gateway 使用 8090，这是新分配的端口**（v1 说是「沿用约定」，这个说法不成立）。

dsh-ioc 镜像额外包含：Chromium 和 Playwright 的依赖（`@playwright/mcp` 需要）。

### 8.4 ioc 域

```yaml
- id: webserver
  config: { host: '0.0.0.0', port: !!js Number(process.env.DSH_PORT ?? 3090), compression: gzip, compressionLevel: 1, compressionThresholdBytes: 1024 }
- id: tools
  config: { mode: ptc }
- id: agent-default-model
  config: { provider: deepseek-official, model: <强模型，按 D8 配置>, reasoningEffort: high }
- insert:
    - id: ioc-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: ioc
        transport: streamable-http
        url: !!js process.env.IOC_MCP_URL          # 宿主对外地址 + /ioc/mcp（不是 3040）
        headers: { Authorization: !!js ('Bearer ' + process.getBuiltinModule('node:fs').readFileSync('/run/secrets/ioc-mcp-token','utf8').trim()) }
        failOnStartupError: !!js process.env.NODE_ENV !== 'production'
    - id: browser
      name: '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp'
- id: system-prompt
  config: { personaSuffix: '…只能通过 mcp__ioc__* 写入草稿…' }
```

**凭据链**：MCP 服务 token 由部署方放在 `/run/secrets/ioc-mcp-token`，只在 profile 加载时读取，**模型看不到**。v1 把引用名直接当成 Authorization 的值，这个问题已经修正。

**会话绑定**：服务 token 只证明「这是 dsh-ioc 容器」。**每次调用属于哪个项目和草稿**，由会话绑定来确定：

V0-4 实测：DSH 的 mcp-client **不会**把会话标识传给 MCP server（请求头只有静态配置，`_meta` 为空）。因此采用**「一个 AI 会话一个 DSH 运行时进程 + 进程级 token」**：

1. apps/ioc 创建 AI 会话时生成 `AuthCtx`（`userId + projectId + draftId + ops`），签发一个 15 分钟、可续期的会话 token；
2. gateway 为这个会话启动独立的 DSH 运行时进程，把 token 写进该进程专用的 secrets 文件（`IOC_MCP_TOKEN_FILE`），profile 的 `headers` 在启动时读取；
3. MCP 调用携带这个 token，apps/ioc 用它找回 `AuthCtx`。**模型全程看不到 token，工具参数里也不需要传。**

**可观测性**：gateway 的 `/v1/capabilities` 暴露 MCP 连接状态；studio 显示「AI 写入通道：可用 / 不可用」。MCP 断开时，写工具会消失，这个状态必须可见，不能静默降级。

**MCP 工具**：`get_catalog`、`get_project`、`get_page`、`get_block`（读）；`apply_spec_patch`、`write_block`、`bind_query`（写草稿；`bind_query` 只能引用已注册的模板）；`validate`、`preview_url`（读）；`scene_command`（临时，受 7.2 的限频约束）。

### 8.5 草稿关口

见 7.3 和 7.4。在线大屏默认「等操作员确认」，项目级开关可以改为自动采用。`scene_command` 即时生效，但要经过授权和限频。

### 8.6 具名查询和领域数据接口（K17、K18，新增 CONTRACTS F 节）

- 查询模板**在领域数据服务里注册**，包括：`id`、参数的 JSON Schema、结果 schema、所需权限、限额（行数、超时、时间范围）、缓存 TTL、可订阅性、离线冻结规则。
- apps/ioc 通过 `GET /catalog/queries` 拉取模板目录，提供给 `get_catalog` 和 studio。
- 执行：`POST /ioc/query/run {domain, template, params}` → apps/ioc 校验 AuthCtx → 代理到领域服务 → 领域服务做领域授权并执行。
- 错误码：`E_PARAM`、`E_FORBIDDEN`、`E_LIMIT`、`E_TIMEOUT`、`E_UPSTREAM`。
- 订阅：领域服务提供 SSE 时，apps/ioc 负责转发；不提供时退化为轮询，间隔用 `refresh`。
- 离线：导出时对每个引用执行一次，把结果存为 `snapshot`，并记录执行时间。
- iot 的模板集合等 buildingos.ai 的数据获取规范提供后注册；netops 的模板集合随 P7b 交付。

### 8.7 netops 域

沿用 harenss 设计文档：D2、D5、D6、D7、D9、D13，CONTRACTS B、E，技术方案 5.2 到 5.4，MILESTONES M0 到 M3 的验收。修改点：D12（K9）、呈现归到 ioc（K10）、数据经 netops-api（K17）、probe 的语言交负责人确认（8.2）。

### 8.8 需要同步修改的文档

harenss：CONTRACTS C（增加 domain、事件类型扩充、事件恢复 `since=` 游标、取消和认证）、B（增加 `domain` 和 `level`）、新增 F；DECISIONS D1、D4、D12，以及末尾「目录结构」的对齐；README 的仓库定位；MILESTONES M0 的 probe 语言。
buildingos：`docs/microservice-module-spec.md` 第 93 行的端口表；脚手架补上 `service-registry-entry.json`、数组形式的 `menu.json`，并提供不带数据库的选项（可选，也可以只靠 7.1 的手工修正）。
ioc：`CLAUDE.md` 硬约束 5、能力表、项目格式的入口。

---

## 9. 目录变化

### 9.1 buildingos.ioc

```
packages/
  ioc-contracts/   纯数据：JSON Schema（project/page/query/buildingosmap manifest/semantics）、
                   catalogue（组件和块的 propsSchema、布局、主题元数据、能力名单、数据槽），
                   validate / patch / serialize / migrate、html-lint 规则表；不依赖 Vue 和 Three；ESM+CJS+d.ts
  twin-runtime/    Viewer、loaders（v2 / v1 / procedural / stream）、材质预设、行为插件、pick
  ioc-ui/          布局、结构化块渲染器、HTML 块宿主、主题注入、Custom Elements、现有卡片
  map-tools/       bosmap build（无头浏览器）/ pack / inspect / acmap 导入
apps/player  apps/studio
models-src/<site>/buildModel.js    （来自 src/scene 和 src/sites/*/models）
templates/<site>/                  （来自 src/sites 和 src/projects，由迁移脚本生成）
spec/                              规范文档本体（给 ioc-designer 用）
scripts/                           现有 5 个脚本 + perf-scene / interact-scene / migrate-legacy
```

清单改成纯数据加 provider 动态 import，同时解决 CLAUDE.md 里记录的「搭建页白拉 Three 包」问题。

### 9.2 buildingos

新增 `apps/ioc`。

### 9.3 buildingos.harenss

见 8.2。

---

## 10. 风险

| 风险 | 概率/影响 | 应对 |
|---|---|---|
| DSH SDK 运行时缺少 cancel / resume（V0-4 实测只有 initialize、session/prompt、shutdown） | 已确认/中 | 取消靠结束会话进程，续接由 gateway 记录事件日志；向上游反馈，web profile 的 Connection 协议作为后续评估项 |
| 每个会话一个进程的资源开销（约 1.4 s 启动、约 315 MB 内存） | 已确认/中 | 按内存设并发上限并排队（D13）；会话空闲超时回收；预热一个空闲进程 |
| MCP 拿不到会话标识 | 已确认/低 | 8.4 的进程级 token（已验证） |
| 合并后拾取和高亮回归 | 中/高 | 4.4 的合并键和 `pick.bin`；交互回归用例是验收门槛 |
| v1 的渲染与 AirocovMap 不一致 | 高/中 | 以 1.3.0 的截图为基准，按图层逐步对齐 |
| 烘焙后体积大 | 中/中 | 合并、实例化、Draco、体积预算；不达标就退回 procedural |
| HTML 块 XSS | 中/高 | 7.5 的校验、CSP、用例集进 CI |
| 并发写覆盖 | 中/高 | 7.3 的修订号、独立草稿、原子发布 |
| 接口裸奔 | 高/高 | K15，从 P3 起生效 |
| AI 查询突破只读边界 | 中/高 | K18，AI 不写 SQL |
| 前端双份代码分叉 | 已发生 | K12，P0 删除加 CI 检查 |
| 计划文档分叉 | 已发生 | V0-0 纳入 git，加 sha256 检查 |
| 离线包在 exe 的内核上跑不起来 | 中/中 | V0-3 记录内核版本，对齐 build target |
| explodeFloor 等能力在新模型下回归 | 中/中 | 4.2 的能力矩阵和回落路径 |
| netops 路线图体量被低估 | 高/中 | P7 拆成 7a 和 7b，7b 按 harenss 自己的节奏并行 |

---

## 11. 执行计划

### 11.1 阶段与依赖

工作量是**单人估算**，在 V0 结束后重新校准；负责人在 V0 启动会上确定。

| 阶段 | 仓库 | 内容 | 依赖 | 估算 |
|---|---|---|---|---|
| **V0 验证** | 全部 | 见 11.2，共 6 项 | —— | 2 周 |
| **P0 契约冻结** | ioc、buildingos、harenss | `ioc-contracts`（Schema、catalogue、html-lint 初版，双格式构建）；apps/ioc 的 OpenAPI；C1/C2/C3/C4/F 的契约；7.1 的脚手架修正；冻结 harenss 的 `apps/web`；计划文档纳入 git。**不做大规模目录搬迁** | V0 | 1 周 |
| P1 模型 | ioc | `buildModel()` 拆分（先做 Smart）；Viewer；能力矩阵；v2 编译（无头浏览器）；`pick.bin`；v1 解析转几何（从 P5 提前到这里）；性能和交互门槛；**从 Smart 总结出《模型编写规范》（4.10），并用它让大模型重建一栋小楼验证可用** | P0 | 3.5 周 |
| P2 页面 | ioc | 页面模型；结构化块 v1；HTML 块宿主和样式注入；校验和 XSS 用例；player；导出（manifest、内核对齐）；`migrate-legacy` | P0（可以与 P1 并行，模型先用 procedural） | 3 周 |
| P3 服务 | buildingos | ProjectStore 事务；授权（K15）；REST、SSE、静态托管；导出绑定修订号 | P0（可以与 P1、P2 并行） | 2 周 |
| P4 AI 闭环 | harenss + buildingos + ioc | gateway；dsh-ioc；MCP 和会话绑定；studio 的 AI 面板；**studio 的用户和项目管理界面**（v1 没有归属，现在归 P4，仓库是 ioc） | P2、P3、V0-4 | 2.5 周 |
| P5 嵌入 | ioc | UMD 和 ESM 构建、嵌入示例页、嵌入 API 文档 | P1 | 1 周 |
| P6 在线大屏 | ioc + buildingos | live 路由、`scene_command`、多端广播、语音 | P4 | 1.5 周 |
| P7a netops 呈现 | ioc | 网络治理模板；`topology`、`device-card`、`finding` 组件；楼层等轴视图 | P2；netops-api 的契约（F 节） | 2 周 |
| P7b netops 产品 | harenss | 按 MILESTONES M0 到 M3，另加 netops-api | P0 的契约；可以与 P1–P6 并行 | 按 harenss 自己的计划（约 5 周以上） |
| P8 iot | harenss + buildingos.ai | iot 域、模板注册 | buildingos.ai 的数据规范 | 待定 |

关键路径：**V0 → P0 → P2/P3 → P4**。P1 和 P5 在旁线；P7b 自己独立一条线。

### 11.2 V0 验证项（每项都要给出书面结论和可以运行的最小代码）

| # | 验证内容 | 通过标准 | 这个结论决定什么 |
|---|---|---|---|
| V0-0 | 两份计划文档纳入 git，加 sha256 一致性检查 | CI 通过 | 单一来源机制 |
| V0-1 | 真实 v1 文件：23F 加至少 2 个其他样本，解密、解析、拉伸，与 AirocovMap 1.3.0 截图对比 | 各图层都能显示；`iv` 字段的含义确认 | 4.6 |
| V0-2 | Smart 在无头浏览器里执行 `buildModel()`，导出 glb，打包，由 Viewer 加载，完成楼栋拾取和高亮 | 能拾取；先采一次性能基线 | 4.4、4.7 的阈值 |
| V0-3 | 最小 `web.zip`（player 加一页加一个 HTML 块加 Draco 解码器）在交付的 exe 上打开 | 能运行，并记录 Chromium 版本 | 第 6 节的 build target |
| V0-4 | gateway 最小实现：创建 DSH 会话、发消息、流式事件、取消、断线后恢复；DSH 通过 streamable-http 调用一个 MCP 写工具；确认 MCP 调用能否拿到会话标识 | 端到端跑通 | 8.4 用哪种会话绑定；gateway 与 DSH 的通信方式 |
| V0-5 | 在 buildingos 宿主以 `local_module` 挂载一个最小的 apps/ioc：REST、SSE 推送、JWT guard、静态托管 | 通过宿主地址可以访问 | K16、7.1 |

### 11.3 P1 和 P2「行为不变」的边界

- **包括**：Smart 的大屏和演示（`jili-smart-deck` 的五页）；楼栋拾取；视角保存、还原、复制代码；自由摆放；态势切换；三块浮层在 dashboard 下的表现；deck 下的 `summary`、`building`、`plan` 三张卡；室内楼层覆盖层；`style-dump` 的对比结果不变。
- **不包括**（留在 procedural，后续再迁）：吉行的 explodeFloor（在吉行迁移时验收）；12 大场景页里依赖其他园区的部分。

### 11.4 园区迁移顺序

Smart → 吉行（包括 `jixing-twin`）→ relian → houston；另外**在 P1 内对 houston 做一次兼容性抽样**（它的网络和覆盖层配置比较特殊）。design-center 作为 Smart 的子模型，跟着 Smart 一起迁移。每个园区都用 4.7 的全部门槛验收。

---

## 12. 剩余的开放问题（V0 内关闭）

| # | 问题 | 当前倾向 | 在哪里关闭 |
|---|---|---|---|
| O1 | gateway 与 DSH 之间走 Connection 协议，还是走 SDK / CLI headless | **已关闭**：SDK 运行时，JSON-RPC over stdio，一个会话一个进程（gateway 用 Node 实现这套协议） | V0-4 ✅ |
| O2 | MCP 会话绑定用哪种方式 | **已关闭**：进程级 token（模型不可见） | V0-4 ✅ |
| O3 | 交付 exe 的 Chromium 版本 | **已关闭**：exe 是静态服务器 + 系统默认浏览器（开发机为 Chrome 153），构建目标维持 `chrome90` | V0-3 ✅ |
| O4 | probe 的语言（Node 还是按 M0 用 Python 重写） | 交 harenss 负责人 | P0 |
| O5 | buildingos.ai 的数据获取规范 | 等产品负责人提供 | P8 之前 |
| O6 | 各阶段的负责人和人力 | 在 V0 启动会上确定 | V0 |

---

## 13. V0 验证结论（2026-09-24）

完整报告：`docs/V0-REPORT.md`；验证代码在三个仓库的 `refactor/v0` 分支（ioc：`spikes/v0/`；harenss：`spikes/v0-gateway/`；buildingos：`spikes/v0-ioc-mount/`）。

| 项 | 结论 | 对计划的影响 |
|---|---|---|
| V0-0 | 计划纳入 git，`scripts/check-plan-sync.mjs` 校验正本与副本一致 | —— |
| V0-1 v1 兼容 | 40 个样本中 39 个能解密；两代元数据；`iv` 是楼栋偏移；几何与 1.3.0 一致；样式有 4 处差异；`极企展厅.acmap` 会让 1.3.0 报错，本加载器能读，但坐标分布异常 | 4.6 已更新 |
| V0-2 Smart 编译 | 现有程序化代码**已经按材质合并**（80 次 draw call，而不是 v1 所说的约 1000）；编译后 27 次（-66%），三角形不变，画面一致；拾取、高亮、显隐可用；**B 楼部分构件没有语义归属** | 4.1 的问题描述以此为准；4.7 的 draw call 门槛可以达到；《模型编写规范》要求每个 mesh 都有语义归属，编译器报告无归属的对象 |
| V0-2 体积 | glb 14.2 MB → weld + Draco 1.0 MB | 4.7 的首屏预算以压缩后为准；编译器默认执行 weld + Draco |
| V0-2 帧耗时 | 云端只有软件渲染，无法判断 | `perf-scene.mjs` 必须在开发机的真实 GPU 上运行 |
| V0-3 离线包 | 开发机（exe + Chrome 153 + Radeon 780M）10 项自检全过：Draco 模型可见首帧 759 ms，HTML 块、data-bind、data-action、Worker 正常，无外网请求 | 第 6 节成立；exe 端口随机，离线包不依赖浏览器存储 |
| V0-4 DSH | SDK 运行时 + MCP（streamable-http）端到端打通；MCP 不带会话标识；SDK 没有 cancel / resume；单进程约 1.4 s 启动、约 315 MB 内存；MCP 不可用时启动直接失败 | 8.4 已更新（O1、O2 关闭）；风险表已更新 |
| V0-5 宿主挂载 | 按宿主 module-loader 的方式挂载，与独立进程两种模式下 REST、SSE、JWT、静态托管、路径校验结果一致；没有双重前缀 | K15、7.2 已更新；**在真实宿主上挂载**列为 P3 第一项 |

**V0 通过，进入 P0。**

---

## 附录 A · 评审意见处理表

「采纳」= 按意见修改；「部分采纳」= 方向同意但处理方式不同；「不采纳」= 附理由。

### A.1 ChatGPT

| # | 意见 | 处理 | 落点 |
|---|---|---|---|
| 1 | 按材质槽合并与拾取、高亮冲突 | 采纳 | 4.4、4.7 的交互门槛 |
| 2 | 草稿缺少事务和并发设计 | 采纳 | 7.3 |
| 3 | 身份授权不能推迟到 P6 | 采纳 | K15、7.2 |
| 4 | HTML 校验不足以构成安全边界 | 采纳 | 7.4、7.5 |
| 5 | netops 数据链路与具名查询的阶段不匹配；与 netops-api 的分工 | 采纳 | K17、8.6、P7a/P7b |
| 6 | 关键验证太晚；并行判断偏早；studio 的归属 | 采纳 | V0、11.1（v1 的 P1/P2 都在 ioc 仓库，「分属不同仓库」的说法已删除） |
| 7 | 编译器缺少输入接口和运行环境；首帧定义 | 采纳 | 4.1、4.7 |
| 8 | 共享包、ESM/CJS、纯数据 catalog | 采纳 | K19、9.1 |
| Q2 | 两种挂载模式 | 采纳 | 7.1 |
| Q6 | 同运行时不等于可以直接集成 | 采纳 | V0-4 |
| Q8 | 即时指令也要授权和限频 | 采纳 | 7.2 |
| Q9 | 断网验收要覆盖字体、解码器、Worker | 采纳 | 第 6 节 |
| Q10 | Houston 提前抽样 | 采纳 | 11.4 |

### A.2 DeepSeek

| # | 意见 | 处理 | 落点 |
|---|---|---|---|
| §0 | 附件版与仓库版不一致；没有纳入 git | 采纳。本稿覆盖两份副本 | 抬头、V0-0 |
| 2.2-1 | webmap 没有 DXF 链 | 采纳（核实属实）。产品负责人确认 DXF 链是失败的工具链，不考虑；新模型改为规范驱动的大模型建模 | K20、4.6、4.10 |
| 2.2-2 | 图层清单不全（23F 有 floor/seat/desk） | 采纳（核实属实） | 4.6 |
| 2.2-3 | 根对象没有 `version`，版本号是 `MAP_VERSION` | 采纳（核实属实，值为 1.3.1） | 4.6 |
| 2.2-4 | 根对象的 `iv` 字段意味着文件自带 IV | **不采纳结论，采纳核实动作**。23F 中 `iv=[0,0]`，与 webmap 生成脚本中紧挨 `center` 的同名坐标字段一致，判断为坐标偏移，不是 AES IV；V0-1 用更多样本确认 | 4.6、V0-1 |
| 2.2-5 | 旧 ESM 源码是无人引用的代码，验收应以 1.3.0 为准 | 采纳 | 4.6 |
| 2.2-6 | 漏了 explodeFloor/closeFloor；没有人声明 highlight | 采纳（核实属实） | 4.2 |
| 2.2-7 | 端口依据不准 | 采纳 | 7.1 |
| 2.2-8 | 8090 不是「沿用约定」；v3-frozen 无法构建 | 采纳 | 8.2、8.3 |
| 2.2-9 | 脚手架与宿主实际不一致 | 采纳（核实属实） | 7.1 |
| 2.2-10 | probe 是 Node，与 M0 的 Python 描述矛盾 | 采纳为待确认项 | 8.2、O4 |
| 2.2-11 | harenss 的 apps/web 是 IOC 副本 | 采纳（核实：validate.js、SceneHost.js、createSmartCampus.js 逐字节相同） | K12 |
| 2.2-12 | gateway 没有任何实现；DSH 的 Node 版本要求 | 采纳 | 3、8.2、V0-4 |
| B1 | 合并粒度与拾取 | 采纳 | 4.4 |
| B2 | Shadow DOM 与工具类、skin 互斥 | 采纳，选用 `adoptedStyleSheets` 方案 | K14、5.2 |
| B3 | ioc-spec 跨仓库、纯数据目录 | 采纳 | K19、9.1 |
| B4 | local_module 下不能做 WS；MCP URL；双重前缀 | 采纳 | K16、7.1、8.4 |
| B5 | DSH 对外接口没有验证 | 采纳 | V0-4、风险表 |
| B6 | AI 写 SQL 突破边界 | 采纳，而且比建议更严：AI 完全不写 SQL | K18、8.6 |
| B7 | 接口无鉴权 | 采纳 | K15 |
| B8 | FileStore 并发、原子性、路径穿越 | 采纳 | 7.3 |
| B9 | 双份代码、计划分叉 | 采纳 | K12、V0-0 |
| B10 | 性能门槛缺指标、不可执行 | 采纳 | 4.7 |
| §4-§5 问题 1 | `src/sites` 的去向 | 采纳 | 5.4 |
| §4-§5 问题 2 | 应以 §10 路线 B 为主 | **部分采纳**：路线 B 作为无 AI 编辑的主力；HTML 块保留为 AI 直出通道（这是产品负责人的明确要求，AI 直接生成 HTML、不需要预先封装），两条轨道共用同一个关口 | K13 |
| §4 问题 2、3、4 | instances 布局、行为插件 API、anchors 文本、槽名 ABI | 采纳 | 4.3 |
| §4 问题 6 | SceneHost 行为与描述不符 | 采纳（核实属实） | 4.2 |
| §8 | failOnStartupError、凭据链、Chromium 镜像 | 采纳 | 8.3、8.4 |
| §11 | P5 太晚、P7 过大、缺负责人和工作量 | 采纳 | 11.1 |
| Q5 | 增加文本类块 | 采纳 | 5.1 的 `text` 块 |
| Q7 | 明确说明 v1 加密不构成保密 | 采纳 | 4.6 |
| Q10 | 补充 jixing-twin、design-center | 采纳 | 11.4 |

---

## 附录 B · 引用的其他项目规范（带核实状态）

| 来源 | 内容 | 用在哪里 | 状态 |
|---|---|---|---|
| webmap `src/acmap/utils/cryptoHandle.js` | AES-256-CBC、Base64、默认 key/IV | 4.6 | 已核实 |
| webmap `docs/ACMAP_FORMAT_SPEC.md` | v1 结构 | 4.6 | 已核实，但与实测样本有差异（根键和图层以实测为准） |
| webmap `public/mapData/acmap/23F.acmap` | 实测样本 | 4.6、V0-1 | 已核实 |
| webmap `src/acmap/core/Object3D.js` | 拉伸和合并（旧 ESM，无人引用） | 4.6 | 已核实；不作为一致性基准 |
| webmap `public/airocov/AirocovMap.js` 1.3.0（r122） | 线上引擎 | v1 验收基准 | 已核实 |
| webmap `src/acmap/core/MapData.js` | 主题的目录和文件双形式 | 4.5 | 已核实 |
| webmap `GlbToAcmapConverter.js` | GLB → acmap | 备用（拿到外部 GLB 时） | 已核实 |
| webmap DXF 链 | —— | 不考虑（失败的工具链） | 已排除 |
| ioc `src/scene/SceneHost.js` | 能力机制（未声明的方法不存在） | 4.2 | 已核实 |
| ioc `createCampus.js`、`createSmartCampus.js`、`createDesignCenterFloor.js` | 拾取、高亮、合并现状 | 4.4 | 已核实 |
| ioc `CLAUDE.md` | 硬约束 1–6、演示模式规则、skin 说明 | 4.9、5.2、5.4 | 已核实 |
| ioc `docs/ARCHITECTURE.md` §10 | A/B/C 三条路线 | K13 | 已核实 |
| buildingos `docs/microservice-module-spec.md` | 微服务规范 | 7.1 | 已核实；第 93 行端口表过期 |
| buildingos `scripts/create-microservice.js` | 脚手架 | 7.1 | 已核实；与宿主实际有 4 处不一致 |
| buildingos `service-manager/module-loader.service.ts` | local_module 挂载方式（不 listen） | K16、7.1 | 已核实 |
| buildingos `ai.controller.ts`、`service-manager.controller.ts` | SSE 先例 | K16 | 已核实 |
| buildingos `auth/guards/jwt-auth.guard.ts` | JWT | K15 | 已核实；没有全局 APP_GUARD |
| harenss `DECISIONS.md` D1–D13 | 决策 | 第 8 节 | 已核实 |
| harenss `CONTRACTS.md` A/B/C/E | 契约 | 第 8 节 | 已核实；C 没有实现 |
| harenss `MILESTONES.md` M0–M3 | 里程碑 | P7b | 已核实；M0 与 probe 现状矛盾 |
| harenss `harness/service/{Dockerfile,start.sh}`、`profile/cordis.patch.yml` | DSH 部署做法 | 8.3 | 已核实 |
| harenss `deploy/docker-compose.infra.yml` | 3090 | 8.3 | 已核实；v3-frozen 无法构建 |
| DSH `packages/mcp/mcp-client` | streamable-http、`mcp__<server>__<tool>` | 8.4 | 已核实 |
| DSH `docs/api-gateway.zh.md` 边界一节 | Remote 只负责一元调用，事件流走 Connection | V0-4 | 已核实 |
| DSH `package.json` engines | Node `^22.19 \|\| >=24` | 3、8.3 | 已核实 |
| DSH `browser-use-playwright-mcp` | 浏览器能力 | 8.4 | 已核实；需要 Chromium |
