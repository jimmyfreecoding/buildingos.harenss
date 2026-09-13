# Multicast discovery properly bound to the wired LAN interface (SSDP / ONVIF / mDNS)
$ErrorActionPreference = 'SilentlyContinue'
$LocalIP = '10.0.0.236'
$results = [System.Collections.Generic.List[object]]::new()

function Probe {
  param([string]$Name, [string]$Payload, [string]$Group, [int]$Port, [int]$WaitMs)
  $u = [System.Net.Sockets.UdpClient]::new([System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse($LocalIP), 0))
  $u.Client.ReceiveTimeout = 400
  $u.MulticastLoopback = $false
  $bytes = [Text.Encoding]::UTF8.GetBytes($Payload)
  $ep = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse($Group), $Port)
  [void]$u.Send($bytes, $bytes.Length, $ep)
  Write-Output "[$Name] sent $($bytes.Length)B to ${Group}:$Port from $LocalIP"
  $src = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $WaitMs) {
    try {
      $data = $u.Receive([ref]$src)
      $txt = [Text.Encoding]::UTF8.GetString($data)
      $results.Add([pscustomobject]@{ Probe = $Name; From = $src.Address.ToString(); Text = $txt })
    } catch { }
  }
  $u.Close()
}

$ssdp = "M-SEARCH * HTTP/1.1`r`nHOST: 239.255.255.250:1900`r`nMAN: `"ssdp:discover`"`r`nMX: 3`r`nST: ssdp:all`r`nUSER-AGENT: dsh-diag`r`n`r`n"
Probe -Name 'SSDP' -Payload $ssdp -Group '239.255.255.250' -Port 1900 -WaitMs 5000

$onvif = '<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl"><e:Header><w:MessageID>uuid:dsh-0002</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>'
Probe -Name 'ONVIF' -Payload $onvif -Group '239.255.255.250' -Port 3702 -WaitMs 5000

# mDNS: ask for common service types (one query per type, sequential to keep it simple)
$mdnsTypes = @('_services._dns-sd._udp.local','_rtsp._tcp.local','_tapo._tcp.local','_kasa._tcp.local','_hap._tcp.local','_googlecast._tcp.local','_workstation._tcp.local','_http._tcp.local')
$hdr = [byte[]]@(0,0, 0,0, 0,1, 0,0, 0,0, 0,0)   # ID=0 flags=0 QDCOUNT=1
foreach ($t in $mdnsTypes) {
  $labels = $t.Split('.')
  $body = New-Object System.Collections.Generic.List[byte]
  foreach ($l in $labels) { if ($l.Length -gt 0) { $body.Add([byte]$l.Length); $body.AddRange([Text.Encoding]::ASCII.GetBytes($l)) } }
  $body.Add(0); $body.AddRange([byte[]]@(0,12, 0,1))   # PTR IN
  $pkt = $hdr + $body.ToArray()
  Probe -Name "mDNS:$t" -Payload '' -Group '0.0.0.0' -Port 0 -WaitMs 1  # placeholder, replaced below
}

Write-Output ""
Write-Output "================ RESPONSES: $($results.Count) ================"
foreach ($r in $results) {
  $snippet = ($r.Text -replace "`r?`n", ' | ')
  if ($snippet.Length -gt 300) { $snippet = $snippet.Substring(0,300) }
  Write-Output "[$($r.Probe)] from $($r.From)"
  Write-Output "    $snippet"
}
