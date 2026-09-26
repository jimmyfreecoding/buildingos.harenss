#!/usr/bin/env bash
# ioc 域 DSH 容器入口：初始化 profile → 覆盖用户层 → 起 web 服务（对齐 harness/service/start.sh 的做法）
set -euo pipefail

PROFILE="${IOC_DSH_PROFILE:-ioc}"
DSH_HOME="${DSH_HOME:-/data/dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PORT="${IOC_DSH_PORT:-3090}"

mkdir -p "$DSH_HOME/profiles"

# ── 模型凭据：只在首次启动装载 ─────────────────────────────────
# DSH 拒绝读「属主以外也可读」的文件（Windows 挂载进来是 777），所以先落 /run/secrets 再 600 拷过去。
# 里面除了 API key 还有浏览器 cookie 的签名密钥，每次覆盖会让已发出去的 cookie 失效，所以只装一次。
if [ -f /run/secrets/dsh-credentials.yaml ] && [ ! -f "$DSH_HOME/.credentials.yaml" ]; then
  install -m 600 /run/secrets/dsh-credentials.yaml "$DSH_HOME/.credentials.yaml"
  echo "[ioc] 首次装载模型凭据（600）"
elif [ -f "$DSH_HOME/.credentials.yaml" ]; then
  echo "[ioc] 沿用已有凭据"
else
  echo "[ioc] 警告：没有挂载模型凭据，模型调用会失败（凭据由负责人提供，不进镜像、不进仓库）"
fi

# ── MCP：gateway 为这个会话进程写的 token 文件 ─────────────────
if [ -n "${IOC_MCP_TOKEN_FILE:-}" ] && [ -f "${IOC_MCP_TOKEN_FILE}" ]; then
  echo "[ioc] MCP token 文件就绪：${IOC_MCP_TOKEN_FILE}（内容不打印）"
else
  echo "[ioc] 警告：没有 IOC_MCP_TOKEN_FILE，ioc-mcp 会因 failOnStartupError 让启动失败（这是有意的，不静默降级）"
fi
if [ -z "${IOC_MCP_URL:-}" ]; then
  echo "[ioc] 警告：没有 IOC_MCP_URL（应为 http://<ioc-server>:3040/ioc/mcp）"
fi

# ── 首次启动：用官方方式初始化 profile ──────────────────────────
if [ ! -f "$PROFILE_DIR/package.json" ]; then
  echo "[ioc] 首次启动，初始化 profile: $PROFILE"
  dsh plugin --profile "$PROFILE" add @deepseek-ai/dsh-base
  dsh plugin --profile "$PROFILE" add @deepseek-ai/dsh-web-app
fi

# ── 每次启动都用镜像里的用户层覆盖 ──────────────────────────────
# package.json 也必须覆盖：dsh plugin add 只装包，不会往 dsh.profile.bundles 里写，
# 少掉 @deepseek-ai/dsh-web-app 时进程会在事件循环里干等、永远不监听端口。
cp -f /opt/ioc/profile/cordis.patch.yml "$PROFILE_DIR/cordis.patch.yml"
cp -f /opt/ioc/profile/package.json "$PROFILE_DIR/package.json"

# ── 自检：打印合成后的配置树，启动失败时一眼看出哪一层坏了 ──────
echo "[ioc] 校验配置组合..."
if ! dsh --profile "$PROFILE" --dump-config > /tmp/ioc-config.txt 2>&1; then
  echo "[ioc] 配置组合校验失败："
  cat /tmp/ioc-config.txt
  exit 1
fi
echo "[ioc] 配置 OK（$(wc -l < /tmp/ioc-config.txt) 行）"

# ── 启动 ──────────────────────────────────────────────────────
# 监听地址与端口由 profile 的 webserver 行定（0.0.0.0:$PORT），这里不传 --port。
echo "[ioc] 启动 DSH web：profile=$PROFILE 监听 0.0.0.0:$PORT"
dsh --profile "$PROFILE" --no-open > /tmp/dsh-out.log 2>&1 &
DSH_PID=$!

for _ in $(seq 1 90); do
  grep -q 'token=' /tmp/dsh-out.log 2>/dev/null && break
  kill -0 "$DSH_PID" 2>/dev/null || break
  sleep 1
done

cat /tmp/dsh-out.log
TOKEN=$(sed -n 's/.*token=\([A-Za-z0-9_-]*\).*/\1/p' /tmp/dsh-out.log | head -1)
if [ -n "$TOKEN" ]; then
  echo ""
  echo "[ioc] ============================================================"
  echo "[ioc]  打开下面这个地址（首次必须带 token，之后 cookie 有效期 30 天）："
  echo "[ioc]    http://127.0.0.1:$PORT/?token=$TOKEN"
  echo "[ioc] ============================================================"
fi

wait "$DSH_PID"
