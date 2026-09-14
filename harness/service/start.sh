#!/usr/bin/env bash
# DSH 容器入口：初始化 profile → 覆盖我们的用户层 → 起 web 服务
set -euo pipefail

PROFILE="${NETOPS_DSH_PROFILE:-netops}"
DSH_HOME="${DSH_HOME:-/data/dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PORT="${NETOPS_DSH_PORT:-3090}"

mkdir -p "$DSH_HOME/profiles"

# ── 模型凭据 ────────────────────────────────────────────────────
# 两个坑叠在一起：
#  1. DSH 拒绝读「属主以外也可读」的凭据文件。Windows 挂进来的文件在容器里
#     显示为 777，直接挂到 $DSH_HOME 会被拒绝启动，所以先落到 /run/secrets
#     再用 600 权限拷过去。
#  2. 这个文件里除了 DEEPSEEK_API_KEY，还有一条
#     `client-connection/browser-session` 记录，存的是**浏览器 cookie 的签名密钥**。
#     如果每次启动都覆盖它，浏览器拿到的 cookie 会在每次重启后作废，用户又要
#     重新找一遍 token。所以只在首次启动时装载。
if [ -f /run/secrets/dsh-credentials.yaml ] && [ ! -f "$DSH_HOME/.credentials.yaml" ]; then
  install -m 600 /run/secrets/dsh-credentials.yaml "$DSH_HOME/.credentials.yaml"
  echo "[netops] 首次装载模型凭据（600）"
elif [ -f "$DSH_HOME/.credentials.yaml" ]; then
  echo "[netops] 沿用已有凭据（cookie 签名密钥保持不变）"
else
  echo "[netops] 警告：没有挂载模型凭据，模型调用会失败"
fi

# ── 首次启动：用官方方式初始化 profile ──────────────────────────
# 必须在容器里做，不能从宿主机拷：node-pty / sharp / koffi 这些是本机平台
# 相关的原生依赖，Windows 上装的到 Linux 里跑不了。
if [ ! -f "$PROFILE_DIR/package.json" ]; then
  echo "[netops] 首次启动，初始化 profile: $PROFILE"
  dsh plugin --profile "$PROFILE" add @deepseek-ai/dsh-base
  dsh plugin --profile "$PROFILE" add @deepseek-ai/dsh-web-app
fi

# ── 每次启动都用仓库里的用户层覆盖 ──────────────────────────────
cp -f /opt/netops/profile/cordis.patch.yml "$PROFILE_DIR/cordis.patch.yml"

# package.json 也必须覆盖：`dsh plugin add` 只装包，**不会**往
# dsh.profile.bundles 里写。init 出来的模板只带 @deepseek-ai/dsh-base，
# 少了 @deepseek-ai/dsh-web-app —— 那样 HTTP 服务那一行不会被组合进来，
# 进程启动完就在事件循环里干等，永远不监听端口。
cp -f /opt/netops/profile/package.json "$PROFILE_DIR/package.json"

# ── Python 代码运行时（必须在 package.json 覆盖之后装）───────────
# 这个包只存在于源码里（npm 上 404），所以镜像是源码构建的。
# 装成功 → cordis.patch.yml 里的 code-runtime-python 那行才有意义；
# 装失败就必须把那一行也拿掉，否则 profile 组合时会因找不到包直接启动失败。
PY_RT=/opt/dsh/packages/experimental/code-runtime-python
PY_RT_LINK="$PROFILE_DIR/node_modules/@deepseek-ai/dsh-experimental-code-runtime-python"
if [ -d "$PY_RT" ] && [ ! -e "$PY_RT_LINK" ]; then
  echo "[netops] 安装 Python 代码运行时..."
  if dsh plugin --profile "$PROFILE" add "$PY_RT" > /tmp/py-rt.log 2>&1; then
    echo "[netops] Python 代码运行时已装入"
  else
    echo "[netops] 警告：Python 运行时装入失败，从配置里摘掉那一行"
    tail -5 /tmp/py-rt.log
    sed -i '/code-runtime-python/,+1d' "$PROFILE_DIR/cordis.patch.yml"
  fi
fi

# ── 自检：打印合成后的配置树，启动失败时能一眼看出哪一层坏了 ────
echo "[netops] 校验配置组合..."
if ! dsh --profile "$PROFILE" --dump-config > /tmp/netops-config.txt 2>&1; then
  echo "[netops] 配置组合校验失败，输出如下："
  cat /tmp/netops-config.txt
  exit 1
fi
echo "[netops] 配置 OK（$(wc -l < /tmp/netops-config.txt) 行）"

# ── 启动 ────────────────────────────────────────────────────────
# 监听地址和端口由 profile 的 webserver 行定（0.0.0.0:$PORT），这里不传 --port。
# 后台启动是为了把 token 抓出来、拼成能直接点开的地址；token 是进程内随机的，
# 没有配置项能固定。
echo "[netops] 启动 DSH web：profile=$PROFILE 监听 0.0.0.0:$PORT"
dsh --profile "$PROFILE" --no-open > /tmp/dsh-out.log 2>&1 &
DSH_PID=$!

for _ in $(seq 1 90); do
  grep -q 'token=' /tmp/dsh-out.log 2>/dev/null && break
  kill -0 "$DSH_PID" 2>/dev/null || break
  sleep 1
done

cat /tmp/dsh-out.log
# DSH 打印的行形如：dsh web: http://127.0.0.1:3090/?token=XXX (LAN: ...)
# 所以 token 只取 [A-Za-z0-9_-] 这一段，别把后面的括号也吃进来。
TOKEN=$(sed -n 's/.*token=\([A-Za-z0-9_-]*\).*/\1/p' /tmp/dsh-out.log | head -1)

if [ -n "$TOKEN" ]; then
  echo ""
  echo "[netops] ============================================================"
  echo "[netops]  打开下面这个地址（首次必须带 token，之后 cookie 有效 30 天）："
  echo "[netops]"
  echo "[netops]    http://127.0.0.1:$PORT/?token=$TOKEN"
  echo "[netops]"
  echo "[netops]  从别的机器访问把 127.0.0.1 换成这台机器的局域网 IP。"
  echo "[netops]  当前 token: $TOKEN"
  echo "[netops] ============================================================"
  echo ""
fi

wait "$DSH_PID"
