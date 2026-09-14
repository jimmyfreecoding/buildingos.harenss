# 构建 DSH 镜像 —— 每次都解析出目标分支的**最新提交号**再钉住构建。
#
#   powershell -ExecutionPolicy Bypass -File build-dsh.ps1              # master 最新
#   powershell -ExecutionPolicy Bypass -File build-dsh.ps1 -Ref v0.1.5  # 指定分支/标签/提交
#
# 为什么不直接 `docker compose build`：
#   Dockerfile 里 clone 那一层会被缓存。如果构建参数一直是 "master"，
#   master 更新后重新构建仍会命中缓存、拉不到新代码。这里每次都把 master
#   解析成具体提交号传进去 —— 参数变了缓存失效，同时镜像与提交一一对应。
param(
  [string]$Ref = 'master',
  [string]$Tag = 'netops-infra-harness:latest',
  [string]$Repo = 'https://github.com/deepseek-ai/deepseek-harness.git'
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ''
Write-Host "[1/3] 解析 $Ref 的最新提交" -ForegroundColor Cyan
$line = git ls-remote $Repo "refs/heads/$Ref" 2>&1
if (-not $line) {
  # 不是分支，可能直接给了标签或提交号
  $line = git ls-remote $Repo $Ref 2>&1
}
if (-not $line) { throw "解析失败：$Repo $Ref" }
$commit = ($line | Select-Object -First 1).ToString().Split("`t")[0].Trim()
Write-Host "      -> $commit"

Write-Host ''
Write-Host "[2/3] 构建镜像（钉住这个提交）" -ForegroundColor Cyan
docker build `
  -f ../harness/service/Dockerfile `
  --build-arg "DSH_REPO=$Repo" `
  --build-arg "DSH_REF=$commit" `
  -t $Tag `
  ../harness
if ($LASTEXITCODE -ne 0) { throw "构建失败" }

Write-Host ''
Write-Host "[3/3] 校验镜像里的提交" -ForegroundColor Cyan
$inImage = docker run --rm --entrypoint /bin/cat $Tag /opt/dsh/.dsh-source-commit
Write-Host "      镜像: $inImage"
Write-Host "      期望: $commit"
if ($inImage -notmatch [regex]::Escape($commit)) {
  Write-Host '      不一致！' -ForegroundColor Red
  exit 1
}
Write-Host ''
Write-Host '镜像已就绪。重启容器生效：' -ForegroundColor Green
Write-Host '  docker compose -f docker-compose.infra.yml up -d --force-recreate harness'
Write-Host ''
