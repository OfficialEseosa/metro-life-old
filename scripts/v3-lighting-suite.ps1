param([Parameter(Mandatory=$true)][int]$ExistingQaPid)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$qaFile=Join-Path $root '.runtime/v3-qa.json'
$java='C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin\java.exe'
function Stop-Qa([int]$qaPid){
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$qaPid"
  if(!$process -or $process.CommandLine -notmatch 'java.exe" -jar target/backend-0.0.1-SNAPSHOT.jar$'){throw "Unexpected QA process $qaPid"}
  Stop-Process -Id $qaPid
}
Set-Location $root
$qaPid=$ExistingQaPid
foreach($width in @(1280,375)){foreach($quality in @('normal','low')){
  Stop-Qa $qaPid
  # This dedicated QA save has its own clock; main backend/data is never touched.
  $data=Get-Content -LiteralPath $qaFile -Raw | ConvertFrom-Json
  $data.worlds.public.startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-120000
  $temporary="$qaFile.tmp"
  $data | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $temporary -Encoding utf8
  Move-Item -LiteralPath $temporary -Destination $qaFile -Force
  $previous=$env:METRO_DATA
  try{
    $env:METRO_DATA='../.runtime/v3-qa.json'
    $process=Start-Process -FilePath $java -ArgumentList '-jar','target/backend-0.0.1-SNAPSHOT.jar' -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.runtime/v3-qa-out.log') -RedirectStandardError (Join-Path $root '.runtime/v3-qa-err.log') -PassThru
    $qaPid=$process.Id
  }finally{$env:METRO_DATA=$previous}
  $ready=$false
  for($attempt=0;$attempt -lt 40;$attempt++){
    try{if((Invoke-WebRequest 'http://127.0.0.1:8080/api/world' -TimeoutSec 2).StatusCode -eq 200){$ready=$true;break}}catch{}
    Start-Sleep -Milliseconds 250
  }
  if(!$ready){throw 'QA backend did not become ready'}
  Write-Output "Lighting $width $quality, isolated QA server PID $qaPid"
  & node scripts/v3-lighting.cjs $width $quality
  if($LASTEXITCODE -ne 0){throw "Lighting $width failed; QA server remains $qaPid"}
}
}
Write-Output "Both lighting sizes passed. QA server remains $qaPid"
