# Aggregate netsh WLAN scan into per-channel congestion table (2.4 GHz focus)
$ErrorActionPreference = 'SilentlyContinue'
$raw = netsh wlan show networks mode=bssid | Out-String
$blocks = [regex]::Matches($raw, "(?ms)^SSID \d+ : (.*?)\r?\n(.*?)(?=^SSID \d+ : |\z)")
$rows = @()
foreach ($b in $blocks) {
  $ssid = $b.Groups[1].Value.Trim()
  $body = $b.Groups[2].Value
  $bssids = [regex]::Matches($body, "(?ms)BSSID \d+\s+:\s*([0-9a-f:]{17})(.*?)(?=BSSID \d+\s+:|\z)")
  foreach ($x in $bssids) {
    $mac = $x.Groups[1].Value
    $t = $x.Groups[2].Value
    $sig = ''; $band = ''; $ch = ''; $util = ''; $sta = ''; $radio = ''
    if ($t -match 'Signal\s+:\s*(\d+)%') { $sig = [int]$Matches[1] }
    if ($t -match 'Band\s+:\s*([\d.]+ GHz)') { $band = $Matches[1] }
    if ($t -match 'Channel\s+:\s*(\d+)') { $ch = [int]$Matches[1] }
    if ($t -match 'Radio type\s+:\s*(\S+)') { $radio = $Matches[1] }
    if ($t -match 'Channel Utilization:\s*(\d+)') { $util = [int]$Matches[1] }
    if ($t -match 'Connected Stations:\s*(\d+)') { $sta = [int]$Matches[1] }
    $rows += [pscustomobject]@{ SSID = $ssid; BSSID = $mac; Band = $band; Channel = $ch; SignalPct = $sig; UtilPct = $util; Stations = $sta; Radio = $radio }
  }
}
Write-Output "total BSS entries: $($rows.Count)"
Write-Output ""
Write-Output "================ 2.4 GHz per-channel congestion ================"
$rows | Where-Object { $_.Band -eq '2.4 GHz' } | Group-Object Channel | Sort-Object { [int]$_.Name } | ForEach-Object {
  $g = $_.Group
  $utils = $g | Where-Object { $_.UtilPct -ne '' } | ForEach-Object { $_.UtilPct }
  $strong = ($g | Where-Object { $_.SignalPct -ge 40 }).Count
  $owners = ($g | Group-Object BSSID | ForEach-Object { $_.Name })
  "ch {0,-3} radios={1,-3} strong(>=40%)={2,-3} peakUtil={3,-5} avgUtil={4,-6} sumUtil={5}" -f $_.Name, $g.Count, $strong, $(if($utils){($utils|Measure-Object -Maximum).Maximum}else{'n/a'}), $(if($utils){[Math]::Round(($utils|Measure-Object -Average).Average,1)}else{'n/a'}), $(if($utils){($utils|Measure-Object -Sum).Sum}else{0})
}
Write-Output ""
Write-Output "================ 5 GHz per-channel congestion ================"
$rows | Where-Object { $_.Band -eq '5 GHz' } | Group-Object Channel | Sort-Object { [int]$_.Name } | ForEach-Object {
  $g = $_.Group
  $utils = $g | Where-Object { $_.UtilPct -ne '' } | ForEach-Object { $_.UtilPct }
  "ch {0,-4} radios={1,-3} strong(>=40%)={2,-3} peakUtil={3,-5} avgUtil={4}" -f $_.Name, $g.Count, ($g | Where-Object { $_.SignalPct -ge 40 }).Count, $(if($utils){($utils|Measure-Object -Maximum).Maximum}else{'n/a'}), $(if($utils){[Math]::Round(($utils|Measure-Object -Average).Average,1)}else{'n/a'})
}
Write-Output ""
Write-Output "================ strongest BSSes overall (>= 40% signal) ================"
$rows | Where-Object { $_.SignalPct -ge 40 } | Sort-Object -Property @{Expression='SignalPct';Descending=$true} | Format-Table SSID,BSSID,Band,Channel,SignalPct,UtilPct,Stations,Radio -AutoSize | Out-String -Width 200
