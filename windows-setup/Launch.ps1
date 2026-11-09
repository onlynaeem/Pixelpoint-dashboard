param([ValidateSet('sync','once','demo','uninstall')][string]$Mode='sync',[switch]$Unattended)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
$nodePath=(Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'node-path.txt')).Trim()
if($Mode -eq 'uninstall') {
 Add-Type -AssemblyName System.Windows.Forms
 [System.Windows.Forms.MessageBox]::Show('Close all PixelPoint windows. Remove the PixelPoint Cloud startup shortcut (if enabled) and the PixelPoint Cloud desktop shortcuts, then delete this installation folder. Local configuration, queued data and demo data are inside this folder. No cloud data is deleted.','Uninstall instructions') > $null
 exit
}
try{
if($Mode -ne 'demo'){
 $secrets=Get-Content -Raw -LiteralPath (Join-Path $root 'connector/secrets.json') | ConvertFrom-Json
 function Reveal($text){
  $s=ConvertTo-SecureString $text
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
  finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$s.Dispose()}
 }
 $env:PIXELPOINT_ODBC=Reveal $secrets.odbc
 $env:PIXELPOINT_API_KEY=Reveal $secrets.key
}
 if($Mode -eq 'demo'){
  & (Join-Path $root 'scripts/Start-LoginDashboard.ps1')
 }elseif($Mode -eq 'once'){
  & $nodePath 'connector/agent.mjs' '--once'
 }else{
  & $nodePath 'connector/agent.mjs'
 }
 $result=$LASTEXITCODE
 Write-Host "Process exited with code $result"
 if(!$Unattended){Read-Host 'Press Enter to close'}
 exit $result
}finally{
 Remove-Item Env:PIXELPOINT_ODBC -ErrorAction SilentlyContinue
 Remove-Item Env:PIXELPOINT_API_KEY -ErrorAction SilentlyContinue
}

