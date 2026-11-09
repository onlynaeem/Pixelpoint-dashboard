$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../connector/query-owner.ps1')
foreach($report in @('transaction_summary','transaction_detail','product','sales_type')){
 $sql=Get-Content -Raw (Join-Path $PSScriptRoot "../queries/$report.sql")
 $qualified=Convert-PixelPointQueryOwner -Sql $sql -Owner 'DBA'
 if($qualified -notmatch 'DBA\.POSHEADER AS POSHEADER'){throw "POSHEADER not qualified in $report"}
 if($qualified -match 'DBA\.DBA\.employee'){throw "Double-qualified employee in $report"}
}
try{Convert-PixelPointQueryOwner -Sql 'SELECT 1' -Owner 'bad;DELETE' | Out-Null;throw 'invalid owner was accepted'}catch{if($_.Exception.Message -eq 'invalid owner was accepted'){throw}}
Write-Host 'Four report owner mappings and invalid-owner rejection passed.'

