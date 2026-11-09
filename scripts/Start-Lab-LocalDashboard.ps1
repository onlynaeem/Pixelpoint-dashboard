$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
$state=Join-Path $root 'local-live'
$credentialsPath=Join-Path $state 'db-credentials.json'
$cloudPath=Join-Path $state 'cloud.json'
$connectorPath=Join-Path $state 'connector.json'
$builder=$null;$dbPtr=[IntPtr]::Zero
try{
 if(!(Test-Path -LiteralPath $state)){
  New-Item -ItemType Directory -Path $state | Out-Null
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls $state /inheritance:r /grant:r "${identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Could not secure the local dashboard folder.'}
 }
 if(!(Test-Path -LiteralPath $credentialsPath)){
  $sourceCred=Get-Credential -UserName 'reportuser' -Message 'Enter the read-only PixelPoint database credentials. They will be protected for this Windows account.'
  if(!$sourceCred){throw 'PixelPoint credential setup was cancelled.'}
  @{username=$sourceCred.UserName;password=($sourceCred.Password | ConvertFrom-SecureString)} | ConvertTo-Json | Set-Content -LiteralPath $credentialsPath -Encoding UTF8
 }
 $node=(Get-Command node.exe).Source;$version=& $node -p 'process.versions.node'
 if([int]($version.Split('.')[0]) -ne 24){throw 'Node.js 24.x is required.'}
 if(!(Test-Path -LiteralPath $cloudPath)){
  $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
  $key=([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
  $config=@{viewers=@();restaurants=@(@{id='local-pixelpoint';tenant_id='lab-naeem';name='LAB Naeem test';country='BH';currency='BHD';timezone='Asia/Bahrain';key=$key})}
  $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $cloudPath -Encoding UTF8
 }
 $cloud=Get-Content -Raw -LiteralPath $cloudPath | ConvertFrom-Json
 if(!(Test-Path -LiteralPath $connectorPath)){
  $cfg=@{restaurant_id='local-pixelpoint';api_url='http://127.0.0.1:1';allow_http_local=$true;key_env='PIXELPOINT_API_KEY';timezone='Asia/Bahrain';mode='interval';interval_seconds=300;daily_at='02:00';lookback_days=2;outbox=(Join-Path $state 'outbox');source_owner='DBA';powershell_path='C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe'}
  $cfg | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $connectorPath -Encoding UTF8
 }
 $dbPath=Join-Path $state 'live.db'
 $hasUsers=& $node 'scripts/check-users.mjs' $dbPath
 if($LASTEXITCODE -ne 0){throw 'Cannot check local dashboard accounts.'}
 if($hasUsers.Trim() -ne 'true'){
  $admin=Get-Credential -UserName 'admin@local.test' -Message 'Create the local dashboard administrator. Enter an email and a new password of at least 12 characters.'
  if(!$admin){throw 'Dashboard administrator setup was cancelled.'}
  if($admin.GetNetworkCredential().Password.Length -lt 12){throw 'Dashboard password must contain at least 12 characters.'}
  $env:ADMIN_EMAIL=$admin.UserName;$env:ADMIN_PASSWORD=$admin.GetNetworkCredential().Password;$env:BOOTSTRAP_TENANT_ID='lab-naeem'
 }
 $saved=Get-Content -Raw -LiteralPath $credentialsPath | ConvertFrom-Json
 $dbSecret=ConvertTo-SecureString $saved.password
 $dbPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbSecret)
 $builder=New-Object System.Data.Odbc.OdbcConnectionStringBuilder
 $builder['DSN']='PixelSqlbase';$builder['UID']=$saved.username;$builder['PWD']=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbPtr)
 $builder['ASTART']='NO';$builder['LINKS']='TCPIP(HOST=127.0.0.1)';$builder['ServerName']='PixelSqlbase';$builder['DBN']='PixelSqlbase';$builder['CharSet']='IBM850'
 $env:PIXELPOINT_ODBC=$builder.ConnectionString
 $env:PIXELPOINT_API_KEY=$cloud.restaurants[0].key
 $env:CLOUD_CONFIG=$cloudPath;$env:DEMO_DB=$dbPath;$env:LOCAL_STATE_DIR=$state;$env:OPEN_BROWSER='true'
 Write-Host 'Starting LAB Naeem test local dashboard. Keep this window open. Ctrl+C stops it.'
 & $node 'scripts/local-dashboard.mjs'
 if($LASTEXITCODE -ne 0){throw 'Local dashboard stopped. See the message above.'}
}catch{
 Write-Host $_.Exception.Message -ForegroundColor Red
 Read-Host 'Press Enter to close'
}finally{
 foreach($name in @('ADMIN_PASSWORD','ADMIN_EMAIL','BOOTSTRAP_TENANT_ID','PIXELPOINT_ODBC','PIXELPOINT_API_KEY','CLOUD_CONFIG','DEMO_DB','LOCAL_STATE_DIR','OPEN_BROWSER')){Remove-Item "Env:$name" -ErrorAction SilentlyContinue}
 if($builder){$builder.Clear()}
 if($dbPtr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dbPtr)}
 if($dbSecret){$dbSecret.Dispose()}
}

