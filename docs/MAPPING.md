# Crystal SQL mapping and reconciliation
| Source file | Working query | Row grain | Cloud/dashboard use |
|---|---|---|---|
| Transaction Summary.txt | transaction_summary.sql | TRANSACT after joins | Net, tax 1?5, final, transaction count; summary table |
| Sales Transaction detail.txt | transaction_detail.sql | TRANSACT + RECPOS and selected group fields | Transaction line table, staff, product, coupon, type |
| Sales by Product.txt | product.sql | PRODNUM + description | Product quantity and QUAN ? COSTEACH value |
| Sales by Salestype.txt | sales_type.sql | SalesType description | Order type net/tax/final totals |

All original aliases and expressions are retained. Cloud JSONB reports use those aliases verbatim. POSHEADER.STATUS=3 is preserved. Refund detail type 101 is excluded by the supplied detail/product queries; coupon 100 is excluded from product but included in transaction lines. Do not infer a full refund, payment, void, discount total, cost or profit report from these four queries.

Original fixed BETWEEN DateAdd(day,-8,Now()) AND Now() is changed to OPENDATE >= ? AND OPENDATE < ?. Detail gains the same two predicates. Parameters are local midnight and next local midnight; half-open boundaries prevent overlap. No dynamic user SQL enters the API.

Transaction summary employee and sales-type INNER JOINs can omit headers with missing employee/sales-type rows. Detail employee INNER JOIN can omit lines. Product right-outer join can produce unnamed products. These are original semantics; compare with the original reports and investigate differences before changing them. Header net/final are authoritative dashboard KPIs; product value need not equal net due to coupons, refunds, modifiers or source semantics.

Serializable extraction provides a coherent source transaction, but may lock POS tables or fail on deadlocks. Test off-hours and measure impact before 60-second polling. Do not change database isolation settings globally. If using a reporting replica or source snapshot isolation, a DBA must validate consistency and change the transaction appropriately. The connector has a per-command 120-second timeout and overall extraction timeout.

Reconcile per day and per branch:
1. Run the original Crystal report with identical local OPENDATE bounds.
2. Compare header count, each tax component, net and final totals.
3. Compare type totals and product quantity/value separately.
4. Compare transaction line counts and selected transaction/RecPos pairs.
5. Change a closed sale or status in a test database, resync, and verify replacement.
6. Confirm genuinely empty days clear old data. Do not approve production until all differences are explained.

Employee names are uploaded because they are in the supplied reports. Apply appropriate access and retention policies before using live data. No payment-card fields are selected.
