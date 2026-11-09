$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
 Write-Host 'Reset password for local dashboard administrator admin@local.test.'
 $password=Read-Host 'Enter a new password (at least 12 characters)' -AsSecureString
 $confirm=Read-Host 'Enter the new password again' -AsSecureString
 $a=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($password);$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirm)
 try {
  $first=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($a);$second=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
  if($first -ne $second){throw 'Passwords do not match.'}
  if($first.Length -lt 12 -or $first.Length -gt 128){throw 'Password must contain 12 to 128 characters.'}
  $env:LOCAL_RESET_PASSWORD=$first
  & node scripts/reset-local-admin.mjs
  if($LASTEXITCODE -ne 0){throw 'Password reset failed.'}
 } finally {Remove-Item Env:LOCAL_RESET_PASSWORD -ErrorAction SilentlyContinue;[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}
} catch {Write-Host $_.Exception.Message -ForegroundColor Red}
Read-Host 'Press Enter to close'
