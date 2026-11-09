param([string]$TaskName='PixelPointCloudConnector')
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node=(Get-Command node.exe).Source
$action=New-ScheduledTaskAction -Execute $node -Argument ('"'+$root+'\connector\agent.mjs"') -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -AtStartup
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 20 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
# Register under a dedicated local account; credential prompt prevents a password in scripts.
$cred=Get-Credential -Message 'Dedicated connector account with ODBC and folder access'
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Limited
