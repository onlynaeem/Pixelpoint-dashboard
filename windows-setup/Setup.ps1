$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$source=Split-Path $PSScriptRoot -Parent
$nodeCommand=Get-Command node.exe -ErrorAction SilentlyContinue
if(!$nodeCommand){
 [Windows.Forms.MessageBox]::Show('Install Node.js 24.x from https://nodejs.org, then run setup again.','Node.js required') > $null
 exit 1
}
$nodePath=$nodeCommand.Source
$nodeVersion=& $nodePath -p 'process.versions.node'
if([int]($nodeVersion.Split('.')[0]) -ne 24){
 [Windows.Forms.MessageBox]::Show('This pilot requires Node.js 24.x. Install it and run setup again.','Node.js 24 required') > $null
 exit 1
}
$form=New-Object Windows.Forms.Form
$form.Text='PixelPoint Cloud Reporting - Windows Setup 2.1.1'
$form.Size=New-Object Drawing.Size(650,670)
$form.StartPosition='CenterScreen'
$form.FormBorderStyle='FixedDialog'
$form.MaximizeBox=$false
$heading=New-Object Windows.Forms.Label
$heading.Text='Install your reporting connector or local demo'
$heading.Location=New-Object Drawing.Point(20,15)
$heading.Size=New-Object Drawing.Size(600,30)
$form.Controls.Add($heading)
$inputs=@{}
function Field($name,$label,$value,$y,$secret=$false){
 $l=New-Object Windows.Forms.Label
 $l.Text=$label
 $l.Location=New-Object Drawing.Point(20,$y)
 $l.Size=New-Object Drawing.Size(190,24)
 $t=New-Object Windows.Forms.TextBox
 $t.Text=$value
 $t.Location=New-Object Drawing.Point(215,$y)
 $t.Size=New-Object Drawing.Size(390,24)
 $t.UseSystemPasswordChar=$secret
 $form.Controls.Add($l);$form.Controls.Add($t);$inputs[$name]=$t
}
Field 'folder' 'Installation folder' (Join-Path $env:LOCALAPPDATA 'PixelPointCloud') 60
$demo=New-Object Windows.Forms.CheckBox
$demo.Text='Demo only (no database connection)'
$demo.Checked=$true
$demo.Location=New-Object Drawing.Point(215,100)
$demo.Size=New-Object Drawing.Size(390,25)
$form.Controls.Add($demo)
Field 'id' 'Restaurant ID' 'r1' 145
Field 'url' 'Cloud API URL (HTTPS)' 'https://reports.example.com' 185
Field 'key' 'Restaurant API key' '' 225 $true
Field 'odbc' 'ODBC connection string' 'DSN=PixelPointReporting;UID=report_user;PWD=...' 265 $true
Field 'zone' 'IANA timezone' 'Asia/Bahrain' 305
Field 'interval' 'Sync interval (seconds)' '60' 345
Field 'days' 'Lookback days (1-366)' '8' 385
$startup=New-Object Windows.Forms.CheckBox
$startup.Text='Start connector when this Windows user signs in'
$startup.Location=New-Object Drawing.Point(215,425)
$startup.Size=New-Object Drawing.Size(400,25)
$form.Controls.Add($startup)
$note=New-Object Windows.Forms.Label
$note.Text='Requires installed Node.js 24.x. SQL Anywhere ODBC driver is required for live data. Credentials are encrypted for this Windows user. Demo opens with a separate dashboard administrator login.'
$note.Location=New-Object Drawing.Point(20,470)
$note.Size=New-Object Drawing.Size(585,60)
$form.Controls.Add($note)
$button=New-Object Windows.Forms.Button
$button.Text='Install'
$button.Location=New-Object Drawing.Point(470,550)
$button.Size=New-Object Drawing.Size(135,35)
$form.Controls.Add($button)
$button.Add_Click({
 try {
  $dest=[IO.Path]::GetFullPath($inputs.folder.Text)
  if(Test-Path -LiteralPath $dest){
   if((Get-ChildItem -LiteralPath $dest -Force | Measure-Object).Count -gt 0){throw 'Choose a new empty installation folder. Existing configurations will not be overwritten.'}
  }
  if(!$demo.Checked){
   $uri=$null
   if(![uri]::TryCreate($inputs.url.Text,[UriKind]::Absolute,[ref]$uri) -or $uri.Scheme -ne 'https'){throw 'Enter a valid HTTPS cloud API URL.'}
   if($inputs.key.Text.Length -lt 24){throw 'Enter the restaurant API key (at least 24 characters).'}
   if(!$inputs.id.Text.Trim() -or !$inputs.odbc.Text.Trim()){throw 'Restaurant ID and ODBC connection string are required.'}
   $seconds=0;$days=0
   if(![int]::TryParse($inputs.interval.Text,[ref]$seconds) -or $seconds -lt 30){throw 'Interval must be an integer of at least 30 seconds.'}
   if(![int]::TryParse($inputs.days.Text,[ref]$days) -or $days -lt 1 -or $days -gt 366){throw 'Lookback must be between 1 and 366 days.'}
   $zoneCheck=& $nodePath -e 'try{new Intl.DateTimeFormat(undefined,{timeZone:process.argv[1]});}catch(e){process.exit(1)}' $inputs.zone.Text
   if($LASTEXITCODE -ne 0){throw 'Invalid IANA timezone.'}
  }
  $button.Enabled=$false
  New-Item -ItemType Directory -Path $dest -Force > $null
  # Restrict queued sales and DPAPI configuration to the installer user and SYSTEM.
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls.exe $dest '/inheritance:r' '/grant:r' ("*"+$sid+':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' > $null
  if($LASTEXITCODE -ne 0){throw 'Unable to restrict installation directory permissions.'}
  Get-ChildItem -LiteralPath $source | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force}
  # Store the existing local runtime path; do not redistribute or copy its binary.
  Set-Content -LiteralPath (Join-Path $dest 'windows-setup/node-path.txt') -Value $nodePath -Encoding UTF8
  if(!$demo.Checked){
   $config=@{restaurant_id=$inputs.id.Text.Trim();api_url=$inputs.url.Text.Trim();allow_http_local=$false;key_env='PIXELPOINT_API_KEY';timezone=$inputs.zone.Text.Trim();mode='interval';interval_seconds=$seconds;daily_at='02:00';lookback_days=$days;outbox='connector/outbox';source_owner='DBA';powershell_path=(Join-Path $env:WINDIR 'SysWOW64/WindowsPowerShell/v1.0/powershell.exe')}
   $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dest 'connector/config.json') -Encoding UTF8
   $secrets=@{key=(ConvertTo-SecureString $inputs.key.Text -AsPlainText -Force | ConvertFrom-SecureString);odbc=(ConvertTo-SecureString $inputs.odbc.Text -AsPlainText -Force | ConvertFrom-SecureString)}
   $secrets | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dest 'connector/secrets.json') -Encoding UTF8
  }
  $shell=New-Object -ComObject WScript.Shell
  function Shortcut($name,$mode,$folder){
   $s=$shell.CreateShortcut((Join-Path $folder ($name+'.lnk')))
   $s.TargetPath=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
   $s.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $dest 'windows-setup/Launch.ps1')+'" -Mode '+$mode
   $s.WorkingDirectory=$dest
   $s.Save()
  }
  $desktop=[Environment]::GetFolderPath('Desktop')
  $utilityShortcut=$shell.CreateShortcut((Join-Path $desktop 'PixelPoint Connection Utility.lnk'))
  $utilityShortcut.TargetPath=Join-Path $dest 'PixelPoint-Connection-Utility.exe'
  $utilityShortcut.WorkingDirectory=$dest
  $utilityShortcut.Save()
  Shortcut 'PixelPoint Cloud Demo' 'demo' $desktop
  Shortcut 'PixelPoint Cloud Uninstall Instructions' 'uninstall' $desktop
  if(!$demo.Checked){
   Shortcut 'PixelPoint Cloud - Start Sync' 'sync' $desktop
   Shortcut 'PixelPoint Cloud - Test Sync' 'once' $desktop
   if($startup.Checked){Shortcut 'PixelPoint Cloud Connector' 'sync' ([Environment]::GetFolderPath('Startup'))}
  }
  [Windows.Forms.MessageBox]::Show('Installation complete. Use the desktop shortcuts. Run Test Sync first for live connectors. Setup has not connected to the POS database or started synchronization.','PixelPoint Cloud') > $null
  $form.Close()
 }catch{
  $button.Enabled=$true
  [Windows.Forms.MessageBox]::Show($_.Exception.Message,'Setup error') > $null
 }
})
[void]$form.ShowDialog()




