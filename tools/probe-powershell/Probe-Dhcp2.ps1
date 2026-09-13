# Fixed rogue-DHCP probe: socket bound to the wired LAN IP, broadcast to the subnet address
$ErrorActionPreference = 'SilentlyContinue'
$LocalIP = '10.0.0.236'
$SubnetBcast = '10.0.0.255'

function New-DhcpDiscover([byte[]]$mac, [uint32]$xid) {
  $ms = [System.IO.MemoryStream]::new(); $bw = [System.IO.BinaryWriter]::new($ms)
  $bw.Write([byte]1); $bw.Write([byte]1); $bw.Write([byte]6); $bw.Write([byte]0)
  $bw.Write([uint32]$xid); $bw.Write([uint16]0); $bw.Write([uint16]0x8000)
  $bw.Write([uint32]0); $bw.Write([uint32]0); $bw.Write([uint32]0); $bw.Write([uint32]0)
  $ch = New-Object byte[] 16; [Array]::Copy($mac,0,$ch,0,6); $bw.Write($ch)
  $bw.Write((New-Object byte[] 64)); $bw.Write((New-Object byte[] 128))
  $bw.Write([byte[]]@(99,130,83,99))
  $bw.Write([byte[]]@(53,1,1, 55,4,1,3,6,15, 255))
  $bw.Flush(); return $ms.ToArray()
}

function Parse-Dhcp([byte[]]$d) {
  if ($d.Length -lt 240 -or $d[0] -ne 2) { return $null }
  $o = @{ yiaddr = "$($d[16]).$($d[17]).$($d[18]).$($d[19])" }
  $i = 240
  while ($i -lt $d.Length) {
    $code = $d[$i]; if ($code -eq 255) { break }
    if ($code -eq 0) { $i++; continue }
    if ($i + 1 -ge $d.Length) { break }
    $len = $d[$i+1]; $v = @(); if ($len -gt 0) { $v = $d[($i+2)..([Math]::Min($i+1+$len,$d.Length-1))] }
    switch ($code) {
      1  { $o['mask']   = "$($v[0]).$($v[1]).$($v[2]).$($v[3])" }
      3  { $o['router'] = "$($v[0]).$($v[1]).$($v[2]).$($v[3])" }
      6  { $o['dns']    = (($v | ForEach-Object { $_ }) -join '.') }
      15 { $o['domain'] = -join ($v | ForEach-Object { [char]$_ }) }
      51 { $o['lease']  = [uint32](($v[0] -shl 24) -bor ($v[1] -shl 16) -bor ($v[2] -shl 8) -bor $v[3]) }
      53 { $o['type']   = $v[0] }
      54 { $o['server'] = "$($v[0]).$($v[1]).$($v[2]).$($v[3])" }
    }
    $i += 2 + $len
  }
  return [pscustomobject]$o
}

$mac = [byte[]]@(0x02,0x5A,0x11,0x22,0x33,0x44)
$u = [System.Net.Sockets.UdpClient]::new([System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse($LocalIP), 68))
$u.EnableBroadcast = $true
$u.Client.ReceiveTimeout = 500

foreach ($try in 1..3) {
  $xid = [uint32](Get-Random -Minimum 100000 -Maximum 999999)
  $pkt = New-DhcpDiscover -mac $mac -xid $xid
  [void]$u.Send($pkt, $pkt.Length, [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse($SubnetBcast), 67))
  Write-Output "sent DHCPDISCOVER #$try xid=$xid from $LocalIP -> $SubnetBcast"
  $src = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt 3000) {
    try {
      $resp = $u.Receive([ref]$src)
      $p = Parse-Dhcp $resp
      if ($p) { Write-Output ("  OFFER  from {0,-14} yiaddr={1,-14} server={2,-14} router={3,-14} dns={4,-24} mask={5} domain='{6}' lease={7}s" -f $src.Address,$p.yiaddr,$p.server,$p.router,$p.dns,$p.mask,$p.domain,$p.lease) }
    } catch { }
  }
}
$u.Close()
Write-Output "done"
