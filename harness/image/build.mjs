// 构建 dsh-ioc 镜像（TECH-PLAN 8.3）：把 DSH_REF 解析成确定提交再交给 docker build，
// 这样提交号变了缓存才失效、镜像可复现。**只构建，不推送**（镜像仓库地址未定）。
//
// 用法：node harness/image/build.mjs [--load|--push] [--image <名字>] [--ref <提交|分支|标签>]
//   默认 --load 到本机 docker；--platform 透传给 docker buildx。
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const repo = process.env.DSH_REPO || 'https://github.com/deepseek-ai/deepseek-harness.git';
const ref = arg('--ref', process.env.DSH_REF || 'master');
const image = arg('--image', process.env.DSH_IMAGE || 'dsh-ioc:0.1.0-dev');
const platform = arg('--platform', process.env.DSH_PLATFORM || 'linux/amd64');
const root = path.resolve(import.meta.dirname, '..', '..'); // 仓库根（构建上下文）
const context = path.resolve(import.meta.dirname, '..', '..'); // 需要 domains/ioc 与 harness/image

// 解析确定提交：ls-remote 能同时认分支、标签与提交号
const out = execFileSync('git', ['ls-remote', repo, ref], { encoding: 'utf8' }).trim();
const commit = out ? out.split(/\s+/)[0] : ref;
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('解析不出提交号：' + JSON.stringify(out || ref));
console.log('[image] DSH_REF ' + ref + ' -> ' + commit);

const cmd = ['buildx', 'build', '--platform', platform, '--build-arg', 'DSH_REPO=' + repo, '--build-arg', 'DSH_REF=' + commit, '-t', image, '-f', path.join('harness', 'image', 'Dockerfile')];
if (args.includes('--push')) cmd.push('--push');
else if (args.includes('--load')) cmd.push('--load');
else cmd.push('--output', 'type=docker');
cmd.push(context);
console.log('[image] docker ' + cmd.join(' '));
execFileSync('docker', cmd, { stdio: 'inherit', cwd: root });
console.log('[image] 完成：' + image + '（' + platform + '，提交 ' + commit.slice(0, 12) + '）');
