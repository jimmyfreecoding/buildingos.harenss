# Pi 探针部署手册（M9）

> 目标：Raspberry Pi 4B/5（4GB+）+ Raspberry Pi OS Lite 64-bit，跑 DSH 探针，开机自启、断电自恢复、只读加固。对照 [13-探针开发任务清单](../13-探针开发任务清单.md) M9。

---

## 1. 硬件准备

| 项 | 规格 |
| --- | --- |
| 主板 | Raspberry Pi 5（推荐）/ 4B，≥4GB RAM |
| 存储 | 64GB A2 microSD（官方烧录器 Raspberry Pi Imager） |
| 电源 | 官方 PSU（Pi5 需 27W） |
| 网络 | 千兆网线 → 客户主交换机空闲口 |

## 2. 系统安装

1. Raspberry Pi Imager：选 **Raspberry Pi OS Lite (64-bit)**，烧录到 SD。
2. 首次启动前配置（Imager 高级选项）：`hostname=probe`、启用 SSH（Key 登录）、Wi-Fi 可选（建议有线）、时区 America/Chicago。
3. 上电 → SSH 进入 → 固化系统：

```bash
sudo apt update && sudo apt full-upgrade -y
sudo raspi-config nonint do_wifi_country US
```

## 3. 依赖与运行环境

```bash
# 在探针源码目录（拷入 /opt/probe 后）
sudo cp -r probe /opt/probe
cd /opt/probe/deploy
bash install-deps.sh            # arp-scan/snmp/ffmpeg/nmap/msmtp/pandoc/node20/tailscale
sudo tailscale up               # 接入车队管理网（出站，无需开放入站端口）
```

## 4. DSH 与探针 preset 落盘

1. 按 DSH 发行说明安装 CLI（Node 20 环境）。
2. 探针 preset 落盘到 `~/.dsh/.agent-presets/probe/`（含 cordis.yml + 本探针插件）。
3. 站点初始化：首次启动向导写入 `config.json`（站点名、SNMP 社区串、自愈开关、通知邮箱、轮询间隔）。
   - **默认只读**：`selfHealEnabled: false`，客户签署《自愈授权书》后再开启。
   - SNMP 凭据经 DSH `credentials` 服务加密存储，不入库明文。

## 5. systemd 自启

```bash
sudo cp deploy/dsh-probe.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dsh-probe
sudo systemctl status dsh-probe    # active (running)
# 断电重启验证：sudo reboot 后 systemctl is-active dsh-probe
```

## 6. 加固清单（对照 02 §3）

| 项 | 命令/说明 |
| --- | --- |
| 防火墙 | `sudo ufw default deny incoming && sudo ufw allow out && sudo ufw enable`（Tailscale 出站不受影响） |
| SSH | 仅 Key 登录：`/etc/ssh/sshd_config` → `PasswordAuthentication no` |
| 自动更新 | `sudo apt install unattended-upgrades && sudo dpkg-reconfigure unattended-upgrades` |
| 只读根（可选） | overlayfs 脚本或 `raspi-config` 只读选项；数据区 /opt/probe/data 保持可写 |
| 审计 | 插件 audit.log（M1）与 DSH 日志本地留存，客户可导出 |
| 凭据 | SNMP/自愈凭据仅存 credentials 服务（加密），日志脱敏 |

## 7. 大屏（kiosk）

- 方式 A：HDMI 接大屏 → Chromium kiosk 指向 `http://localhost:3080`（DSH Web GUI，探针看板插件）。
- 方式 B（可选）：Grafana kiosk（节点 >10 后启用 Prometheus 数据层，见 12 文档）。

## 8. 首启验收清单（对照 13 §2 M9）

- [ ] `systemctl is-active dsh-probe` = active，重启后自恢复
- [ ] `probe_status`：gateway 已识别、devices >0
- [ ] `scan_subnet` 复刻客户现场设备清单（与手动核对 ≥90%）
- [ ] `snmp_query`（社区串）读到交换机 LLDP/CAM/PoE
- [ ] `inspect_rtsp` 读到摄像头分辨率/帧率；黑屏检测可用
- [ ] `topology_build` 链路置信度：LLDP/CAM 设备 = high
- [ ] `health_report` 每日 07:00 邮件推送（msmtp 配置）
- [ ] 拔网线 → 看板仍本地渲染缓存数据；插回自动恢复

## 9. 已知依赖项（诚实标注）

- DSH CLI 的无头运行入口（`dsh run --preset` 等）与 systemd 模板中的 ExecStart 需在 Pi 首次联调时按实际 CLI 校准。
- LLDP/CAM/PoE 的**设备级**验证依赖客户现场交换机 SNMP 凭据（本机开发环境无）。
