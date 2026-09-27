# H²Z Tech · Logo 设计交付规格书（Photoshop 重建版）

> 用途：让你在 PS 里**按数字 1:1 重建**标识，或作为印刷厂/设计外包的交付依据。
> 矢量原件（7 个 SVG）在同目录，Illustrator 打开可无损编辑；本表用于 PS 重建与校对。
> 当前字标：**H²Z（上标，2 为安全橙）**；下标版 H₂Z 保留为备选。

---

## 1. 画布与母版尺寸

| 锁定 | 画布（1×） | 建议母版（4×，给印刷/车身） | 用途 |
| --- | --- | --- | --- |
| 横向主标识 | 720 × 200 px | 2880 × 800 px | 网站头部、名片、合同、邮件签名 |
| 堆叠标识 | 400 × 320 px | 1600 × 1280 px | 正方形/竖版、大屏角标 |
| 方形图标 | 128 × 128 px | 512 × 512 px | favicon、APP、工服胸标 |
| 单色图标 | 128 × 128 px | 512 × 512 px | 刺绣、钢印、单色印刷 |

> 全部为矢量，放大不损失；母版尺寸只为方便你在 PS 里对齐像素。

---

## 2. 图形部分：六边形（多边形工具 / 钢笔精确绘制）

| 项目 | 参数 |
| --- | --- |
| 形状 | 正六边形，**顶点朝上**（pointy-top） |
| 外六边形 · 横向锁定 | 中心 (100, 100)，外接半径 **R = 72**，填充 `#0A1A2F`（反白版：无填充 + 描边 `#FFFFFF`，4px） |
| 外六边形顶点坐标 | (100,28) (162.35,64) (162.35,136) (100,172) (37.65,136) (37.65,64) |
| 内六边形 · 横向锁定 | 同中心，外接半径 **R = 52**，**无填充 + 描边 `#F59E0B`，3px** |
| 内六边形顶点坐标 | (100,48) (145.03,74) (145.03,126) (100,152) (54.97,126) (54.97,74) |
| 堆叠版 | 中心 (200,110)，R 同 72 / 52 |
| 方形图标 | 圆角矩形 128×128，圆角半径 **26**，填充 `#0A1A2F`；六边形中心 (64,64)，**R = 46**，描边 `#F59E0B` 3.5px |
| 单色图标 | 六边形中心 (64,64)，**R = 50**，描边 `#0A1A2F` **7px**，无填充 |

**PS 操作要点**
1. 用「多边形工具」：边数 6，半径 72 → 画出的六边形默认朝向不是顶点朝上，**需旋转 90°（或 −90°）**；如需绝对精确，直接用钢笔按上表坐标绘制（更推荐，印刷厂认坐标）。
2. 内六边形单独一层，描边 3px、颜色安全橙，置于外六边形之上。
3. 图层命名建议：`HEX-outer`、`HEX-inner`、`MARK-H2Z`、`WORDMARK`、`TECH`、`DESCRIPTOR`。

---

## 3. 文字部分（字符面板参数）

| 元素 | 字体 | 字号 | 颜色 | 位置（基线） | 字距（PS Tracking） | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 六边形内 H·Z | Arial Black（或 Montserrat ExtraBold） | 38 px | `#FFFFFF` | (100, 113) 居中 | 0 | 横向锁定 |
| 六边形内 **2** | 同上 | **26 px** | `#F59E0B` | 上移 **9 px**（基线 104） | 0 | **上标**写法 |
| 字标 H·Z | Arial Black | 52 px | `#0A1A2F` | x=215，基线 y=95 | **+19** | 字标主体 |
| 字标 **2** | Arial Black | **34 px** | `#F59E0B` | 上移 **13 px**（基线 82） | 同上层 | **上标** |
| TECH | Arial Bold（700） | 30 px | `#F59E0B` | x=332，基线 y=95 | **+133** | 品牌扩展词 |
| 描述行 | Arial Semibold（600） | 14 px | `#64748B` | x=217，基线 y=134 | **+229** | 全大写：`CCTV · NETWORKS · AI MONITORING` |
| 堆叠版字标 | Arial Black | 48 px / **2** 为 31 px | `#0A1A2F` / 2 为 `#F59E0B` | 居中，基线 y=248 | +19 | 2 上移 12 px |
| 堆叠版 TECH | Arial Bold | 26 px | `#F59E0B` | 同行 | +133 | — |
| 堆叠版描述行 | Arial Semibold | 13.5 px | `#64748B` | 居中，基线 y=288 | +229 | — |
| 图标 H·Z | Arial Black | 30 px | `#FFFFFF` | (64, 76) 居中 | 0 | 方形图标 |
| 图标 **2** | Arial Black | **20 px** | `#F59E0B` | 上移 **7 px** | 0 | 上标 |
| 单色图标 | Arial Black | 28 px / 2 为 19 px | `#0A1A2F` | (64, 77) 居中 | 0 | 全单色 |

> **PS Tracking 换算**：`Tracking ≈ 字距 ÷ 字号 × 1000`。例：描述行 3.2px ÷ 14px = 0.229 → Tracking **229**。
> **上标做法**：把「2」单独一个文字层，字号调小、再用字符面板「基线偏移」上移对应 px；或自由变换上移后栅格化。

---

## 4. 颜色（屏幕 / 印刷）

| 名称 | HEX | RGB | CMYK（近似） | Pantone（近似） | 用途 |
| --- | --- | --- | --- | --- | --- |
| Primary Navy | `#0A1A2F` | 10, 26, 47 | 79 / 45 / 0 / 82 | 539 C 类深海军蓝 | 主色：可信、工业、夜间 |
| Safety Amber | `#F59E0B` | 245, 158, 11 | 0 / 36 / 95 / 4 | 137 C / 130 C | 强调：安全橙、下标/上标 2、车身高可视 |
| Deep Navy | `#0F2A4A` | 15, 42, 74 | 80 / 43 / 0 / 71 | 2965 C 类 | 深底分层 |
| Slate Gray | `#64748B` | 100, 116, 139 | 28 / 17 / 0 / 45 | Cool Gray 9 C 类 | 描述文字 |
| White | `#FFFFFF` | 255, 255, 255 | 0 / 0 / 0 / 0 | — | 留白 / 反白 |

> ⚠️ CMYK 与 Pantone 为**换算近似值**，正式印刷前必须打样/由印刷厂按色彩管理校准。

---

## 5. 字体方案与免费替代

| 用途 | 首选（系统自带/常见） | 免费替代（Google Fonts，商用可） |
| --- | --- | --- |
| 文字标识（H、Z） | **Arial Black** | **Archivo Black**、**Montserrat ExtraBold/Black** |
| TECH | Arial Bold | Inter SemiBold / Roboto Bold |
| 描述行 | Arial Semibold | Inter Medium / Roboto Medium（配 Tracking 229） |

> 交付印刷/商标前**必须把文字转曲（Outline）**，避免字体授权与替换导致字形变形。

---

## 6. 使用规则

| 项目 | 规则 |
| --- | --- |
| 最小尺寸 | 横向锁定 ≥ 120px 宽（印刷 ≥ 30mm）；方形图标 ≥ 16px |
| 留白 | 四周 ≥ 六边形内圈高度的 25%（约等于「2」字高） |
| 浅底 | 标准版（深蓝字 + 安全橙 2） |
| 深底/车身 | 反白版（白字 + 安全橙 2 + 白描边六边形） |
| 单色 | 单色图标版（刺绣/钢印/传真） |
| 字标「2」 | **永远是安全橙、永远比 H 与 Z 小、永远做偏移（当前上标）**；不得拉平、不得改成同色 |
| 描述行 | `CCTV · NETWORKS · AI MONITORING` 必须与主标识同行出现（品牌初期「Tech」不说明业务） |
| 禁止 | 拉伸压扁 · 改主色 · 压在杂乱照片上 · 去掉 TECH 与描述行 |

---

## 7. 背景文字（品牌故事 · 中英双语）

### 7.1 中文（官网 About / 品牌手册 / 提案首页）

> **H²Z Tech** 是一家位于休斯顿的家庭企业，由 **何铮（Zheng He）** 与 **朱家玲（Jialing Zhu）** 共同创立。
> 品牌名取自我们两人的姓氏 —— **H 到 Z** —— 也代表我们做事的方式：**从第一根线缆的铺设，到背后 24 小时盯守它的 AI，端到端全包**。
>
> 我们为休斯顿大区的仓库与厂房提供弱电、CCTV 与网络的一体化建设与托管：结构化布线与光纤、工业 WiFi、摄像头与门禁、机房整理，以及持续的 AI 运维。
> **别人装完设备就走；我们保证设备一直在线** —— 常见故障约 30 秒自动恢复，每月一份可直接交给业主、总部或保险公司的健康报告。

### 7.2 English（Website About / Capability Statement）

> **H²Z Tech** is a Houston-based, family-owned low-voltage and security company founded by **Zheng He** and **Jialing Zhu**.
> Our name comes from ours — **H to Z** — and that's how we work: **from the first cable we pull to the AI that watches it, end to end**.
>
> We build and manage the cabling, CCTV, access control, and network layer for warehouses and plants across Greater Houston — structured cabling and fiber, industrial WiFi, cameras and access control, rack and IDF cleanup, and ongoing AI operations.
> **Most vendors install and leave. We keep it online** — self-healing common faults in about 30 seconds, with a monthly report you can hand to ownership, corporate, or your insurer.

### 7.3 设计说明（Logo Rationale，中英对照）

| 元素 | 说明 |
| --- | --- |
| **六边形** | 同时是「网络节点」与「防护盾」的语言 → 对应 **网络 + 安防 + AI** 三层定位；16px 下轮廓仍清晰，适合 favicon 与刺绣 |
| **H²Z（化学式）** | 借 H₂O 的语感做记忆钩子；「2」做上标、缩小并固定安全橙 → 与 H₂O 的写法（下标）拉开距离，同时形成**可注册的图文商标特征** |
| **深海军蓝** | 可信、工业、夜间作业的视觉基调 |
| **安全橙** | 安全色 + 高可视（车身上的实际功能），同时是品牌唯一的强调色 |
| **描述行** | 3 秒说清业务 —— 品牌初期「Tech」本身不传递任何业务信息 |

---

## 8. 标准文字搭配（复制即用）

| 用途 | 文案 |
| --- | --- |
| 法定名称 | **H2Z Tech LLC**（提交前请查 Texas SOS 名称可用性） |
| 品牌字标 | **H²Z TECH**（H、Z 主色；2 = 安全橙） |
| 描述行 | **CCTV · NETWORKS · AI MONITORING** |
| 主标语 A | **From H to Z — everything your building runs on.** |
| 主标语 B | **Houston's family-owned network, camera & AI operations team.** |
| 价值三词 | **Always-on · Self-healing · Evidence-grade reporting** |
| 电话话术 | **"H-two-Z"**（必要时补：*"like H₂O, but with a Z"*） |
| 可选辅助文字（PS 排版用） | `HOUSTON, TX` · `EST. 2026` · `LICENSED & INSURED` · `24/7 AI MONITORING` |

---

## 9. PS 导出清单（做完后要出的文件）

| 导出 | 格式/设置 | 用途 |
| --- | --- | --- |
| favicon / APP 图标 | PNG-24 透明底：16 / 32 / 48 / 180 / 512 px | 网站、iOS/Android |
| 网站用标识 | PNG-24 透明底：横向 720 / 1440 px 宽；SVG（如用 AI 导出） | 网站头部、邮件签名 |
| 印刷（名片/单据） | PDF/X-4 或 TIFF 300dpi，**文字已转曲**，CMYK | 印刷厂 |
| 车身/贴膜 | PDF（矢量）或 AI 文件，按实际尺寸等比放大，**大字电话另做** | 贴膜店 |
| 工服刺绣 | 单色图标版，PNG 透明底 512px + 刺绣厂常用的 DST/EMB（由刺绣厂转换） | 工服、帽子 |

> 提醒：PS 导出 SVG 会把文字栅格化 —— 若要保留可缩放矢量，请用 Illustrator 打开我给的 SVG 另存为 AI/PDF。
