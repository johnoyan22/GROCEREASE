# Batch labelling and View Details pagination

Follow-up on `feature/implementing-changes`. No new schema migration or working-data update is required. Stock amounts, receipt dates, expiry eligibility, reservations, approvals and order transitions retain their existing behavior.

## Display and identity

View Details now uses **Stock Batches**, **Batch No.**, **Remaining Stock**, **Date Received**, **Expiry Date** and **Status**. Quantities include the product selling unit. Five rows are displayed per page, with Previous/Next, a matching-count summary and a page summary.

Saved batch references are not rewritten. Existing readable `B-...` numbers are reused; opaque automatic references have a stable `B-000123` display alias derived from the immutable batch ID. The saved reference remains in Batch details, and picking receives the same display number plus its unchanged saved reference/ID. Page position, sorting and remaining quantities never generate identities.

The default filter includes every batch with remaining physical stock, including expired and on-hold stock. Include empty batches adds depleted rows. Sorting uses known expiry ascending, unknown expiry last, then the unique batch ID. This display filter has no effect on availability or FEFO calculations.

## Read contract

- New authenticated `GET /api/inventory/items/{inventoryId}/batches?page=1&include_empty=0` is restricted to approved Inventory Workers/Supervisors assigned to that active store, including product ownership. Foreign-store IDs return 404. Page and boolean parameters are validated. The page size is fixed at five; a client page-size override is rejected.
- The response contains the selected inventory ID, at most five batches and pagination metadata. Page numbers are clamped to the current last page after counts change. Zero matches returns page 1 of 1 and an empty list.
- The existing inventory endpoint still returns full batch arrays by default for compatibility. Inventory UI hooks now request `include_batches=0`, so opening the workspace does not download every batch. Product totals, expiry and received-date summaries still consider all relevant batches. Opening View Details requests only that product's selected page.
- The modal resets on product/filter changes, cancels obsolete reads and ignores late results. Errors have a retry action; loading/error states disable navigation. The title/Close and pagination stay outside one internally scrolling content area capped at 90% of the viewport. Focus is contained while open, Escape closes it and focus returns to the invoking control.

## Verification

- `php artisan test --compact`: **379 passed, 6,831 assertions** on isolated SQLite memory databases. This includes four pagination integration cases / 455 assertions: all 100 matching batches over 20 pages, expired/held/unknown dates, empty inclusion, changed final-page counts, zero matches, permissions, stable references, unchanged totals and full-list compatibility. Existing checkout/receiving/picking/handover regressions also passed.
- `npm.cmd test`: **117 passed**.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed; the existing main-chunk size advisory remains.
- `npm.cmd run test:stock-browser`: real headless Edge checks with isolated mocked HTTP fixtures at **1440px, 390px and 320px**. Checks cover 100 matching batches / 20 pages, max five rows, empty filtering/reset, another product, count shrinkage, failure/retry, stale-response suppression, unchanged product totals, keyboard focus/Tab/Escape, plus receiving and Supervisor policy regressions. Screenshots are in ignored `tmp/receiving-browser/`.

The browser fixture uses mocked HTTP; backend scope/count/order checks use actual Laravel controllers and isolated databases. No working-database reset, reseed or migration was run.

## Changed files

- Backend: `StoreInventoryController.php`, `InventoryBatch.php`, `BatchStock.php`, `routes/api.php`, `tests/Feature/BatchPaginationTest.php`.
- Frontend: `ProductDetailsModal.jsx` (new), `ProductTable.jsx`, `OrderPreparation.jsx`, `useStoreInventory.js`, `useStoreStock.js`, `services/api.js`, `tests/inventory-api.test.mjs`, `tests/stock-browser-smoke.mjs`.
- This handoff document.

## Manual check

Open View Details for a product with more than five batches. Check the labels, units, Previous/Next and counts. Toggle Include empty batches and confirm page 1. Confirm expired/held batches stay visible, unknown dates are explicit, original saved references remain in Batch details, and product totals do not change when paging. Check another product, keyboard Close/Escape/focus restoration and a narrow mobile viewport. The user subsequently requested commit/push as `Batch labelling`; stop feature work after that delivery.
