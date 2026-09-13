# SSDP + ONVIF WS-Discovery + mDNS probe for IP cameras / IoT devices on the LAN
$ErrorActionPreference = 'SilentlyContinue'
$found = [System.Collections.Concurrent.ConcurrentDictionary[string,object]]::new()

function Send-Multicast {
  param([string]$Payload, [string]$Target, [int]$Port, [int]$TimeoutMs)
  $u = [System.Net.Sockets.UdpClient]::new()
  $u.Client.ReceiveTimeout = $TimeoutMs
  $u.Client.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::ReuseAddress, $true)
  $bytes = [Text.Encoding]::UTF8.GetBytes($Payload)
  $ep = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse($Target), $Port)
  [void]$u.Send($bytes, $bytes.Length, $ep)
  $src = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
    try {
      $data = $u.Receive([ref]$src)
      $found[$src.Address.ToString()] = [pscustomobject]@{
        IP = $src.Address.ToString()
        Port = $src.Port
        Text = [Text.Encoding]::UTF8.GetString($data)
      }
    } catch { break }
  }
  $u.Close()
}

$msearch = "M-SEARCH * HTTP/1.1`r`nHOST: 239.255.255.250:1900`r`nMAN: `"ssdp:discover`"`r`nMX: 2`r`nST: ssdp:all`r`nUSER-AGENT: dsh-diag`r`n`r`n"
Send-Multicast -Payload $msearch -Target '239.255.255.250' -Port 1900 -TimeoutMs 4000

$onvif = '<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl"><e:Header><w:MessageID>uuid:0dsh-diag-0001</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>'
Send-Multicast -Payload $onvif -Target '239.255.255.250' -Port 3702 -TimeoutMs 4000

Write-Output "=== Responders: $($found.Count) ==="
foreach ($k in ($found.Keys | Sort-Object)) {
  $v = $found[$k]
  Write-Output "---------------------------------------------"
  Write-Output "IP: $($v.IP)  (reply port $($v.Port))"
  $lines = $v.Text -split "`r?`n"
  $show = $lines | Where-Object { $_ -match '^(HTTP/1.1|SERVER|LOCATION|ST:|USN|X-|Server)' }
  if ($show) { $show | ForEach-Object { "   $_" } }
  if ($v.Text -match '<([a-zA-Z]+:)?(Manufacturer|Model|XAddrs)>') {
    ($v.Text -split '><') | Where-Object { $_ -match '(Manufacturer|Model|XAddrs|Hardware|Name)' } | ForEach-Object { "   [onvif] $_" }
  }
}
Write-Output "=== raw dump (truncated) ==="
foreach ($k in ($found.Keys | Sort-Object)) { Write-Output "---- $k ----"; Write-Output ($found[$k].Text.Substring(0, [Math]::Min(700, $found[$k].Text.Length))) }
