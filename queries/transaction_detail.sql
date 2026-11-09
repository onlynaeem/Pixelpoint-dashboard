SELECT POSHEADER.TRANSACT AS "Transaction #", POSHEADER.OPENDATE AS "Open Date", POSDETAIL.RECPOS AS RecPos, POSDETAIL.TIMEORD AS "Time Ordered", POSDetail_WhoOrder."Emp Full Name (Last First)" AS "Who Ordered", Product.DESCRIPT AS Product, promo.DESCRIPT AS "Discount/Coupon", POSDETAIL.QUAN AS "POSDetail QUAN", Max(Case posdetail.prodtype when 0 then 'Ordering Product' when 1 then 'Option (ie Hold)' when 2 then 'Kitchen Command' when 3 then 'Bussing Command' when 4 then 'Seating Position' when 5 then 'Rated/Hour Product' when 6 then 'Delay Print Command' when 7 then 'Merchandise' when 8 then 'Minimum Charge' when 9 then 'Ticket Number' when 10 then 'Cover Charge' when 11 then 'Recipe Item' when 12 then 'Manual Keyboard' when 14 then 'Return/Exchange' when 100 then 'Coupon' when 101 then 'Refund' else 'Unidentified' end)  AS ProdTypeName, POSDETAIL.COSTEACH AS "Cost Each", (QUAN * COSTEACH) AS Value, POSDETAIL.LineDes AS "Line Description" 
FROM ((((POSHEADER AS POSHEADER
     INNER JOIN POSDETAIL AS POSDETAIL ON (POSHEADER.TRANSACT = POSDETAIL.TRANSACT ))
     INNER JOIN (select emp.empnum, empname + ' ' + emplastname as "Emp Full Name (First Last)", 
emplastname + ' ' + empname  as "Emp Full Name (Last First)",
emp.POSName 
from dba.employee emp) POSDetail_WhoOrder ON (POSDETAIL.WHOORDER = POSDetail_WhoOrder.empnum ))
     LEFT OUTER JOIN Product AS Product ON (POSDETAIL.PRODNUM = Product.PRODNUM ) and (POSDETAIL.PRODTYPE <> 100))
     LEFT OUTER JOIN promo AS promo ON (POSDETAIL.PRODNUM = promo.PROMONUM ) and (POSDETAIL.PRODTYPE = 100))
WHERE
(
  POSHEADER.OPENDATE >= ? AND POSHEADER.OPENDATE < ? AND POSHEADER.STATUS = 3 AND 
  POSDETAIL.PRODTYPE <> 101 )
GROUP BY POSHEADER.TRANSACT, POSHEADER.OPENDATE, POSDETAIL.RECPOS, POSDETAIL.TIMEORD, POSDetail_WhoOrder."Emp Full Name (Last First)", Product.DESCRIPT, promo.DESCRIPT, POSDETAIL.QUAN, POSDETAIL.COSTEACH, POSDETAIL.LineDes
ORDER BY  1, 3
