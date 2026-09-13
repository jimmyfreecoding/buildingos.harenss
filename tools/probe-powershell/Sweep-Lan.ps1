# LAN host discovery: async ICMP sweep + ARP/MAC collection
param(
  [string]$Subnet = '10.0.0.',
  [int]$Start = 1,
  [int]$End = 254,
  [int]$TimeoutMs = 350,
  [int]$Throttle = 96
)
$ErrorActionPreference = 'SilentlyContinue'
$results = [System.Collections.Concurrent.ConcurrentBag[object]]::new()
$ips = $Start..$End | ForEach-Object { "$Subnet$_" }
$pending = @()
foreach ($ip in $ips) {
  $p = [System.Net.NetworkInformation.Ping]::new()
  $task = $p.SendPingAsync($ip, $TimeoutMs)
  $pending += [pscustomobject]@{ IP = $ip; Task = $task; Ping = $p }
  if ($pending.Count -ge $Throttle) {
    foreach ($item in $pending) {
      try {
        $r = $item.Task.GetAwaiter().GetResult()
        if ($r.Status -eq 'Success') { $results.Add([pscustomobject]@{ IP = $item.IP; RTT = $r.RoundtripTime; TTL = $r.Options.Ttl }) }
      } catch {}
      $item.Ping.Dispose()
    }
    $pending = @()
  }
}
foreach ($item in $pending) {
  try {
    $r = $item.Task.GetAwaiter().GetResult()
    if ($r.Status -eq 'Success') { $results.Add([pscustomobject]@{ IP = $item.IP; RTT = $r.RoundtripTime; TTL = $r.Options.Ttl }) }
  } catch {}
  $item.Ping.Dispose()
}

$alive = $results | Sort-Object { [version]($_.IP) }
Write-Output "=== ICMP alive hosts: $($alive.Count) ==="
$alive | Format-Table -AutoSize | Out-String -Width 120

# Now enrich with neighbor table (ARP)
Start-Sleep -Milliseconds 300
$neigh = Get-NetNeighbor -AddressFamily IPv4 -InterfaceIndex 17 |
  Where-Object { $_.State -ne 'Unreachable' -and $_.LinkLayerAddress -ne '' -and $_.IPAddress -notlike '224.*' -and $_.IPAddress -notlike '239.*' -and $_.IPAddress -ne '255.255.255.255' }
Write-Output "=== Neighbor table (interface 17) ==="
$neigh | Sort-Object { [version]$_.IPAddress } | Format-Table IPAddress,LinkLayerAddress,State -AutoSize | Out-String -Width 120
