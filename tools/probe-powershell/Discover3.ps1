# Multicast/SSDP/ONVIF/mDNS discovery bound to the wired LAN interface
$ErrorActionPreference = 'SilentlyContinue'
$LocalIP = [System.Net.IPAddress]::Parse('10.0.0.236')
$results = [System.Collections.Generic.List[object]]::new()

function Probe {
  param([string]$Name, [byte[]]$Payload, [string]$Group, [int]$Port, [int]$WaitMs)
  $u = [System.Net.Sockets.UdpClient]::new([System.Net.IPEndPoint]::new($LocalIP, 0))
  $u.Client.ReceiveTimeout = 400
  $u.MulticastLoopback = $false
  $ep = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse($Group), $Port)
  try { [void]$u.Send($Payload, $Payload.Length, $ep) } catch { Write-Output "[$Name] send failed: $($_.Exception.Message)"; $u.Close(); return }
  $src = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $WaitMs) {
    try { $data = $u.Receive([ref]$src); $results.Add([pscustomobject]@{ Probe=$Name; From=$src.Address.ToString(); Port=$src.Port; Text=[Text.Encoding]::UTF8.GetString($data) }) } catch { }
  }
  $u.Close()
  Write-Output "[$Name] sent to ${Group}:$Port  (responses so far: $($results.Count))"
}

$ssdp = [Text.Encoding]::ASCII.GetBytes("M-SEARCH * HTTP/1.1`r`nHOST: 239.255.255.250:1900`r`nMAN: `"ssdp:discover`"`r`nMX: 2`r`nST: ssdp:all`r`nUSER-AGENT: dsh-diag`r`n`r`n")
Probe -Name 'SSDP' -Payload $ssdp -Group '239.255.255.250' -Port 1900 -WaitMs 4000

$onvif = [Text.Encoding]::UTF8.GetBytes('<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl"><e:Header><w:MessageID>uuid:dsh-0003</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>')
Probe -Name 'ONVIF' -Payload $onvif -Group '239.255.255.250' -Port 3702 -WaitMs 4000

# mDNS queries
foreach ($t in @('_services._dns-sd._udp.local','_rtsp._tcp.local','_tapo._tcp.local','_hap._tcp.local','_http._tcp.local','_workstation._tcp.local')) {
  $body = New-Object System.Collections.Generic.List[byte]
  foreach ($l in $t.Split('.')) { if ($l.Length -gt 0) { $body.Add([byte]$l.Length); $body.AddRange([Text.Encoding]::ASCII.GetBytes($l)) } }
  $body.Add(0); $body.AddRange([byte[]]@(0,12,0,1))
  $pkt = [byte[]]@(0,0, 0,0, 0,1, 0,0, 0,0, 0,0) + $body.ToArray()
  Probe -Name "mDNS $t" -Payload $pkt -Group '224.0.0.251' -Port 5353 -WaitMs 2500
}

Write-Output ""
Write-Output "================ RESPONSES: $($results.Count) ================"
foreach ($r in $results) {
  $s = ($r.Text -replace "`r?`n", ' | ')
  if ($s.Length -gt 260) { $s = $s.Substring(0,260) }
  Write-Output "[$($r.Probe)] $($r.From):$($r.Port)  $s"
}
