# Product registration and receiving handoff

November 17 update: the receiving migration is now applied in the working database. The
[batch-count correction handoff](batch-count-corrections.md) supersedes the original whole-product
correction behavior and supplies the additional pending migration and current manual checks.

Implemented on `feature/implementing-changes`. The repository was clean at inspection; no applicable AGENTS.md was found. The working database was inspected with `migrate:status` only. Its earlier migrations are applied; the receiving migration below is pending. No working data was reseeded or reset, and no branch was merged or pushed.

## Workflow

1. Inventory Worker registers a product at zero physical/reserved stock. Package amount and mg/g/kg/mL/L describe one whole piece/bottle/can/pack/bag. Both size fields may be cleared for count-only products. Barcode remains separate.
2. A database sequence allocates a compact SKU, for example `GE-S001-P000001`. It does not calculate MAX+1. The existing store/SKU unique constraint remains enforced. Existing identifiers are retained, including identifiers matching the new format; the allocator skips those. API overrides are rejected and normal model updates cannot change SKU.
3. **ADD STOCK** is in the Stock Management filter toolbar beside Refresh, in the former Export position. Product Management keeps its Add New Product action. Choose an existing product, enter additional whole selling units, receipt date, optional expiry and Description, then Submit for Approval. Receipt date defaults to today's Asia/Manila date. One submission covers one receipt/expiry group.
4. Supervisor opens the existing **Stock Approvals → Stock additions** tab. Pending/rejected additions leave stock unchanged. Approval atomically creates one referenced batch and adds the quantity once. Request identity, locked store/receipt/inventory rows and a unique receipt/batch relationship protect retries and duplicate decisions. Rejections retain their reason and actor/time.
5. Product rows show physical/eligible available stock, Re-order Level, **Expiry** (the nearest eligible expiry) and status. Stock Management also shows **Date Received**, using the receipt date(s) of the batch(es) matching that displayed expiry. Unknown dates stay explicit. **View Details** holds the compact batch list, original quantities and descriptions. Supervisor can edit the existing policy from details or the existing policy tab. Inventory Workers can view it. Blank and zero remain distinct; the maximum-per-order field remains separate.
6. Checkout reserves concrete batches in earliest-known-expiry order, followed by unknown-expiry stock. Preparation shows the allocated references and quantities. Picking does not deduct physical stock. Verified, paid handover rechecks eligibility and deducts physical/batch balances once. Cancellation and existing reservation-release paths release allocations. Count corrections retain their approval/staleness/audit workflow and now update one explicitly selected batch with correction logs.

## Preservation and explicit date policy

- Old free-text sizes and unknown selling units are not parsed or converted. The form requires explicit replacement of an uncertain old size and confirmation of an unconfigured selling unit.
- Existing quantities become historical batches with **null** receipt/expiry dates. No receipt, expiry or manufacture dates are invented. Existing prices, timestamps, IDs, order snapshots and reservations are preserved. New order lines also snapshot their selling unit.
- Unknown expiry remains explicitly eligible, after dated eligible batches. Known expiry is valid through its Asia/Manila calendar date. Expired/on-hold batches remain physical stock but are excluded from available stock, checkout, picking and handover.
- If an allocated batch expires or is put on hold after checkout, preparation/release fails safely and its reservation stays recorded for reconciliation. This feature does not add a batch-reassignment or hold-management workspace.
- Count corrections now target one recorded batch for either sign of change. They retain its dates, original received quantity and condition; they never create undated stock or choose other batches by expiry. See the batch-count correction handoff above.

## Non-destructive setup

From PowerShell, apply only this additive migration to the existing configured database:

```powershell
Set-Location 'D:\Programming\GROCEREASE\GROCEREASE\backend\laravel'
php artisan migrate:status
php artisan migrate --path=database/migrations/2026_11_16_000001_add_product_receiving_and_batches.php
php artisan migrate:status
```

No seeder is needed. The migration is forward-only because dropping receiving history would lose data. The migration has **not** been applied to the working database by this task.

Existing backend dependencies were available. Start the backend normally if it is not already running:

```powershell
php artisan serve --host=127.0.0.1 --port=8000
```

For the frontend, use the installed dependencies, or `npm.cmd ci` on a clean checkout with registry access:

```powershell
Set-Location 'D:\Programming\GROCEREASE\GROCEREASE\frontend'
npm.cmd run dev -- --host localhost
```

PowerShell blocks npm.ps1 on this machine, so the commands use npm.cmd. A clean dependency installation was not verified: an offline lockfile-refresh attempt lacked an optional Tailwind package in the cache. Tests/build used the installed dependencies. Playwright and its lockfile entries are included for the repeatable browser checks.

## Verification

The checks below use isolated SQLite memory databases, random temporary MariaDB test databases or mocked browser HTTP responses. They do not modify the working database.

```powershell
# From backend/laravel:
php artisan test --compact
node tests/mariadb-transaction-smoke.mjs
node tests/mariadb-receiving-smoke.mjs

# From frontend:
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:stock-browser
```

The browser smoke runner uses installed Microsoft Edge headlessly by default. Set `QA_BROWSER_CHANNEL=chrome` to use installed Chrome instead. It writes screenshots under ignored `tmp/receiving-browser/` and shuts down its own browser/server. Both MariaDB scripts create and drop only their fixed test-prefixed database with a validated random suffix; their configured DB account needs test-database creation permission.

Verified Coke/water scenario:

| Stage | Coke | Nature Spring |
|---|---|---|
| Registration | 1.5 L, bottle, unique automatic SKU, zero stock | 500 mL, bottle, different SKU, zero stock |
| Approved receipts | 100 expiring 2027-12-31 + 50 expiring 2028-12-31 | 100 expiring 2028-12-31 |
| Before pickups | 150 physical, 2 batches, nearest expiry 2027-12-31 | 100 physical, 1 batch |
| Pickups | Three orders of 50, 50 and 30; max/order remains 50 | Unchanged |
| After handovers | First batch 0; second batch 20; physical 20; reserved 0; low stock at level 20 | Physical 100; reserved 0 |

Actual final results:

- Full Laravel suite: **375 passed, 6,376 assertions**. The focused receiving suite has 17 cases / 327 assertions, including the full Coke/water pickup example, all measurement units, invalid data, idempotency, current permissions, rollback, legacy preservation and expiry at checkout/picking/handover.
- Frontend suite: **115 passed**, including receipt transport and existing shopper/cart/checkout/staff/pickup regressions.
- ESLint: passed across the frontend. PHP syntax: passed for all 27 changed/new PHP files. `git diff --check`: passed.
- Production Vite build: passed. Its existing over-500-kB chunk advisory remains (approximately 651 kB main JavaScript before gzip).
- Isolated MariaDB transaction smoke: migrations and competing checkout reservations, worker assignment and duplicate handover passed.
- Isolated MariaDB receiving smoke: eight concurrent product creations produced distinct SKUs; concurrent duplicate submissions produced one receipt; concurrent decisions produced one approval, one batch and exactly 100 added units. Both temporary databases and their runtime state files were removed by the runners.
- Real headless Edge/Chromium checks: **1440px, 390px and 320px passed**. Product measurements/generated/read-only SKU, receiving, double-click protection, a lost-response retry with identical identity/payload, batch details, seven-column product table and eight-column stock table, Supervisor policy preservation and approval all passed. No page errors or unexpected HTTP calls occurred. Dialogs stayed inside their viewports; horizontal table scrolling stayed inside the table container. Representative screenshots were visually inspected.
- Migration preservation test: pre-existing product/inventory/order/item values, uncertain size, SKU, prices, timestamps and active reservation stayed intact; historical batch dates remained null.

Browser HTTP calls are mocked; the browser run is not a live-account end-to-end acceptance test. The exact Coke/water lifecycle runs through actual Laravel HTTP controllers against an isolated SQLite database, and the concurrency smoke tests use real MariaDB processes. Manual testing with your own accounts and working data remains the next step after applying the migration.

## Short manual checklist

1. Apply the migration above, then sign in as an assigned-store Inventory Worker. Confirm existing SKUs, sizes, quantities and prices are intact. Create Coke and Nature Spring with the measurements above; confirm zero initial stock, different read-only SKUs and separate manufacturer barcodes.
2. Check mg/g/kg/mL/L, count-only size and all selling-unit options. Reject zero/negative package amounts, fractional stock quantities, impossible dates, future receipts and expiry before receipt. Leave expiry blank on a genuine unknown/not-applicable receipt.
3. Supervisor sets Coke Re-order Level to 20 while retaining the existing order limit. Worker submits the three deliveries above, using valid receipt dates and distinct Descriptions. Verify pending/rejected additions do not change stock, then approve the intended receipts. Retrying the same submission/decision must not add stock twice.
4. Confirm two product rows, Coke 150 in two batches, water 100 in one batch, unchanged Coke SKU, preserved receipt dates/descriptions and nearest Coke expiry 2027-12-31. Open compact details on desktop and mobile.
5. Complete eligible Coke pickups totaling 130 while respecting the store's existing per-order/payment limits. Follow the references shown in preparation. Verify no physical deduction during preparation, then 100 consumed from the first batch and 30 from the second at handover; final Coke 20, no stray reservations, low-stock flag on, water unchanged.
6. Confirm workers cannot edit Re-order Levels or approve additions, and foreign-store staff cannot access these records. Check existing correction, cancellation, checkout and handover flows. Verify expired/on-hold stock is excluded using isolated QA fixtures, without altering real historical dates.

Stop here for manual testing. No subsequent feature is part of this handoff.

## Changed files

```text
.gitignore
backend/laravel/app/Http/Controllers/Api/CheckoutController.php
backend/laravel/app/Http/Controllers/Api/DashboardController.php
backend/laravel/app/Http/Controllers/Api/OrderController.php
backend/laravel/app/Http/Controllers/Api/OrderResolutionController.php
backend/laravel/app/Http/Controllers/Api/PickupController.php
backend/laravel/app/Http/Controllers/Api/StockAdjustmentController.php
backend/laravel/app/Http/Controllers/Api/StockReceiptController.php
backend/laravel/app/Http/Controllers/Api/StoreInventoryController.php
backend/laravel/app/Http/Controllers/Api/WorkerAssignmentController.php
backend/laravel/app/Models/Concerns/HasReceiptDates.php
backend/laravel/app/Models/InventoryBatch.php
backend/laravel/app/Models/OrderItem.php
backend/laravel/app/Models/Product.php
backend/laravel/app/Models/StockReceipt.php
backend/laravel/app/Models/StoreInventory.php
backend/laravel/app/Services/AiRecommendation/RecommendationEngine.php
backend/laravel/app/Services/BatchStock.php
backend/laravel/app/Services/CheckoutPricing.php
backend/laravel/app/Services/OrderData.php
backend/laravel/app/Services/PaymentCheckout.php
backend/laravel/database/migrations/2026_11_16_000001_add_product_receiving_and_batches.php
backend/laravel/routes/api.php
backend/laravel/tests/Feature/ReceivingMigrationTest.php
backend/laravel/tests/Feature/StockReceivingTest.php
backend/laravel/tests/Feature/StockReportingTest.php
backend/laravel/tests/Feature/StoreInventoryApiTest.php
backend/laravel/tests/mariadb-receiving-smoke.mjs
backend/laravel/tests/mariadb-receiving-smoke.php
docs/product-receiving-batches-handoff.md
frontend/package.json
frontend/package-lock.json
frontend/src/components/inventory/dashboard/InventorySummary.jsx
frontend/src/components/inventory/dashboard/PendingTasks.jsx
frontend/src/components/inventory/product-management/ProductFormModal.jsx
frontend/src/components/inventory/product-management/ProductTable.jsx
frontend/src/components/inventory/stock-management/StockForms.jsx
frontend/src/components/inventory/stock-management/StockReceiptModal.jsx
frontend/src/components/inventory/stock-management/StockReceipts.jsx
frontend/src/components/inventory/stock-management/StockTable.jsx
frontend/src/components/inventory/stock-management/StockWorkspace.jsx
frontend/src/components/orders/OrderPreparation.jsx
frontend/src/components/Supervisor/SupervisorInventory.jsx
frontend/src/hooks/useStoreStock.js
frontend/src/pages/inventory/ProductManagement.jsx
frontend/src/pages/inventory/StockManagement.jsx
frontend/src/services/api.js
frontend/src/services/product-units.js
frontend/tests/inventory-api.test.mjs
frontend/tests/stock-api.test.mjs
frontend/tests/stock-browser-smoke.mjs
```
