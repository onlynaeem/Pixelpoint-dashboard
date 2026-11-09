param([Parameter(Mandatory=$true)][string]$Day)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
. (Join-Path $PSScriptRoot 'query-owner.ps1')
$owner=$env:PIXELPOINT_SOURCE_OWNER
if([string]::IsNullOrWhiteSpace($owner)){$owner='DBA'}
# Connection string is environment-only. Use a SELECT-only SQL Anywhere account.
$c = New-Object System.Data.Odbc.OdbcConnection($env:PIXELPOINT_ODBC)
try {
 $c.Open()
 $tx = $c.BeginTransaction([System.Data.IsolationLevel]::Serializable)
 try {
  $result = @{}
  $optional=@();$adapterPath=Join-Path $PSScriptRoot '../queries/optional/config.json'
  if(Test-Path -LiteralPath $adapterPath){$adapter=Get-Content -Raw -LiteralPath $adapterPath | ConvertFrom-Json;foreach($name in @($adapter.enabled)){if($name -notin @('payment','category','void','discount')){throw 'Unknown optional report adapter.'};if($optional -contains $name){throw 'Duplicate optional report adapter.'};$optional+= $name}}
  foreach ($report in (@('transaction_summary','transaction_detail','product','sales_type')+$optional)) {
   $cmd=$c.CreateCommand()
   $cmd.Transaction=$tx
   $cmd.CommandTimeout=120
   $queryPath=if($optional -contains $report){Join-Path $PSScriptRoot "../queries/optional/$report.sql"}else{Join-Path $PSScriptRoot "../queries/$report.sql"}
   $sql=Get-Content -Raw -LiteralPath $queryPath
   $cmd.CommandText=Convert-PixelPointQueryOwner -Sql $sql -Owner $owner
   foreach ($date in @([datetime]::ParseExact($Day,'yyyy-MM-dd',$null),[datetime]::ParseExact($Day,'yyyy-MM-dd',$null).AddDays(1))) {
    $p=$cmd.Parameters.Add('date',[System.Data.Odbc.OdbcType]::DateTime)
    $p.Value=$date
   }
   $reader=$cmd.ExecuteReader()
   $rows=New-Object System.Collections.Generic.List[object]
   while($reader.Read()) {
    $row=[ordered]@{}
    for($i=0;$i -lt $reader.FieldCount;$i++) {
     $value=$reader.GetValue($i)
     if($value -is [DBNull]){$value=$null}
     elseif($value -is [datetime]){$value=$value.ToString('yyyy-MM-ddTHH:mm:ss')}
     elseif($value -is [timespan]){$value=$value.ToString('c')}
     $row[$reader.GetName($i)]=$value
    }
    $rows.Add($row)
   }
   $reader.Close()
   $result[$report]=@($rows.ToArray())
  }
  $tx.Commit()
  ConvertTo-Json -InputObject $result -Depth 10 -Compress
 } catch { $tx.Rollback(); throw }
} finally { $c.Dispose() }
