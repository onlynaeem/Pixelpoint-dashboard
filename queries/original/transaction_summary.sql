SELECT POSHEADER.TRANSACT AS "Transaction #", POSHEADER.OPENDATE AS "Open Date", SalesType.DESCRIPT AS "Sales Type", Sections.DESCRIPT AS "Table Section", TABLESETUP.TABLENUM AS "Table #", POSHEADER.TIMESTART AS "Time Start", POSHeader_WhoStart."Emp Full Name (Last First)" AS "Who Start", POSHEADER.TIMEEND AS "Time Close", POSHeader_WhoClose."Emp Full Name (Last First)" AS "Who Close", POSHEADER.NETTOTAL AS "Net Total", POSHEADER.TAX1 AS Tax1, POSHEADER.TAX2 AS Tax2, POSHEADER.TAX3 AS Tax3, POSHEADER.TAX4 AS Tax4, POSHEADER.TAX5 AS Tax5, POSHEADER.FINALTOTAL AS "Final Total" 
FROM (((((POSHEADER AS POSHEADER
     INNER JOIN SalesType AS SalesType ON (POSHEADER.SALETYPEINDEX = SalesType.SALETYPEINDEX ))
     LEFT OUTER JOIN TABLESETUP AS TABLESETUP ON (POSHEADER.TABLENUM = TABLESETUP.TABLENUM ))
     LEFT OUTER JOIN Sections AS Sections ON (TABLESETUP.SECNUM = Sections.SECNUM ))
     INNER JOIN (select emp.empnum, empname + ' ' + emplastname as "Emp Full Name (First Last)", 
emplastname + ' ' + empname  as "Emp Full Name (Last First)" ,
emp.POSName 
from dba.employee emp) POSHeader_WhoStart ON (POSHEADER.WHOSTART = POSHeader_WhoStart.empnum ))
     INNER JOIN (select emp.empnum, empname + ' ' + emplastname as "Emp Full Name (First Last)", 
emplastname + ' ' + empname  as "Emp Full Name (Last First)",
emp.POSName   
from dba.employee emp) POSHeader_WhoClose ON (POSHEADER.WHOCLOSE = POSHeader_WhoClose.empnum ))
WHERE
(
  POSHEADER.OPENDATE BETWEEN DateAdd(day,-8,Now()) AND Now() AND 
  POSHEADER.STATUS = 3 )
ORDER BY  1
