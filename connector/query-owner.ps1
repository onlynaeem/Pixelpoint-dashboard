function Convert-PixelPointQueryOwner {
 param([Parameter(Mandatory=$true)][string]$Sql,[Parameter(Mandatory=$true)][string]$Owner)
 if($Owner -notmatch '^[A-Za-z_][A-Za-z0-9_]*$'){throw 'Source owner must be a simple SQL identifier.'}
 $pattern='(?<![\w.])\b(POSHEADER|POSDETAIL|Product|promo|SalesType|TABLESETUP|Sections)\s+AS\s+\1\b'
 $qualified=[regex]::Replace($Sql,$pattern,{param($m) $Owner+'.'+$m.Value},[Text.RegularExpressions.RegexOptions]::IgnoreCase)
 return [regex]::Replace($qualified,'(?i)\bDBA\.employee\b',($Owner+'.employee'))
}

