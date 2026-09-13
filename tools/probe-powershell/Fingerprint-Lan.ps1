# Concurrent per-host port scan + HTTP/RTSP banner grab
param(
  [string[]]$Hosts,
  [int]$PortTimeoutMs = 500,
  [int]$BannerTimeoutMs = 1200
)
$ErrorActionPreference = 'SilentlyContinue'
$Hosts = @($Hosts | ForEach-Object { $_ -split ',' } | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' })
$Ports = @(21,22,23,53,80,81,88,443,554,623,1900,2020,3000,3389,34567,3702,37777,5000,5001,7001,8000,8001,8080,8081,8443,8554,8888,8899,9000,9090,10080,49152,10554)

function Scan-HostPorts {
  param([string]$IP, [int]$Timeout)
  $socks = @()
  foreach ($p in $Ports) {
    $s = [System.Net.Sockets.Socket]::new('InterNetwork','Stream','Tcp')
    $s.Blocking = $false
    try { [void]$s.BeginConnect([System.Net.IPAddress]::Parse($IP), $p, $null, $null) } catch {}
    $socks += [pscustomobject]@{ Port = $p; Sock = $s }
  }
  Start-Sleep -Milliseconds $Timeout
  $open = @()
  foreach ($it in $socks) {
    try { if ($it.Sock.Connected) { $open += $it.Port } } catch {}
    $it.Sock.Close(); $it.Sock.Dispose()
  }
  return ,$open
}

function Get-HttpBanner {
  param([string]$IP, [int]$Port, [int]$Timeout)
  $c = [System.Net.Sockets.TcpClient]::new()
  try {
    $iar = $c.BeginConnect($IP, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne($Timeout, $false)) { return $null }
    $c.EndConnect($iar)
    $s = $c.GetStream(); $s.ReadTimeout = $Timeout; $s.WriteTimeout = $Timeout
    $req = "GET / HTTP/1.1`r`nHost: $IP`r`nUser-Agent: Mozilla/5.0`r`nAccept: */*`r`nConnection: close`r`n`r`n"
    $b = [Text.Encoding]::ASCII.GetBytes($req); $s.Write($b, 0, $b.Length)
    $ms = [System.IO.MemoryStream]::new(); $buf = New-Object byte[] 4096
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.ElapsedMilliseconds -lt ($Timeout * 2)) {
      $n = $s.Read($buf, 0, $buf.Length); if ($n -le 0) { break }
      $ms.Write($buf, 0, $n); if ($ms.Length -gt 32768) { break }
    }
    $txt = [Text.Encoding]::ASCII.GetString($ms.ToArray())
    $server = ''; $title = ''
    if ($txt -match '(?im)^Server:\s*(.+?)\s*$') { $server = $Matches[1] }
    if ($txt -match '(?is)<title[^>]*>(.*?)</title>') { $title = ($Matches[1] -replace '\s+',' ').Trim() }
    $first = ($txt -split "`r?`n")[0]
    return [pscustomobject]@{ First = $first; Server = $server; Title = $title }
  } catch { return $null } finally { $c.Close() }
}

function Get-RtspBanner {
  param([string]$IP, [int]$Port, [int]$Timeout)
  $c = [System.Net.Sockets.TcpClient]::new()
  try {
    $iar = $c.BeginConnect($IP, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne($Timeout, $false)) { return $null }
    $c.EndConnect($iar)
    $s = $c.GetStream(); $s.ReadTimeout = $Timeout; $s.WriteTimeout = $Timeout
    $req = "OPTIONS rtsp://$IP/ RTSP/1.0`r`nCSeq: 1`r`nUser-Agent: dsh-diag`r`n`r`n"
    $b = [Text.Encoding]::ASCII.GetBytes($req); $s.Write($b, 0, $b.Length)
    $buf = New-Object byte[] 2048; $n = $s.Read($buf, 0, $buf.Length)
    if ($n -le 0) { return $null }
    return [Text.Encoding]::ASCII.GetString($buf, 0, $n)
  } catch { return $null } finally { $c.Close() }
}

$out = @()
foreach ($h in $Hosts) {
  $open = Scan-HostPorts -IP $h -Timeout $PortTimeoutMs
  $mac = (Get-NetNeighbor -IPAddress $h -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).LinkLayerAddress
  $webS = ''
  foreach ($wp in @(80,81,8080,8000,8001,8888,5000,5001,9000,88,443)) {
    if ($open -contains $wp) { $r = Get-HttpBanner -IP $h -Port $wp -Timeout $BannerTimeoutMs; if ($r) { $webS = "$wp -> $($r.First) | SRV=$($r.Server) | TITLE=$($r.Title)"; break } }
  }
  $rtspS = ''
  if ($open -contains 554) {
    $r = Get-RtspBanner -IP $h -Port 554 -Timeout $BannerTimeoutMs
    if ($r) { $rtspS = (($r -split "`r?`n") | Where-Object { $_ -match '^(RTSP/1.0|Server|Public|WWW|Allow)' }) -join ' ~ ' }
  }
  $o = [pscustomobject]@{ IP=$h; MAC=$mac; Ports=($open -join ','); Web=$webS; Rtsp=$rtspS }
  $out += $o
  Write-Output ("[{0,-12}] {1,-18} ports={2}" -f $h, $mac, ($open -join ','))
}
Write-Output ""
Write-Output "================ DETAIL ================"
foreach ($o in $out) { if ($o.Web -or $o.Rtsp -or $o.Ports) { "IP {0}  MAC {1}`n   ports: {2}`n   web  : {3}`n   rtsp : {4}" -f $o.IP,$o.MAC,$o.Ports,$o.Web,$o.Rtsp } }
