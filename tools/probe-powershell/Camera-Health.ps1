# Camera link health: ICMP + TCP-connect + RTSP-OPTIONS round-trip profiling
param([string[]]$Cameras, [int]$Count = 60)
$ErrorActionPreference = 'SilentlyContinue'
$Cameras = @($Cameras | ForEach-Object { $_ -split ',' } | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' })

function Stats([double[]]$v, [int]$attempts) {
  if ($v.Count -eq 0) { return "no samples (all $attempts attempts failed)" }
  $avg = ($v | Measure-Object -Average).Average
  $min = ($v | Measure-Object -Minimum).Minimum
  $max = ($v | Measure-Object -Maximum).Maximum
  $jit = 0.0; for ($i=1; $i -lt $v.Count; $i++) { $jit += [Math]::Abs($v[$i]-$v[$i-1]) }
  if ($v.Count -gt 1) { $jit = $jit/($v.Count-1) }
  $over50 = ($v | Where-Object { $_ -gt 50 }).Count
  $over100 = ($v | Where-Object { $_ -gt 100 }).Count
  return ("min={0,6:N1} avg={1,6:N1} max={2,7:N1} jit={3,6:N1} loss={4,5:N1}%  >50ms:{5,3}/{6}  >100ms:{7,3}/{8}" -f $min,$avg,$max,$jit,(100.0*($attempts-$v.Count)/$attempts),$over50,$v.Count,$over100,$v.Count)
}

function TcpRtt([string]$IP,[int]$Port,[int]$Timeout) {
  $sw=[System.Diagnostics.Stopwatch]::StartNew(); $c=[System.Net.Sockets.TcpClient]::new()
  try { $iar=$c.BeginConnect($IP,$Port,$null,$null); if(-not $iar.AsyncWaitHandle.WaitOne($Timeout,$false)){return $null}; $c.EndConnect($iar); $sw.Stop(); if($c.Connected){return $sw.Elapsed.TotalMilliseconds}else{return $null} } catch { return $null } finally { $c.Close() }
}

function RtspRtt([string]$IP,[int]$Timeout) {
  $c=[System.Net.Sockets.TcpClient]::new()
  try {
    $iar=$c.BeginConnect($IP,554,$null,$null); if(-not $iar.AsyncWaitHandle.WaitOne($Timeout,$false)){return $null}; $c.EndConnect($iar)
    $s=$c.GetStream(); $s.ReadTimeout=$Timeout; $s.WriteTimeout=$Timeout
    $req="OPTIONS rtsp://$IP/ RTSP/1.0`r`nCSeq: 1`r`nUser-Agent: dsh-diag`r`n`r`n"
    $b=[Text.Encoding]::ASCII.GetBytes($req)
    $sw=[System.Diagnostics.Stopwatch]::StartNew(); $s.Write($b,0,$b.Length)
    $buf=New-Object byte[] 1024; $n=$s.Read($buf,0,1024); $sw.Stop()
    if($n -gt 0){ return $sw.Elapsed.TotalMilliseconds } else { return $null }
  } catch { return $null } finally { $c.Close() }
}

$ping=[System.Net.NetworkInformation.Ping]::new()
foreach($cam in $Cameras){
  Write-Output "==================== $cam ===================="
  $icmp=New-Object System.Collections.Generic.List[double]
  for($i=0;$i -lt $Count;$i++){ try{ $r=$ping.Send($cam,900); if($r.Status -eq 'Success'){$icmp.Add([double]$r.RoundtripTime)} }catch{}; Start-Sleep -Milliseconds 120 }
  Write-Output ("  ICMP : " + (Stats $icmp.ToArray() $Count))

  $tcp=New-Object System.Collections.Generic.List[double]
  for($i=0;$i -lt 25;$i++){ $l=TcpRtt $cam 554 1200; if($null -ne $l){$tcp.Add($l)}; Start-Sleep -Milliseconds 80 }
  Write-Output ("  TCP554: " + (Stats $tcp.ToArray() 25))

  $rtsp=New-Object System.Collections.Generic.List[double]
  for($i=0;$i -lt 25;$i++){ $l=RtspRtt $cam 1500; if($null -ne $l){$rtsp.Add($l)}; Start-Sleep -Milliseconds 80 }
  Write-Output ("  RTSP OPTIONS: " + (Stats $rtsp.ToArray() 25))
}
