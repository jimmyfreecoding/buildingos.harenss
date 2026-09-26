# dsh-ioc 镜像（P4-05）

DSH 运行时 + ioc 域 profile，容器内监听 **3090**（TECH-PLAN 8.3）。与 netops 的 `harness/service/Dockerfile` 同一套做法，
差别：运行阶段**多装 Chromium 与 Playwright 依赖**（browser 插件要打开草稿预览地址、截图核对），**不带 Python 代码运行时**
（那只用于 netops 的 PTC），用户层是 `harness/domains/ioc`。

## 构建与运行

```bash
# 解析 DSH_REF 成确定提交，再 docker buildx（默认只 --load 到本机，**不推送**：镜像仓库地址未定）
node harness/image/build.mjs --load                    # linux/amd64
node harness/image/build.mjs --platform linux/arm64 --load
node harness/image/build.mjs --ref <提交|分支|标签> --image dsh-ioc:0.1.0-dev

docker run --rm -p 3090:3090 \
  -v /srv/dsh-data:/data \
  --mount type=bind,src=/srv/secrets/dsh-credentials.yaml,dst=/run/secrets/dsh-credentials.yaml,readonly \
  -e IOC_MCP_URL=http://<ioc-server>:3040/ioc/mcp \
  -e IOC_MCP_TOKEN_FILE=/run/secrets/ioc-mcp-token \
  -v /srv/secrets/ioc-mcp-token:/run/secrets/ioc-mcp-token:ro \
  dsh-ioc:0.1.0-dev
```

- 模型凭据：`/run/secrets/dsh-credentials.yaml`（**由负责人提供，不进仓库、不进镜像**），首次启动以 600 装进 `/data/dsh.credentials.yaml`。
- MCP token 文件：由 **gateway**（`harness/service/gateway.mjs`）为每个会话进程单独写；会话 token 由 apps/ioc 签发。模型看不到。
- 数据卷 `/data` 需 `chown 1000:1000`（容器里以 uid 1000 运行）。
- 启动脚本会 `dsh --profile ioc --dump-config` 自检，配置组合失败直接退出并打印原因。

## 这一版验证了什么

```bash
node --test harness/domains/ioc/test/profile.test.mjs      # 7/7
```

装配检查（不需要真 DSH、不需要模型密钥）：bundles 齐全、ptc / 0.0.0.0 / 端口与模型从环境取、MCP 的 url 与 token
都从环境读且**没有写死地址或令牌字面量**、`failOnStartupError` 打开、persona 限定「只通过 `mcp__ioc__*` 写草稿、不能发布」、
启动脚本的凭据只装一次 / 每次覆盖用户层与 package.json / 不打印 token 文件、镜像钉 `DSH_REF`、带 Chromium 依赖、非 root、COPY 路径与构建上下文一致。

```bash
node --test harness/service/test/gateway.test.mjs          # 6/6（P4-04）
```

## 还没验证的（P4-06，需要负责人的模型密钥）

- 真实 DSH 运行时 + 真实模型的端到端：会话 → 模型 → `mcp__ioc__*` 工具 → 草稿 → 人在 studio 确认发布；
- 镜像能否真正构建（要拉 GitHub 源码 + pnpm 全量构建，约 GB 级缓存）；
- Chromium/Playwright 在容器里打开草稿预览地址；
- HTML 质量与工具调用准确度的评估（V0-4 也是用假模型验的，这一条一直挂着）。
