# Optional report adapter contract

The adapter mechanism is implemented; source-specific SQL is intentionally not fabricated. Use a SELECT-only database account and have the PixelPoint database administrator approve each query. These are trusted local deployment files, not an API for executing customer-supplied SQL.

Place payment.sql, category.sql, void.sql or discount.sql in this folder. Add its report name to config.json enabled only after validating it against the source. Each query must use exactly two positional ODBC parameters for inclusive day-start and exclusive next-day-start, matching the existing OPENDATE convention. They execute in the same source transaction as the four core queries and use the existing query-owner qualification function. A missing enabled query fails the snapshot; it is not treated as zero sales. Keep disabled reports absent, not empty arrays, until genuinely supported.

| Adapter | Required result aliases |
| --- | --- |
| payment | Transaction #, Payment Type, Amount |
| category | Category, Quantity, Value |
| void | Transaction #, Product, Employee, Reason, Quantity, Void amount |
| discount | Transaction #, Employee, Reason, Discount amount |

Payments must represent settled tender allocation and reconcile with header gross, including split payments. Discounts must be applied amounts, not merely coupon lines. Voids require their actual source lifecycle/filter; closed-sale-only SQL cannot establish them. Product category Value semantics must be documented. Refund integration still requires an agreed source contract and report definition. Empty rows must mean a verified empty result for that report/date.

Never enable an adapter based only on synthetic rows. Actual source tables, status codes and Crystal acceptance are still required.
