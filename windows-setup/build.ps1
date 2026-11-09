param(
 [string]$OutputDirectory=(Join-Path $PSScriptRoot '../../outputs')
)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$out=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $out -Force > $null
$stage=Join-Path $out ('setup-stage-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage > $null
# Copy public source only; never package credentials or queued restaurant data.
foreach($name in @('cloud','config','connector','dashboard','db','queries','scripts','tests','windows-setup')){
 Copy-Item -LiteralPath (Join-Path $root $name) -Destination $stage -Recurse
}
foreach($name in @('DSN-CONNECTION-FIX.md','PixelPoint-Connection-Utility.exe','README.md','RELEASE-2.1.0-RC1.md','RELEASE-2.0.0-RC1.md','TEST_RESULTS.md','package.json','Dockerfile','compose.yaml','.env.example','.dockerignore')){
 if(Test-Path -LiteralPath (Join-Path $root $name)){Copy-Item -LiteralPath (Join-Path $root $name) -Destination $stage}
}
$forbidden=@('config/cloud.json','connector/config.json','connector/secrets.json','connector/outbox')
foreach($name in $forbidden){
 $target=[IO.Path]::GetFullPath((Join-Path $stage $name))
 if(!$target.StartsWith($stage+[IO.Path]::DirectorySeparatorChar)){throw 'Invalid staging path'}
 if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target -Recurse -Force}
}
$zip=Join-Path $out 'PixelPointCloud-Setup-Payload.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll (('/resource:'+ $zip+',payload.zip')) (('/out:'+(Join-Path $out 'PixelPointCloud-Setup-2.1.1.exe'))) (Join-Path $PSScriptRoot 'Bootstrap.cs')
if($LASTEXITCODE -ne 0){throw 'Installer compilation failed'}
Write-Host 'Installer created in' $out
# Stage is retained for build verification; no installed application is modified.




