# dsh-ioc 镜像：DSH 运行时 + ioc 域 profile（TECH-PLAN 8.3）
#
# 与 netops 的 harness/service/Dockerfile 同一套做法：**从源码构建**并钉住 DSH_REF 到确定提交
# （可复现、层缓存会随提交号失效）。差别：
#   * 运行阶段多装 Chromium 与 Playwright 的系统依赖（browser 插件要用）；
#   * 不带 Python 代码运行时（那是 netops 的 PTC 需要，ioc 只用 JS PTC）；
#   * 用户层是 harness/domains/ioc（port 3090）。

# ─────────────────────────── 构建阶段 ───────────────────────────
FROM node:22-bookworm AS build

ARG DSH_REPO=https://github.com/deepseek-ai/deepseek-harness.git
# 构建脚本会解析成确定提交再传进来（传 master 时缓存会命中，构建出来还是旧的）
ARG DSH_REF=master

RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates python3 make g++ pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /src
RUN git init -q . \
 && git remote add origin "${DSH_REPO}" \
 && git fetch -q --depth 1 origin "${DSH_REF}" \
 && git checkout -q FETCH_HEAD \
 && git log -1 --pretty='%H  %ci' > /src/.dsh-source-commit \
 && echo "构建源码: $(cat /src/.dsh-source-commit)"

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

RUN NODE_OPTIONS=--max-old-space-size=6144 pnpm run build

# ─────────────────────────── 运行阶段 ───────────────────────────
FROM node:22-bookworm-slim

# Chromium 与 Playwright 的运行依赖（browser 插件截图 / 打开草稿预览地址）
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium chromium-driver fonts-noto-cjk \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
      curl ca-certificates procps tini \
    && rm -rf /var/lib/apt/lists/*

RUN npm i -g pnpm@11

COPY --from=build /src /opt/dsh
RUN printf '#!/bin/sh\nexec node /opt/dsh/apps/cli/lib/bin.js "$@"\n' > /usr/local/bin/dsh \
 && chmod +x /usr/local/bin/dsh \
 && cat /opt/dsh/.dsh-source-commit

ENV DSH_HOME=/data/dsh \
    IOC_DSH_PROFILE=ioc \
    IOC_DSH_PORT=3090 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# 用户层：与 harness/domains/ioc 保持一致（每次启动由 start.sh 覆盖到 profile 目录）
COPY harness/domains/ioc/ /opt/ioc/profile/
COPY harness/domains/ioc/start.sh /usr/local/bin/ioc-dsh
RUN chmod +x /usr/local/bin/ioc-dsh

# 非 root（uid 1000）：/data 挂卷由部署方 chown 1000:1000
RUN useradd -m -u 1000 ioc && mkdir -p /data/dsh && chown -R 1000:1000 /data
USER 1000

EXPOSE 3090
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD curl -fsS http://127.0.0.1:3090/ >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/ioc-dsh"]
