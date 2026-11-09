param([string]$ConfigPath=(Join-Path $PSScriptRoot '../connector/config.pixelpoint-local.json'))
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
$builder=$null;$apiPtr=[IntPtr]::Zero;$apiSecret=$null
try {
 if(!(Test-Path -LiteralPath $ConfigPath)){throw 'Copy connector/config.pixelpoint-local.example.json to connector/config.pixelpoint-local.json and set the restaurant ID and HTTPS API URL first.'}
 $cfg=Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
 if($cfg.restaurant_id -match 'REPLACE' -or $cfg.api_url -match 'REPLACE'){throw 'Set the real restaurant ID and HTTPS API URL in the connector configuration before starting.'}
 $cred=Get-Credential -UserName 'reportuser' -Message 'Enter the SQL Anywhere read-only account password.'
 if(!$cred){throw 'Database credentials not supplied.'}
 $apiSecret=Read-Host 'Restaurant connector API key' -AsSecureString
 $apiPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiSecret)
 $builder=New-Object System.Data.Odbc.OdbcConnectionStringBuilder
 $builder['DSN']='PixelSqlbase';$builder['UID']=$cred.UserName
 $builder['PWD']=$cred.GetNetworkCredential().Password
 $builder['ASTART']='NO';$builder['LINKS']='TCPIP(HOST=127.0.0.1)'
 $builder['ServerName']='PixelSqlbase';$builder['DBN']='PixelSqlbase';$builder['CharSet']='IBM850'
 $env:PIXELPOINT_ODBC=$builder.ConnectionString
 $env:PIXELPOINT_API_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($apiPtr)
 $env:CONNECTOR_CONFIG=(Resolve-Path -LiteralPath $ConfigPath).Path
 Write-Host 'Starting reporting connector. Keep this window open; Ctrl+C stops synchronization.'
 & node 'connector/agent.mjs'
 if($LASTEXITCODE -ne 0){throw 'Connector exited with an error. Check the message above.'}
}finally{
 Remove-Item Env:PIXELPOINT_ODBC -ErrorAction SilentlyContinue
 Remove-Item Env:PIXELPOINT_API_KEY -ErrorAction SilentlyContinue
 Remove-Item Env:CONNECTOR_CONFIG -ErrorAction SilentlyContinue
 if($builder){$builder.Clear()};if($apiPtr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($apiPtr)}
 if($apiSecret){$apiSecret.Dispose()}
}

