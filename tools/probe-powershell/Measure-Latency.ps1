# Latency / jitter / loss profiler: ICMP + TCP-connect latency to key LAN nodes
param(
  [string[]]$Targets,
  [int]$Count = 50,
  [int]$IntervalMs = 150,
  [int]$TcpPort = 0
)
$ErrorActionPreference = 'SilentlyContinue'
$Targets = @($Targets | ForEach-Object { $_ -split ',' } | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' })

function Stat([double[]]$v) {
  if ($v.Count -eq 0) { return $null }
  $avg = ($v | Measure-Object -Average).Average
  $min = ($v | Measure-Object -Minimum).Minimum
  $max = ($v | Measure-Object -Maximum).Maximum
  $jit = 0.0
  for ($i = 1; $i -lt $v.Count; $i++) { $jit += [Math]::Abs($v[$i] - $v[$i-1]) }
  if ($v.Count -gt 1) { $jit = $jit / ($v.Count - 1) }
  $sd = 0.0
  foreach ($x in $v) { $sd += [Math]::Pow($x - $avg, 2) }
  $sd = [Math]::Sqrt($sd / $v.Count)
  return [pscustomobject]@{ Min=$min; Avg=$avg; Max=$max; Jitter=$jit; StDev=$sd; N=$v.Count }
}

function TcpLatency([string]$IP, [int]$Port, [int]$Timeout) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $c = [System.Net.Sockets.TcpClient]::new()
  try {
    $iar = $c.BeginConnect($IP, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne($Timeout, $false)) { return $null }
    $c.EndConnect($iar)
    $sw.Stop()
    if ($c.Connected) { return $sw.Elapsed.TotalMilliseconds } else { return $null }
  } catch { return $null } finally { $c.Close() }
}

$ping = [System.Net.NetworkInformation.Ping]::new()
$report = @()
foreach ($t in $Targets) {
  $rtts = New-Object System.Collections.Generic.List[double]
  $lost = 0
  for ($i = 0; $i -lt $Count; $i++) {
    try {
      $r = $ping.Send($t, 900)
      if ($r.Status -eq 'Success') { $rtts.Add([double]$r.RoundtripTime) } else { $lost++ }
    } catch { $lost++ }
    Start-Sleep -Milliseconds $IntervalMs
  }
  $s = Stat $rtts.ToArray()
  $lossPct = [Math]::Round(100.0 * $lost / $Count, 1)

  $tcp = ''
  if ($TcpPort -gt 0) {
    $tv = New-Object System.Collections.Generic.List[double]
    $tlost = 0
    for ($i = 0; $i -lt 15; $i++) {
      $l = TcpLatency $t $TcpPort 900
      if ($null -ne $l) { $tv.Add($l) } else { $tlost++ }
      Start-Sleep -Milliseconds 100
    }
    $ts = Stat $tv.ToArray()
    if ($ts) { $tcp = ("TCP{0}: min={1:N1} avg={2:N1} max={3:N1} jit={4:N1} loss={5}%" -f $TcpPort,$ts.Min,$ts.Avg,$ts.Max,$ts.Jitter,[Math]::Round(100.0*$tlost/15,1)) }
    else { $tcp = "TCP${TcpPort}: no successful connect" }
  }

  if ($s) {
    $line = "{0,-12} icmp: min={1,6:N1} avg={2,7:N1} max={3,7:N1} jit={4,6:N1} sd={5,6:N1} loss={6,5:N1}%  {7}" -f $t,$s.Min,$s.Avg,$s.Max,$s.Jitter,$s.StDev,$lossPct,$tcp
  } else {
    $line = "{0,-12} icmp: 100% loss (no reply)  {1}" -f $t,$tcp
  }
  Write-Output $line
  $report += $line
}
