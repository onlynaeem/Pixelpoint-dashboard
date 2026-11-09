param([string]$TaskName='PixelPointCloudConnector')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
if(!(Test-Path -LiteralPath (Join-Path $root 'connector/secrets.json'))){throw 'Run the Windows installer and configure protected credentials first.'}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$credential=Get-Credential -UserName $identity.Name -Message 'Startup task must run under the same account that protected the connector secrets.'
if(!$credential){throw 'No task account supplied.'}
$account=New-Object Security.Principal.NTAccount($credential.UserName)
if($account.Translate([Security.Principal.SecurityIdentifier]).Value -ne $identity.User.Value){throw 'Use the same Windows account that installed and encrypted these credentials.'}
$exe=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
$arguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'Launch.ps1')+'" -Mode sync -Unattended'
$action=New-ScheduledTaskAction -Execute $exe -Argument $arguments -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -AtStartup
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 20 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -User $credential.UserName -Password $credential.GetNetworkCredential().Password -RunLevel Limited
Write-Host 'Startup task registered. Start it and verify a complete synchronization before accepting unattended operation.'
