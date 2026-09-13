#!/usr/bin/env bash
# DSH 探针依赖安装脚本（Raspberry Pi OS Lite 64-bit / Debian bookworm）
# 用法：bash install-deps.sh
set -euo pipefail

echo "==> [1/6] apt 更新与基础依赖"
sudo apt-get update
sudo apt-get install -y \
  arp-scan \
  snmp \
  ffmpeg \
  nmap \
  msmtp msmtp-mta \
  pandoc \
  curl ca-certificates gnupg

echo "==> [2/6] Node.js 20 LTS（NodeSource）"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "==> [3/6] Tailscale（出站管理通道，NAT 穿透）"
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
  echo ">>> 请手动执行: sudo tailscale up（完成设备接入后继续）"
fi

echo "==> [4/6] 探针运行用户与目录"
sudo useradd -r -m -s /usr/sbin/nologin probe 2>/dev/null || true
sudo mkdir -p /opt/probe/data
sudo chown -R probe:probe /opt/probe

echo "==> [5/6] DSH 部署"
# 说明：按 DSH 发行方式安装（npm 包 / 官方安装脚本），此处为占位步骤
# 建议：在 /opt/probe 下安装 dsh CLI 与探针 preset（见 probe-image.md）
echo ">>> 请按 probe-image.md 完成 DSH 安装与 preset 落盘"

echo "==> [6/6] 完成"
echo "依赖清单：arp-scan snmp ffmpeg nmap msmtp pandoc node20 tailscale"
