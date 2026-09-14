# 一条命令把开发基础设施拉起来并完成初始化。
#
#   cd buildingos.harenss/deploy
#   powershell -ExecutionPolicy Bypass -File setup.ps1      # Windows
#
# Linux / 树莓派上没有 PowerShell，等价操作：
#   docker compose -f docker-compose.infra.yml up -d
#   docker exec netops-infra-tdengine-1 taos -f /init/tdengine.sql
#
# 重复执行安全：建表脚本里都是 IF NOT EXISTS。

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
$compose = 'docker-compose.infra.yml'

Write-Host ''
Write-Host '[1/4] 启动容器（postgres / tdengine）'
docker compose -f $compose up -d

Write-Host ''
Write-Host '[2/4] 等待健康检查'
$deadline = (Get-Date).AddMinutes(3)
while ($true) {
  Start-Sleep -Seconds 3
  $lines = docker compose -f $compose ps --format '{{.Name}} {{.Status}}' 2>$null
  $notReady = $lines | Where-Object { $_ -and ($_ -notmatch 'healthy') }
  if (-not $notReady) { break }
  if ((Get-Date) -gt $deadline) {
    Write-Host '  超时，仍未就绪：'
    $notReady | ForEach-Object { Write-Host "    $_" }
    break
  }
}
docker compose -f $compose ps --format '{{.Name}}  {{.Status}}' | ForEach-Object { Write-Host "  $_" }

Write-Host ''
Write-Host '[3/4] 初始化 TDengine（该镜像不会自动执行建库脚本）'
docker exec netops-infra-tdengine-1 taos -f /init/tdengine.sql | Out-Null
Write-Host '  完成'

Write-Host ''
Write-Host '[4/4] 校验'
$tables = docker exec netops-infra-postgres-1 psql -U netops -d netops -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
Write-Host ("  PostgreSQL  业务表 {0} 张" -f $tables.Trim())

$dbOut = docker exec netops-infra-tdengine-1 taos -s 'show databases;' 2>$null
$dbState = '缺失'
if ($dbOut -match 'netops') { $dbState = '已建' }
Write-Host ("  TDengine    数据库 netops {0}" -f $dbState)

$stOut = docker exec netops-infra-tdengine-1 taos -s 'use netops; show stables;' 2>$null
$stState = '缺失'
if ($stOut -match 'metric') { $stState = '已建' }
Write-Host ("  TDengine    超表 metric {0}" -f $stState)

Write-Host ''
Write-Host '基础设施就绪。连接信息：'
Write-Host '  PostgreSQL   127.0.0.1:55432   库 netops   用户 netops   密码 netops_dev_only'
Write-Host '  TDengine     127.0.0.1:56041   (REST)      库 netops'
Write-Host '  MQTT         未启动'
Write-Host ''
Write-Host '  启用 MQTT：docker compose -f docker-compose.infra.yml --profile mqtt up -d'
Write-Host '  停止：     docker compose -f docker-compose.infra.yml down       (保留数据)'
Write-Host '  清空：     docker compose -f docker-compose.infra.yml down -v    (删除数据)'
Write-Host ''

# 上面若干 docker exec 的退出码会被 PowerShell 当成脚本退出码，这里显式归零。
exit 0
