#!/usr/bin/env bash
# gateway + 真 DSH 的容器入口（P4-06b 实测用）：Windows 上跑不了 Linux 运行时，所以 gateway 与 DSH 同容器。
#
# 用法（在 harenss 仓库根）：
#   docker run --rm --name ioc-gw -p 8090:8090 -v dsh-ioc-home:/data/dsh \
#     -v "$USERPROFILE/.dsh/.credentials.yaml:/run/secrets/dsh-credentials.yaml:ro" \
#     -v "$(pwd)/harness/service/gateway.mjs:/gw/gateway.mjs:ro" \
#     -v "$(pwd)/harness/domains/ioc/sdk.patch.yml:/opt/ioc/sdk.patch.yml:ro" \
#     -v "$(pwd)/harness/service/dsh-container-entry.sh:/gw/entry.sh:ro" \
#     -e DSH_CMD=dsh -e "DSH_ARGS=--profile sdk --patch /opt/ioc/sdk.patch.yml" \
#     -e IOC_MCP_URL=http://host.docker.internal:3040/ioc/mcp \
#     -e IOC_DSH_PROVIDER=deepseek-official -e IOC_DSH_MODEL=deepseek-flash -e IOC_DSH_CWD=/data/work \
#     --entrypoint sh netops-infra-harness:latest /gw/entry.sh
#
# 坑：DSH_CMD 一定要写成 dsh —— 镜像里是 CLI，不是 V0-4 那个预编译 SDK 二进制（默认名会 ENOENT）。
set -e
export DSH_HOME=/data/dsh
install -m 600 /run/secrets/dsh-credentials.yaml $DSH_HOME/.credentials.yaml && echo '[gw] 凭据已装（600）'
mkdir -p /data/work /data/secrets
cd /opt/dsh
if [ ! -f $DSH_HOME/profiles/sdk/package.json ]; then
  echo '[gw] 建 sdk profile…'
  node apps/cli/lib/bin.js plugin --profile sdk add @deepseek-ai/dsh-sdk-app >/tmp/p1.log 2>&1 || { tail -5 /tmp/p1.log; exit 1; }
fi
if [ ! -d $DSH_HOME/profiles/sdk/node_modules/@deepseek-ai/dsh-mcp-client ]; then
  echo '[gw] 装 mcp 客户端插件…'
  node apps/cli/lib/bin.js plugin --profile sdk add @deepseek-ai/dsh-mcp-client >/tmp/p2.log 2>&1 || { tail -8 /tmp/p2.log; exit 1; }
fi
echo '[gw] 启动 gateway：' $DSH_ARGS
exec node /gw/gateway.mjs
