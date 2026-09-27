// dsh-ioc profile 与镜像的装配检查（P4-05）：不需要真 DSH、不需要模型密钥，
// 只核对「层与镜像里的关键约定」没被改坏（真机端到端在 P4-06，需要负责人提供密钥）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', '..', '..'); // 仓库根
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const patch = read('harness/domains/ioc/cordis.patch.yml');
const sdkPatch = read('harness/domains/ioc/sdk.patch.yml');
const profile = JSON.parse(read('harness/domains/ioc/package.json'));
const start = read('harness/domains/ioc/start.sh');
const docker = read('harness/image/Dockerfile');
const build = read('harness/image/build.mjs');

test('profile：bundles 要有 base + web-app（少了 web-app 进程不监听端口）', () => {
  assert.deepEqual(profile.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']);
  assert.equal(profile.name, 'dsh-profile-ioc');
});

test('用户层：ptc 模式 / 0.0.0.0 / 端口从环境取 / 强模型', () => {
  assert.match(patch, /- id: tools\n\s+config:\n\s+mode: ptc/);
  assert.match(patch, /host: '0\.0\.0\.0'/);
  assert.match(patch, /port: !!js Number\(process\.env\.IOC_DSH_PORT \?\? 3090\)/);
  assert.match(patch, /reasoningEffort: high/);
  assert.match(patch, /model: !!js \(process\.env\.IOC_DSH_MODEL \?\? 'deepseek-chat'\)/);
});

test('MCP：url 与 token 都从环境读、token 不落配置文件、failOnStartupError 打开', () => {
  assert.match(patch, /serverName: ioc/);
  assert.match(patch, /transport: streamable-http/);
  assert.match(patch, /url: !!js process\.env\.IOC_MCP_URL/);
  assert.match(patch, /readFileSync\(process\.env\.IOC_MCP_TOKEN_FILE, 'utf8'\)/);
  assert.match(patch, /failOnStartupError: true/);
  // 端点地址不能写死（免得把某个部署的 IP 带进仓库）
  assert.ok(!/url:\s*http:\/\//.test(patch), 'url 不该写死');
  // 也不该出现任何看起来像令牌的字面量
  assert.ok(!/Bearer [A-Za-z0-9_-]{20,}/.test(patch), '不该有令牌字面量');
});

test('persona：只通过 mcp__ioc__* 写草稿、不能发布', () => {
  assert.match(patch, /mcp__ioc__\*/);
  assert.match(patch, /不能发布|不能发布版本/);
  assert.match(patch, /personaSuffix/);
});

test('persona（两套 profile 都要守）：改动范围小、没改动要说、缺查询模板要如实说并造标注过的演示数据', () => {
  for (const [name, text] of [['cordis', patch], ['sdk', sdkPatch]]) {
    assert.match(text, /不要删除或重排已有的卡片/, name);
    assert.match(text, /本轮没有改动/, name);
    assert.match(text, /没有注册的查询模板/, name);
    assert.match(text, /造一份演示数据/, name);
    assert.match(text, /不能把模拟数据说成真实数据/, name);
  }
});
test('sdk 层：审批 never（AI 编排没人盯键盘）、MCP 从环境读、persona 挂上', () => {
  assert.match(sdkPatch, /policy: never/);
  assert.match(sdkPatch, /defaultPreset: ioc/);
  assert.match(sdkPatch, /url: !!js process.env.IOC_MCP_URL/);
  assert.match(sdkPatch, /personaSuffix/);
});

test('启动脚本：凭据只装一次、每次覆盖用户层与 package.json、dump-config 自检、不打印 token 文件内容', () => {
  assert.match(start, /install -m 600 \/run\/secrets\/dsh-credentials\.yaml/);
  assert.match(start, /\[ ! -f "\$DSH_HOME\/\.credentials\.yaml" \]/);
  assert.match(start, /cp -f \/opt\/ioc\/profile\/cordis\.patch\.yml/);
  assert.match(start, /cp -f \/opt\/ioc\/profile\/package\.json/);
  assert.match(start, /dsh --profile "\$PROFILE" --dump-config/);
  assert.match(start, /IOC_MCP_TOKEN_FILE/);
  assert.ok(!/cat .*IOC_MCP_TOKEN_FILE/.test(start), '不能把 token 文件内容打印出来');
});

test('镜像：源码构建钉 DSH_REF、带 Chromium/Playwright 依赖、非 root、3090、COPY 路径对得上', () => {
  assert.match(docker, /ARG DSH_REF=master/);
  assert.match(docker, /git fetch -q --depth 1 origin "\$\{DSH_REF\}"/);
  assert.match(docker, /chromium/);
  assert.match(docker, /libnss3/);
  assert.match(docker, /USER 1000/);
  assert.match(docker, /EXPOSE 3090/);
  // 构建上下文是仓库根：COPY 必须写 harness/domains/ioc/…
  assert.match(docker, /COPY harness\/domains\/ioc\/ \/opt\/ioc\/profile\//);
  assert.match(docker, /COPY harness\/domains\/ioc\/start\.sh /);
  // 不该把 netops 的 Python 代码运行时搬进来
  assert.ok(!/code-runtime-python/.test(docker));
});

test('构建脚本：把 ref 解析成确定提交；默认只 load 不 push', () => {
  assert.match(build, /ls-remote/);
  assert.match(build, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(build, /--build-arg', 'DSH_REF=' \+ commit/);
  assert.match(build, /args\.includes\('--push'\)/);
  assert.ok(/else if \(args\.includes\('--load'\)\)/.test(build), '默认 --load，不是 --push');
});
