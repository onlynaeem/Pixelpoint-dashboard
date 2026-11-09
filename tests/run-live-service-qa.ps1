$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
$saved=Get-Content -Raw -LiteralPath (Join-Path $root 'local-live/db-credentials.json') | ConvertFrom-Json
$secure=ConvertTo-SecureString $saved.password
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$builder=New-Object System.Data.Odbc.OdbcConnectionStringBuilder
try{
 $builder['DSN']='PixelSqlbase';$builder['UID']=$saved.username;$builder['PWD']=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
 $builder['ASTART']='NO';$builder['LINKS']='TCPIP(HOST=127.0.0.1)';$builder['ServerName']='PixelSqlbase';$builder['DBN']='PixelSqlbase';$builder['CharSet']='IBM850'
 $env:PIXELPOINT_ODBC=$builder.ConnectionString
 & node 'tests/live-service-qa.mjs'
 if($LASTEXITCODE -ne 0){throw 'Live service verification failed.'}
}finally{
 Remove-Item Env:PIXELPOINT_ODBC -ErrorAction SilentlyContinue
 $builder.Clear();[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$secure.Dispose()
}

