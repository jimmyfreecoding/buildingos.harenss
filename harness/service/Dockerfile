# DSH 容器 —— 从源码构建
#
# 为什么从源码构建而不是 npm 装：
#   1. `@deepseek-ai/dsh-experimental-code-runtime-python`（Python 版代码运行时）
#      **没有发布到 npm**，只在源码里。我们需要它来做 Python 的 PTC。
#   2. 打出来的镜像对应一个明确的提交，可复现、可回归。
#
# 两阶段：构建阶段拉源码编译，运行阶段只带产物和网络工具。

# ─────────────────────────── 构建阶段 ───────────────────────────
FROM node:22-bookworm AS build

ARG DSH_REPO=https://github.com/deepseek-ai/deepseek-harness.git
# 默认 master；**构建脚本会把它解析成一个确定的提交号再传进来**。
# 这样做的两个原因：
#   1. 钉住提交 = 镜像可复现，出问题能对着代码查
#   2. ARG 的值变了，Docker 的层缓存会失效，才会真的去拉新代码
#      —— 如果一直传 "master"，master 更新了缓存照样命中，构建出来还是旧的
ARG DSH_REF=master

RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates python3 make g++ pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /src
# 用 fetch 而不是 clone --branch：clone --branch 只认分支名/标签名，
# 传提交号会失败；fetch 三者都认。
RUN git init -q . \
 && git remote add origin "${DSH_REPO}" \
 && git fetch -q --depth 1 origin "${DSH_REF}" \
 && git checkout -q FETCH_HEAD \
 && git log -1 --pretty='%H  %ci' > /src/.dsh-source-commit \
 && echo "构建源码: $(cat /src/.dsh-source-commit)"

# 依赖装进 pnpm store 缓存，重建时不重复下载
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 整个 monorepo 的构建：native 原生模块 + host tsc/tsdown + client tsc/tsdown + web 前端
# 大工程编译，给足内存，不然 tsc 会 OOM
RUN NODE_OPTIONS=--max-old-space-size=6144 pnpm run build

# ─────────────────────────── 运行阶段 ───────────────────────────
FROM node:22-bookworm-slim

# 只读探索要用的网络工具 + Python（跑模型现场生成的 Python 工具）
RUN apt-get update && apt-get install -y --no-install-recommends \
      iproute2 iputils-ping arp-scan nmap snmp dnsutils traceroute \
      curl ca-certificates python3 python3-pip procps \
    && rm -rf /var/lib/apt/lists/*

# pnpm 是 profile 管理（dsh plugin --profile X add ...）必需的 ——
# 首次启动要初始化 profile、还要按路径装 Python 代码运行时包，没有它直接报
# "pnpm not found on PATH"。固定版本，避免运行时联网去拉。
RUN npm i -g pnpm@11

# 编译产物整棵搬过来（各包的 lib/ 都在各自目录下，路径不能拆）
COPY --from=build /src /opt/dsh

# 把 CLI 暴露成 dsh 命令（源码里是 apps/cli/lib/bin.js）
RUN printf '#!/bin/sh\nexec node /opt/dsh/apps/cli/lib/bin.js "$@"\n' > /usr/local/bin/dsh \
 && chmod +x /usr/local/bin/dsh \
 && cat /opt/dsh/.dsh-source-commit

ENV DSH_HOME=/data/dsh \
    NETOPS_DSH_PORT=3090

COPY profile/ /opt/netops/profile/
COPY service/start.sh /usr/local/bin/netops-dsh
RUN chmod +x /usr/local/bin/netops-dsh

EXPOSE 3090

ENTRYPOINT ["/usr/local/bin/netops-dsh"]
