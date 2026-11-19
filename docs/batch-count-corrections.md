# Batch-specific stock counts — manual-test handoff

Implemented on the existing `feature/implementing-changes` checkout, based on local `fd0b460`.
The checkout was initially clean. It tracks `origin/feature/ai-integration`; no branch was switched,
reset, merged, committed or pushed. No applicable AGENTS.md was found. This document supersedes
the earlier whole-product correction contract in the Feature 5 and receiving handoffs.

## Behavior

- `/inventory/stock-update` keeps its existing navigation and displays **Stock Corrections**:
  one table, 10 recorded batches per server page, product/SKU/stable Batch No. search,
  Product and Stock Condition filters, Clear Filters, Include empty batches and My requests.
  The page does not fetch the inventory index or preload all batches. Product filter options
  contain product metadata only. Default results include physical expired/held stock and exclude zero balances.
- Update Count opens the exact batch with read-only product, SKU, unit, dates, recorded remaining
  and allocated stock. Only Actual Remaining Count and Reason for Correction are editable.
  Zero is accepted; unchanged, negative, fractional and blank-reason requests are rejected.
  Lost-response retries preserve the operation key and payload. Filters survive submission.
- Pending and rejected requests change no quantities. Each batch has at most one pending request,
  enforced by current locking reads and a nullable unique pending-batch slot. Decisions release that
  slot while retaining the original request. A UUID plus payload/actor hash makes identical retries idempotent.
- Supervisor **Stock Approvals > Corrections** and existing worker history show the batch,
  dates, observed/requested remaining count, signed difference, allocations, requester, reason and decisions.
  Legacy aggregate history is explicitly labeled **Historical whole-product correction**.
- Approval changes only the selected batch's `remaining_quantity` and adds the identical difference
  to product physical stock. A=100, B=50 becomes A=100/B=40/total=140; B=45 then gives total=145
  with the same two batches. Original received quantity, receipt approval, reference, dates and condition remain intact.
  Logs link the signed difference to the immutable request evidence, decision actor/reason/time and selected batch.
- Store/actor/original values are server-derived. Writes lock user/assignment/store, inventory,
  selected batch, request and affected reserved allocations. Existing inventory versions detect any intervening
  receipt, reservation, cancellation, handover or correction, including counts that later return to the same number.
  Batch snapshots also detect changed receipt identity, dates, condition and original/remaining quantities.
- Counts below allocated stock are saved as discrepancy evidence and marked reconciliation required.
  Unsafe approval is blocked; no allocations, reservations, orders or payments are rewritten. Product/batch
  total disagreement also blocks approval. Expired/held batches remain ineligible for sale after correction.

## Additive setup

Read-only `migrate:status` on the working database showed the receiving migration already applied
and only `2026_11_17_000001_add_batch_count_corrections` pending. This task **did not apply** it.
Before manual testing, run these non-destructive commands in PowerShell:

```powershell
Set-Location 'D:\Programming\GROCEREASE\GROCEREASE\backend\laravel'
C:\xampp\php\php.exe artisan migrate:status
C:\xampp\php\php.exe artisan migrate --path=database/migrations/2026_11_17_000001_add_batch_count_corrections.php
C:\xampp\php\php.exe artisan migrate:status
```

No seed/reset command is needed. The migration only adds nullable evidence/identity columns,
foreign keys and unique indexes; it does not rewrite existing requests, dates, quantities or logs.
Its rollback deliberately refuses to delete correction evidence.

## Deliberate API changes

- `GET /api/inventory/correction-batches`: assigned-store server search/filter/pagination.
  Parameters: `search` (max 100), `product` (own-store product ID), `condition`
  (`active`, `expired`, `on_hold`, `empty`), `include_empty` (0/1), `page` (positive integer).
  Fixed page size 10, clamped final page, stable inventory-ID/batch-ID ordering, no-store response.
  Choose Include empty batches when filtering for empty batches.
- `POST /api/inventory/items/{item}/stock-adjustments` now requires `inventory_batch_id`,
  `requested_remaining_quantity`, `expected_stock_version`, UUID `operation_id`, and `reason`.
  The selected batch must belong to the route inventory in the authenticated worker's store.
  `requested_hard_stock_qty` is prohibited. New batchless requests receive 422; there is no
  endpoint that still performs arbitrary whole-product redistribution.
- Existing history and decision paths remain. Historical pending aggregate requests may be
  **rejected with a note**, then resubmitted as specific batches; approval returns 409.
  No batch is inferred. Duplicate decisions/stale requests/active conflicts return 409;
  wrong-store records return 404; unauthorized roles and self-approval are denied.

## Verification commands and evidence

All destructive/schema/concurrency QA uses SQLite memory databases or random guarded MariaDB QA
databases, with cleanup. Browser QA uses mocked HTTP and installed headless Edge; no working data is written.

Executed results: **391 Laravel tests passed (7,240 assertions)**; **118 frontend tests passed**;
ESLint, all 14 changed/added PHP syntax checks and the Vite production build passed. Both responsive
browser suites passed at all three widths. All three isolated MariaDB suites passed and removed their
temporary databases/runtime files. `git diff --check` passed. Build's existing main chunk advisory remains
(approximately 666 kB minified). Manual application acceptance has not been claimed.

```powershell
# backend/laravel
C:\xampp\php\php.exe artisan test --compact
node tests/mariadb-correction-smoke.mjs
node tests/mariadb-transaction-smoke.mjs
node tests/mariadb-receiving-smoke.mjs

# frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:corrections-browser
npm.cmd run test:stock-browser
```

The new backend cases cover exact positive/negative/zero/recovered batch counts, unchanged original
receipts, pending/rejected preservation, idempotency, active-request exclusion, version staleness,
changed-and-returned stock, allocated conflicts, approval rechecks, held/expired stock, product and store
ownership, search across multiple pages, filters, empty batches, page clamping and additive legacy preservation.
The existing authorization, self-approval, rollback, audit, policy, checkout, FEFO, cancellation and handover
coverage remains. Old tests expecting automatic batch redistribution were changed to the intentional batch contract.

MariaDB QA races separate worker submissions and Supervisor decisions, then correction approval against
a receipt, checkout reservation and physical handover. It verifies exact batch/physical/reserved totals,
original receiving evidence and stable-number search. It exposed and verified a fix for InnoDB snapshot reads
in the pending-request check. Existing receiving and transaction race suites remain separate.

Responsive browser checks exercise 1440px, 390px and 320px layouts, cross-page search, filters,
empty recovery, modal validation/preview/focus/Close/Cancel/Escape, double-click/retry identity,
pending markers, retained filters, stale responses, errors/retry, empty results and historical review.
Screenshots are under ignored `tmp/batch-correction-browser/` and `tmp/receiving-browser/`.
Desktop table and 320px modal screenshots were visually inspected.

## Limitations and manual checklist

- Manual acceptance against your running application remains to be done after the migration.
- Staleness intentionally uses the existing **product inventory version**, so a change to another batch
  of that product also requires rejection and a fresh count. This is conservative and preserves existing safeguards.
- Reconciliation, batch reassignment and hold management are existing operational boundaries; this feature
  does not automatically cancel/reallocate orders or resolve physical discrepancies below reservations.
- Large tables scroll horizontally on narrow screens; the modal stays inside the viewport and scrolls internally.
- Production build retains the existing main-JavaScript chunk-size advisory.

1. As an assigned Inventory Worker, open Submit Stock Update. Search by product, SKU and a batch
   beyond page 1; change filters, include an empty/unknown-date batch and check Previous/Next.
2. On a QA product with A=100/B=50, select **B**, submit 40 with a reason. Verify pending marker,
   unchanged quantities and retained filters. Check My requests.
3. As the same-store Supervisor, review the batch/dates/50-to-40/-10 evidence, approve once and
   verify A=100/B=40/total=140. Submit/approve B=45; verify total145, still two batches and original receipt unchanged.
4. Reject a new request and verify no stock change. Test zero and empty-batch recovery. Check worker
   approval denial, foreign-store denial, duplicate submission/decision, and rejection of a legacy pending request.
5. In isolated QA, submit below allocations and submit before a new reservation/receipt/handover.
   Verify approval blocks with reconciliation/staleness evidence and leaves all reservations/orders intact.
   Count an expired/held batch and verify it remains unavailable for sale.
6. Repeat modal Close/Cancel/Escape and submission on mobile. Check existing checkout, FEFO preparation,
   cancellation and verified handover behavior.

Stop for manual testing. No subsequent feature, commit, push or merge is part of this task.

## Changed files

Backend:
`app/Http/Controllers/Api/StockAdjustmentController.php`, `app/Services/BatchStock.php`,
`app/Models/StockAdjustment.php`, `app/Models/InventoryBatch.php`, `routes/api.php`,
`database/migrations/2026_11_17_000001_add_batch_count_corrections.php`.

Backend QA:
`tests/Feature/BatchCorrectionTest.php`, `tests/Feature/BatchCorrectionMigrationTest.php`,
`tests/Feature/StockAdjustmentTest.php`, `tests/Feature/StockReceivingTest.php`,
`tests/Feature/CheckoutOrderTest.php`, `tests/Feature/DashboardSummaryTest.php`,
`tests/Feature/ReceivingMigrationTest.php`, `tests/mariadb-correction-smoke.php`,
`tests/mariadb-correction-smoke.mjs`.

Frontend:
`src/pages/inventory/SubmitStockUpdate.jsx`, `src/components/inventory/stock-management/BatchCorrections.jsx`,
`src/components/inventory/stock-management/BatchCountModal.jsx`,
`src/components/inventory/stock-management/StockForms.jsx`,
`src/components/inventory/stock-management/StockWorkspace.jsx`, `src/services/api.js`, `package.json`,
`tests/stock-api.test.mjs`, `tests/batch-correction-browser-smoke.mjs`.

Documentation: this file, `docs/feature-5-stock-management.md`, `docs/product-receiving-batches-handoff.md`.
