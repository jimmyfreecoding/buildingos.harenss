# 打印 DSH 当前的访问地址（token 每次重启都会变，所以要从日志里取）
#
#   powershell -ExecutionPolicy Bypass -File url.ps1          # 只打印
#   powershell -ExecutionPolicy Bypass -File url.ps1 -Open    # 打印并打开浏览器
param([switch]$Open)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

$port = '3090'
if (Test-Path .env) {
  $line = Select-String -Path .env -Pattern '^NETOPS_DSH_PORT=(\d+)' | Select-Object -First 1
  if ($line) { $port = $line.Matches.Groups[1].Value }
}

$log = docker logs netops-infra-harness-1 2>&1 | Out-String
$m = [regex]::Match($log, 'token=([A-Za-z0-9_\-]+)')

if (-not $m.Success) {
  Write-Host "没找到 token —— 容器起来了吗？" -ForegroundColor Yellow
  Write-Host "跑一下： docker compose -f docker-compose.infra.yml up -d harness"
  exit 1
}

$url = "http://127.0.0.1:$port/?token=$($m.Groups[1].Value)"
Write-Host ''
Write-Host "  $url" -ForegroundColor Green
Write-Host ''
Write-Host '  首次必须用这个带 token 的地址打开，之后 cookie 有效 30 天，'
Write-Host "  直接开 http://127.0.0.1:$port/ 就行。"
Write-Host ''

if ($Open) { Start-Process $url }
