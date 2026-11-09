$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
if(!$env:PIXELPOINT_ODBC){throw 'Set the reporting connection environment variable first.'}
$connection=New-Object System.Data.Odbc.OdbcConnection($env:PIXELPOINT_ODBC)
try{
 $connection.Open()
 $tables=$connection.GetSchema('Tables');$columns=$connection.GetSchema('Columns')
 $result=@{tables=@();columns=@();note='Schema metadata only. No sales, customers or credential values are selected.'}
 foreach($row in $tables.Rows){$result.tables+=@{schema=[string]$row.TABLE_SCHEM;name=[string]$row.TABLE_NAME;type=[string]$row.TABLE_TYPE}}
 foreach($row in $columns.Rows){$result.columns+=@{schema=[string]$row.TABLE_SCHEM;table=[string]$row.TABLE_NAME;column=[string]$row.COLUMN_NAME;type=[string]$row.TYPE_NAME;ordinal=[int]$row.ORDINAL_POSITION}}
 ConvertTo-Json -InputObject $result -Depth 8
}catch{throw 'Schema export failed. Verify the reporting connection and metadata permissions.'}finally{$connection.Dispose()}
