$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
try{
 $node=(Get-Command node.exe).Source
 $version=& $node -p 'process.versions.node'
 if([int]($version.Split('.')[0]) -ne 24){throw 'Install Node.js 24.x first.'}
 $hasUsers=& $node 'scripts/check-users.mjs' (Join-Path $root 'login-demo.db')
 if($LASTEXITCODE -ne 0){throw 'Could not inspect the local user database.'}
 if($hasUsers.Trim() -ne 'true'){
  Write-Host 'Create the first administrator for the demo brand. Password: 12 to 128 characters.'
  $credential=Get-Credential -Message 'First brand administrator - enter your email and new password'
  if(!$credential){throw 'Administrator setup cancelled.'}
  $env:ADMIN_EMAIL=$credential.UserName
  $env:ADMIN_PASSWORD=$credential.GetNetworkCredential().Password
  $env:BOOTSTRAP_TENANT_ID='demo'
 }
 $env:DEMO='true';$env:DEMO_DB=Join-Path $root 'login-demo.db'
 $env:HOST='127.0.0.1';$env:SESSION_SECURE='false';$env:OPEN_BROWSER='true'
 & $node 'scripts/start-login-demo.mjs'
}catch{Write-Host $_.Exception.Message -ForegroundColor Red;Read-Host 'Press Enter to close'}
finally{Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue;Remove-Item Env:ADMIN_EMAIL -ErrorAction SilentlyContinue}

