param([string]$Base='http://localhost:8080',[switch]$VerifyRestart)
$ErrorActionPreference='Stop'
$evidenceRoot=Join-Path $PSScriptRoot '..\evidence\m1'
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$cookiePath=Join-Path $evidenceRoot 'session.cookies'
$statePath=Join-Path $evidenceRoot 'before-restart.json'
function Call-Api([string]$path,[hashtable]$body) {
  if($null -eq $body) { $raw=& curl.exe --silent --show-error --fail-with-body --cookie $cookiePath --cookie-jar $cookiePath "$Base/api/$path" }
  else {
    $bodyPath=Join-Path $evidenceRoot 'request.json'
    $body | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $bodyPath -Encoding utf8
    $raw=& curl.exe --silent --show-error --fail-with-body --cookie $cookiePath --cookie-jar $cookiePath -H 'Content-Type: application/json' --data-binary "@$bodyPath" "$Base/api/$path"
  }
  if($LASTEXITCODE) { throw "curl failed for $path : $raw" }
  return ($raw | ConvertFrom-Json)
}
if($VerifyRestart) {
  $before=Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
  $after=Call-Api 'sim'
  if($after.sim.userId -ne $before.sim.userId -or $after.sim.worldId -ne $before.sim.worldId -or $after.sim.cash -ne $before.sim.cash -or $after.sim.xp -ne $before.sim.xp -or $after.sim.skills.cooking.xp -ne $before.sim.skills.cooking.xp) { throw 'Persistent identity, cash, xp or skill mismatch' }
  $after | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'after-restart.json')
  Write-Output 'PASS: same cookie restores world, sim, cash, xp and cooking skill after process restart.'
  exit
}
$guest=Call-Api 'auth/guest' @{username="Smoke $(Get-Date -Format HHmmss)"}
$world=Call-Api 'worlds' @{name='M1 smoke world';mode='solo'}
$setup=Call-Api 'sim/setup' @{city='atl';neighborhood='midtown';aspiration='founder'}
$actions=@(@{city='atl';loc='home';action='sleep'},@{city='atl';loc='home';action='cook'},@{city='atl';loc='home';action='invite'},@{city='atl';loc='home';action='shower'},@{city='atl';loc='krog';action='a0'})
$results=@()
foreach($action in $actions){$result=Call-Api 'act' $action;$results+=$result;Start-Sleep -Milliseconds ([Math]::Max(0,$result.result.busyUntil-[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+150))}
$before=Call-Api 'sim'
if($before.sim.skills.cooking.xp -le 0 -or $before.sim.xp -le 0 -or $before.sim.cash -eq 2500 -or $before.sim.visited -notcontains 'krog'){throw 'Actions did not affect skill, xp, cash or location'}
$before | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $statePath
$results | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'five-actions.json')
Write-Output "PASS: guest, solo world, setup, five actions; cash=$($before.sim.cash), xp=$($before.sim.xp), cooking xp=$($before.sim.skills.cooking.xp). Restart the backend then rerun with -VerifyRestart."
