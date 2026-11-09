$ErrorActionPreference='Stop'
try{
 $credential=Get-Credential -Message 'PixelPoint database credentials. This saves them locally and does NOT connect to the database.'
 if(!$credential){exit}
 $folder=Join-Path ([IO.Path]::GetTempPath()) 'Ebosoft-PixelPoint-Private'
 New-Item -ItemType Directory -Path $folder -Force > $null
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 & icacls.exe $folder '/inheritance:r' '/grant:r' ("*"+$sid+':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' > $null
 if($LASTEXITCODE -ne 0){throw 'Could not restrict the private credentials directory.'}
 $record=@{dsn='PixelSqlbase';bitness=32;username=$credential.UserName;password=($credential.Password | ConvertFrom-SecureString);connectionApproved=$false;savedAt=(Get-Date).ToUniversalTime().ToString('o')}
 $record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $folder 'credentials.json') -Encoding UTF8
 Write-Host 'Credentials saved encrypted for this Windows user. No database connection was made.'
 Write-Host 'The database test remains paused pending authorization for possible driver telemetry.'
}catch{Write-Host $_.Exception.Message -ForegroundColor Red}
Read-Host 'Press Enter to close'

