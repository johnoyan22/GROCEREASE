# Feature 5: Store stock corrections, reporting, and policies

Implemented October 19, 2026 on `feature/multi-store-foundation`.
Automated readiness and browser acceptance are separate. Browser acceptance is pending.

## Confirmed accounting

- `hard_stock_qty`: all physical on-hand units, including reserved units.
- `soft_stock_qty`: submitted-order reservations, not cart quantities.
- Available = physical − reserved. Both counts must be nonnegative; reserved cannot exceed physical.
- Initial corrections set a new absolute physical count. They do not add a delta or change reservations.
- Pending/rejected requests leave inventory unchanged. Approval applies once, under transaction locks.
- Every request captures the physical count, reserved count, and stock version at submission.
- A changed count, reservation, or version prevents approval of an old request, even if counts later return to their original values.
- A count below reserved units requires a separate reconciliation workflow, which is not implemented here.
- A product's maximum units per order and low-stock threshold are optional Supervisor settings.
  Blank removes a setting; no numeric default is invented. Low stock means available ≤ configured threshold.
- A low-stock report is an observation. It never receives a fake approval or increases stock.

## Database changes and working-database evidence

New additive migrations:

1. `2026_10_19_000007_create_stock_reporting_tables.php`: availability logs, low-stock reports,
   and the composite inventory identity index used to enforce store ownership.
2. `2026_10_19_000008_create_stock_adjustments_and_policies.php`: stock version, optional maximum-per-order
   and threshold fields, stock adjustments, policy logs, and reserved ≤ physical enforcement.

The user explicitly approved both migrations. Both applied successfully to local MariaDB.
Before/after counts and SHA-256 snapshots matched for existing stores, products, users, profiles,
roles, staff placements, and all original inventory fields. The four new tables had zero rows afterward.
No records were seeded, no existing counts were changed, and no staff placement was changed.
Historical migrations were not edited. SQLite tests use triggers for the reservation invariant;
MariaDB uses a CHECK constraint. The migration refuses existing reserved-over-physical data instead of repairing it silently.

## API and permissions

All paths below begin `/api`. Sanctum sessions and CSRF protection are preserved.

| Method/path | Allowed role | Input / behavior |
|---|---|---|
| GET `/inventory/items` | Inventory Worker, Supervisor | Own-store physical/reserved/available counts, policies and low-stock flag |
| GET `/inventory/stock-adjustments` | Both staff roles | Own-store request and decision history |
| POST `/inventory/items/{item}/stock-adjustments` | Inventory Worker | `requested_hard_stock_qty`, `expected_stock_version`, `reason` |
| PUT `/supervisor/stock-adjustments/{id}/decision` | Supervisor | `decision`: approved/rejected; `decision_note` required for rejection |
| PUT `/supervisor/inventory/items/{item}/policy` | Supervisor | `max_per_order`, `low_stock_threshold`; nullable to remove |
| GET `/inventory/low-stock-reports` | Both staff roles | Own-store reports and observed quantity snapshots |
| POST `/inventory/items/{item}/low-stock-reports` | Inventory Worker | `note` only |
| GET `/inventory/availability-history` | Both staff roles | Persistent initial status and actual status changes |

Store and actor come from the authenticated account and its current placement, under locks.
Unapproved, unassigned, or inactive-store staff are denied. Foreign records return 404.
Repeat decisions and stale corrections return 409. Self-approval is denied if a requester is later promoted.
Normal catalog edits cannot override quantities, policies, version, ownership, or actor.
Availability audit failure rolls back the associated product/price/status edits.
Policy changes have immutable before/after audit rows; unchanged settings do not create duplicate rows.
There are no request/history update or deletion APIs.

## Connected React screens

- `/inventory/stock`: real quantities and links to corrections/reports.
- `/inventory/stock-update`: real physical-count request form and persistent request history.
- `/inventory/verifications`: persistent correction/decision history.
- `/inventory/low-stock`: threshold-based product list, report form, and report history.
- `/inventory/activity`: actual availability history; no fabricated past activity or IP addresses.
- `/supervisor/stock-approvals`: corrections, reports, quantity limits/thresholds, availability history.

`StockWorkspace.jsx` is shared by these stock screens; `StockForms.jsx` holds the four small forms.
`useStoreStock.js` loads the actual API data, cancels obsolete reads, and refuses to combine responses
from different stores if a placement changes during loading. Forms block duplicate submissions.
The in-memory stock actions were removed from `SupervisorContext.jsx`; other prototype modules remain separate.

## Automated evidence

- `StockReportingTest`: 14 tests, 260 assertions.
- `StockAdjustmentTest`: 20 tests, 369 assertions.
- Full Laravel milestone run: 214 tests passed, 3,105 assertions, zero failures.
- New `stock-api.test.mjs`: 9 tests passed. Combined existing/new API client tests: 44 passed.
- Focused ESLint and Vite production build passed.

Tests cover Store A/B isolation; guest and role restrictions; current approval/placement;
inactive stores; pending/rejection preservation; repeated decisions; stale physical/reserved/version changes;
competing requests; below-reservation counts; policy validation; server-owned metadata; and transactional rollback.
These are SQLite integration and mocked HTTP client tests, not browser acceptance or a MariaDB concurrency stress test.

## Exact browser acceptance

Use approved Inventory Worker and Supervisor accounts assigned to test Store A, and a Supervisor assigned to test Store B.
Use separate browser profiles or sign out before changing accounts. Start the Laravel server and Vite normally.

1. **Inventory Worker A → Product Management**: create a test product with unique SKU `STOCK-TEST-001`,
   a valid price and active status. Expect physical 0, reserved 0, available 0. Refresh; it persists.
2. **Inventory Worker A → Submit Stock Update**: select it, request physical count 10, enter a reason.
   Expect pending request and unchanged stock. Record its displayed request ID.
3. **Supervisor A → Stock Approvals → Corrections**: inspect observed and requested counts, then approve.
   Expect approved history and physical 10, reserved 0, available 10 after refresh in both accounts.
4. **Repeat decision**: the completed request has no decision buttons. Repeating its PUT API request
   using browser Network replay or the console helper below must return 409 and leave stock 10.
5. **Rejection**: Worker A requests count 8. Supervisor A rejects with a reason. Expect rejected history;
   the count remains 10 after refresh. Rejection without a reason returns 422.
6. **Stale requests**: Worker A submits counts 12 and 14 against the same snapshot. Approve count 12.
   Refresh: count 14 is marked stale and cannot be approved. Its API approval returns 409.
   Reject the stale request and ask the worker to count again.
7. **Policies**: Supervisor A selects the product under Quantity limits & thresholds. Set max/order 4 and
   threshold equal to its available stock. Save and refresh. Worker A's Low Stock page must flag it at equality.
   Invalid max/order 0 or threshold −1 returns 422 and preserves the saved settings.
8. **Reporting**: Worker A submits an observation from Low Stock. Supervisor A sees it under Low stock.
   Refresh both pages: report persists; quantities remain unchanged. No approval step is presented for the report.
9. **Availability**: Worker A deactivates then reactivates the product in Product Management.
   Activity Log shows actual actor, time, and transitions. A price-only change creates no availability row.
10. **Isolation**: Supervisor B sees only B's requests/reports/history/products. Replaying A's decision or policy
    request as B returns 404. Supplying a different store/actor in a request returns 422.
11. **Access regression**: an unapproved/unassigned staff account gets 403. Admin deactivation of the test
    store blocks its staff operations; reactivation restores access and preserves history/counts.
12. **Reserved-stock protection**: automated tests cover a count below outstanding reservations.
    Repeat through the browser once real checkout creates reservations; do not alter working counts with SQL.

Optional browser-console helper, while signed in to the intended account:

```javascript
window.stockCheck = async function (path, body) {
  await fetch('http://localhost:8000/sanctum/csrf-cookie', { credentials: 'include' });
  const cookie = document.cookie.split('; ').find(function (value) { return value.startsWith('XSRF-TOKEN='); });
  const response = await fetch('http://localhost:8000/api' + path, {
    method: 'PUT', credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json',
      'X-XSRF-TOKEN': decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) },
    body: JSON.stringify(body),
  });
  console.log(response.status, await response.json());
};
// Replace 123 with the request ID you recorded:
await stockCheck('/supervisor/stock-adjustments/123/decision', { decision: 'approved' });
```

## Boundaries and next dependency

Cart operations do not reserve stock. Checkout must revalidate policy and availability under the same
store/inventory locks, increment reserved units and stock version, and leave physical stock unchanged.
Fulfillment/cancellation must use atomic, idempotent stock movements. Receiving/damage/reconciliation
workflows, automatic messages, and pickup/payment completion are not silently implemented as stock corrections.
AI code, credentials/roles for pickers, owner functionality, and profile enhancements remain untouched.

See `transaction-sprint-study-guide.md` for the execution flow and defense questions.
