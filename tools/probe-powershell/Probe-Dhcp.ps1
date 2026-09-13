# Rogue-DHCP / topology probe: broadcast DHCPDISCOVER with a synthetic client MAC and
# collect EVERY DHCPOFFER answering on the wire (reveals multiple DHCP servers).
$ErrorActionPreference = 'SilentlyContinue'

function New-DhcpDiscover([byte[]]$mac, [uint32]$xid) {
  $ms = [System.IO.MemoryStream]::new()
  $bw = [System.IO.BinaryWriter]::new($ms)
  $bw.Write([byte]1)      # op = BOOTREQUEST
  $bw.Write([byte]1)      # htype = ethernet
  $bw.Write([byte]6)      # hlen
  $bw.Write([byte]0)      # hops
  $bw.Write([uint32]$xid)
  $bw.Write([uint16]0)    # secs
  $bw.Write([uint16]0x8000) # flags = broadcast
  $bw.Write([uint32]0); $bw.Write([uint32]0); $bw.Write([uint32]0); $bw.Write([uint32]0)
  $ch = New-Object byte[] 16
  [Array]::Copy($mac, 0, $ch, 0, 6)
  $bw.Write($ch)
  $bw.Write((New-Object byte[] 64))   # sname
  $bw.Write((New-Object byte[] 128))  # file
  $bw.Write([byte[]]@(99,130,83,99))  # magic cookie
  $bw.Write([byte[]]@(53,1,1))        # DHCP message type = DISCOVER
  $bw.Write([byte[]]@(55,4,1,3,6,15)) # param request: mask, router, dns, domain
  $bw.Write([byte[]]@(255))
  $bw.Flush()
  return $ms.ToArray()
}

function Parse-Dhcp([byte[]]$d) {
  if ($d.Length -lt 240) { return $null }
  $op = $d[0]
  if ($op -ne 2) { return $null }
  $yiaddr = "$($d[16]).$($d[17]).$($d[18]).$($d[19])"
  $siaddr = "$($d[20]).$($d[21]).$($d[22]).$($d[23])"
  $mac = (($d[28..33] | ForEach-Object { $_.ToString('x2') }) -join ':')
  $o = @{ yiaddr = $yiaddr; siaddr = $siaddr; chaddr = $mac }
  $i = 240
  while ($i -lt $d.Length) {
    $code = $d[$i]; if ($code -eq 255) { break }
    if ($code -eq 0) { $i++; continue }
    if ($i + 1 -ge $d.Length) { break }
    $len = $d[$i+1]; $v = @(); if ($len -gt 0) { $v = $d[($i+2)..([Math]::Min($i+1+$len, $d.Length-1))] }
    switch ($code) {
      1  { $o['mask']   = "$($v[0]).$($v[1]).$($v[2]).$($v[3])" }
      3  { $o['router'] = "$($v[0]).$($v[1]).$($v[2]).$($v[3])" }
      6  { $o['dns']    = (($v | ForEach-Object { $_ }) -join '.') }
      15 { $o['domain'] = -join ($v | ForEach-Object { [char]$_ }) }
      51 { $o['lease']  = [uint32]($v[0] -shl 24 -bor $v[1] -shl 16 -bor $v[2] -shl 8 -bor $v[3]) }
      53 { $o['type']   = $v[0] }
      54 { $o['server'] = "$($v[0]).$($v[1]).$($v[2]).$($v[3])" }
    }
    $i += 2 + $len
  }
  return [pscustomobject]$o
}

$mac = [byte[]]@(0x02,0x5A,0x11,0x22,0x33,0x44)
$xid = [uint32](Get-Random -Minimum 100000 -Maximum 999999)
$pkt = New-DhcpDiscover -mac $mac -xid $xid

$u = [System.Net.Sockets.UdpClient]::new()
$u.Client.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::ReuseAddress, $true)
$u.Client.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::Broadcast, $true)
try { $u.Client.Bind([System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 68)) } catch { Write-Output "bind :68 failed: $($_.Exception.Message)"; return }
$u.EnableBroadcast = $true
[void]$u.Send($pkt, $pkt.Length, [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Broadcast, 67))
Write-Output "sent DHCPDISCOVER xid=$xid from synthetic MAC 02:5a:11:22:33:44"
$u.Client.ReceiveTimeout = 500
$src = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0)
$offers = @{}
$sw = [System.Diagnostics.Stopwatch]::StartNew()
while ($sw.ElapsedMilliseconds -lt 8000) {
  try {
    $resp = $u.Receive([ref]$src)
    $p = Parse-Dhcp $resp
    if ($p) {
      $key = "$($p.server)/$($src.Address)"
      $offers[$key] = $p
      Write-Output "OFFER from $($src.Address) -> yiaddr=$($p.yiaddr) server=$($p.server) router=$($p.router) dns=$($p.dns) mask=$($p.mask) domain=$($p.domain) lease=$($p.lease)s"
    }
  } catch { }
}
$u.Close()
Write-Output ""
Write-Output "=== distinct DHCP responders: $($offers.Count) ==="
foreach ($k in $offers.Keys) { "  $k  yiaddr=$($offers[$k].yiaddr)" }
