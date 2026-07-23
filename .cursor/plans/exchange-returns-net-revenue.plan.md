# Exchange Returns: Keep Net Revenue, Positive-Only Units

## Goal

From **Jul 1 → latest** sales data, handle two return patterns correctly on the Sales Dashboard (and all summarize / rank / voice / chat paths that use the same filter):

| Case | Example | Behavior |
|------|---------|----------|
| Complete cancel (void) | `ST-10292388`: −2150 + +2150, **same SKU** | Drop **both** legs (already works via `dropMatchedSalesReturnPairs`) |
| Exchange | `VR-102291158`: −1199 + +2499, **different SKUs**, same Transaction # | **Keep both** lines so Net Sales = **$1,300**; **units count only positive qty** (= 1) |

Standalone returns (negative qty, no void pair, **no** same-txn positive sibling) stay dropped — sales-only dashboard.

## Decisions (locked)

- Revenue / discounts / cost / salesperson credit: include exchange return lines (negative money pulls net down).
- Units (dashboard aggregates, store units, Top models units): **positive quantity only** when summing units — do not add negative return qty into “units sold”.
- Unique transactions: distinct Transaction # among **kept** rows (void txn with both legs dropped → not counted).

## Implementation

### 1. Change exclusion pipeline in [`src/lib/utils.ts`](src/lib/utils.ts)

Today:

```
SKU/dept exclusions → dropMatchedSalesReturnPairs → dropStandaloneNegativeQtyReturns (all qty < 0)
```

Change `dropStandaloneNegativeQtyReturns` (or replace with a smarter helper) so a negative-qty row is **kept** when the **same Transaction #** still has at least one **sale leg** (positive qty/net) after void-pair removal.

Keep dropping:

- Negative-qty rows with empty / missing transaction id
- Negative-qty rows whose txn has **no** remaining positive sale sibling (true stand-alone returns)

Bump `SALES_EXCLUSION_RULES_VERSION` **7 → 8** so cached sales versions rebuild.

### 2. Positive-only units in aggregates

Where units are summed for dashboard totals / store rankings / product rankings, use `max(0, quantity)` or `quantity > 0 ? quantity : 0` so exchange returns do not reduce unit counts.

Primary touchpoints:

- [`src/lib/reports/vendor-pos.ts`](src/lib/reports/vendor-pos.ts) — `totalUnits`, store/dept/design/class rankings
- [`src/lib/sales/sales-aggregate.ts`](src/lib/sales/sales-aggregate.ts) — `summarizeRows` / `groupRows` units
- Rank-detail / salesperson paths if they sum raw `quantity`

Net revenue continues to use signed `netRevenue` (includes negatives).

### 3. Docs + tests

- Update [`.cursor/rules/sales-report.mdc`](.cursor/rules/sales-report.mdc): document exchange keep + stand-alone drop + positive-only units.
- Extend [`tests/sales/return-pairs.test.ts`](tests/sales/return-pairs.test.ts):
  - Void `ST`-style: both dropped, net 0
  - Exchange `VR`-style: both kept, net ≈ 1300, filter keeps 2 rows
  - Stand-alone negative still dropped
- Add aggregate assertion: units for exchange fixture = **1**, not 0

### 4. Refresh live Jul 1–latest data

After code change:

- Force sales refresh (`refreshSalesData({ force: true })`) so exclusion version 8 rebuilds normalized rows from the current live report (already includes Jul 1–22+).
- Sanity-check known txns against CSV:
  - `ST-10292388` → absent from totals
  - `VR-102291158` → contributes **+$1,300** net, **1** unit toward unit sums, **1** unique txn

## Out of scope

- Dual-path “Excel includes ITEM/MLB” behavior
- Re-showing Profit Margin UI
- Changing unique-transaction card back to Units Sold as the headline metric

## Accuracy checklist

- Void pairs still require same store + same abs amount + same SKU/model (existing matcher)
- Exchanges are identified only by “negative kept when same txn has a sale sibling,” not by inventing pairs across SKUs
- No double-count: void matcher still runs **before** stand-alone logic
- Cache bump guarantees Jul 1–latest rebuild, not stale v7 rows
