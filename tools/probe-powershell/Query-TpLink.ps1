# Query TP-Link (Kasa/Tapo legacy) local API on TCP 9999 - autokey XOR
param([string[]]$Hosts)
$ErrorActionPreference = 'SilentlyContinue'
$Hosts = @($Hosts | ForEach-Object { $_ -split ',' } | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' })

function Invoke-TpLink {
  param([string]$IP, [string]$Cmd, [int]$Timeout = 1500)
  $c = [System.Net.Sockets.TcpClient]::new()
  try {
    $iar = $c.BeginConnect($IP, 9999, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne($Timeout, $false)) { return $null }
    $c.EndConnect($iar)
    $s = $c.GetStream(); $s.ReadTimeout = $Timeout; $s.WriteTimeout = $Timeout
    $plain = [Text.Encoding]::ASCII.GetBytes($Cmd)
    $key = 171
    $enc = New-Object byte[] $plain.Length
    for ($i = 0; $i -lt $plain.Length; $i++) { $a = $key -bxor $plain[$i]; $key = $a; $enc[$i] = [byte]$a }
    $lenBytes = [byte[]]@([byte](($enc.Length -shr 24) -band 255), [byte](($enc.Length -shr 16) -band 255), [byte](($enc.Length -shr 8) -band 255), [byte]($enc.Length -band 255))
    $s.Write($lenBytes, 0, 4); $s.Write($enc, 0, $enc.Length); $s.Flush()
    $hdr = New-Object byte[] 4; $got = 0
    while ($got -lt 4) { $n = $s.Read($hdr, $got, 4 - $got); if ($n -le 0) { break }; $got += $n }
    if ($got -lt 4) { return $null }
    $rlen = ($hdr[0] -shl 24) -bor ($hdr[1] -shl 16) -bor ($hdr[2] -shl 8) -bor $hdr[3]
    if ($rlen -le 0 -or $rlen -gt 200000) { return $null }
    $buf = New-Object byte[] $rlen; $got = 0
    while ($got -lt $rlen) { $n = $s.Read($buf, $got, $rlen - $got); if ($n -le 0) { break }; $got += $n }
    $key = 171
    $out = New-Object byte[] $got
    for ($i = 0; $i -lt $got; $i++) { $a = $key -bxor $buf[$i]; $key = $buf[$i]; $out[$i] = [byte]$a }
    return [Text.Encoding]::ASCII.GetString($out)
  } catch { return $null } finally { $c.Close() }
}

foreach ($h in $Hosts) {
  $r = Invoke-TpLink -IP $h -Cmd '{"system":{"get_sysinfo":{}}}'
  if (-not $r) { $r = Invoke-TpLink -IP $h -Cmd '{"system":{"get_sysinfo":{}}}' }
  Write-Output "===== $h ====="
  if (-not $r) { Write-Output "  no response (legacy protocol closed)"; continue }
  try {
    $j = $r | ConvertFrom-Json
    $si = $j.system.get_sysinfo
    if ($si) {
      "  model      : $($si.model)"
      "  alias      : $($si.alias)"
      "  dev_name   : $($si.dev_name)"
      "  sw_ver     : $($si.sw_ver)   hw_ver: $($si.hw_ver)"
      "  type       : $($si.type)   mic_type: $($si.mic_type)"
      "  mac        : $($si.mac)   deviceId: $($si.deviceId)"
      "  relay      : $($si.relay_state)   on_time: $($si.on_time)"
      "  feature    : $($si.feature)"
      "  rssi       : $($si.rssi)"
      if ($si.children) { "  children   : " + (($si.children | ForEach-Object { "$($_.alias)/$($_.model)" }) -join ', ') }
    } else { "  raw: " + $r.Substring(0, [Math]::Min(400, $r.Length)) }
  } catch { "  parse-fail raw: " + $r.Substring(0, [Math]::Min(300, $r.Length)) }
}
