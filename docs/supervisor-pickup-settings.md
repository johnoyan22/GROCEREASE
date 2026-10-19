# Supervisor-owned pickup settings: implementation and acceptance

Date: October 19, 2026 (Asia/Manila).
Reviewed local branch: feature/multi-store-foundation, starting at 15b3e4c with a clean working tree.
This report records the pickup-settings implementation and verification on this branch. Consult Git history for the publication commit. Migration 000014 was applied to local MariaDB with explicit user approval; its preservation verification is recorded below.

## Result and official modules

Supervisor → System Configuration now contains the backend-connected "Store Operating Hours & Pickup Scheduling" section. The approved, currently assigned Supervisor edits their active store only. There is no store selector or frontend-authoritative store ID.

Admin → Store Management → View pickup settings is read-only oversight of the same values, suspension records, affected orders and schedule-change audit. Store creation, staff/store assignment, platform COP restrictions and strike correction remain unchanged. There was no separately authorized emergency-override workflow to preserve; no new override bypass was invented.

This supports Checkout and Cart Processing, Cash on Pickup Management, Order Tracking and Status Monitoring, and Pickup Verification Management. It does not automatically earn another completed module-role point. The conservative audit remains 3/40 pending full acceptance.

The existing StorePickupSettings component, stores record, store_schedule_logs, store_pickup_exceptions, StoreStaffAccess and order-rescheduling flow are reused. No duplicate settings table or second rescheduling system was created.

## Behavior and existing orders

- Store operating hours and pickup-service hours are separate seven-weekday maps. Each weekday has one same-day interval or is closed.
- Pickup service must fall entirely within the operating interval. A closed store cannot offer pickup.
- Suspension dates require a reason and preserve the recording Supervisor and time.
- Holding is explicitly 24, 48 or not configured. No default duration is selected.
- All schedule inputs/displays use Asia/Manila; stored order dates and audit timestamps are unambiguous UTC.
- Existing stores with null separate pickup hours continue to use their already configured operating hours as effective pickup hours until a Supervisor explicitly saves separate hours.
- Shopper availability displays both ranges and an earliest future start for today. Invalid, suspended, past and elapsed dates/windows cannot pass server Checkout validation.
- The COP deadline remains the saved STORE closing time, even when pickup service ends earlier. Ending the selected window never creates a strike. Late claiming still needs permitted pickup service to be open.
- Hour changes flag active orders on affected weekdays for review; suspension dates flag orders on that date. Saved windows, claim deadlines, credentials, payment and reserved stock are not silently rewritten.
- Flagged orders cannot be released or made Ready without review. Their credential is withheld from the Shopper while review is pending. The deadline processor suppresses automatic unpaid COP strikes for flagged orders.
- Supervisor uses the existing Orders → Schedule / unclaimed-order review form, with a reason, to approve a still-valid original window or a new valid window before the original claim deadline. Ready orders get a replacement QR/PIN and the old code is revoked.
- Each actual reschedule has an audit record and a uniquely keyed Shopper notification. Even two changes in the same second do not lose a notification.
- Ordinary rescheduling refuses expired, completed, struck or already claimant-verified orders. Those cases require authorized reconciliation; it cannot bypass an issued strike.
- Already-issued paid holding deadlines are preserved when settings change. Paid expiry preserves payment/reservations and never creates a COP strike.
- The mock Supervisor configuration and its four-order/automatic-assignment options were removed. Delegation remains manual, one active order per non-login worker.

## API changes

All paths start with /api. Sanctum/CSRF remain in use.

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /supervisor/pickup-settings | Resolve current approved Supervisor assignment; return own settings, suspensions, affected orders and audit |
| PUT | /supervisor/pickup-settings | Validate/persist operating_hours, pickup_service_hours and paid_order_holding_hours; actor/store resolved server-side |
| POST | /supervisor/pickup-closures | Record own-store date and required reason; flag affected orders and audit |
| GET | /supervisor/pickup-hours?date=YYYY-MM-DD | Own-store future availability for the existing reschedule form; no store ID accepted |
| GET | /admin/stores/{store}/pickup-settings | Retained as read-only platform oversight, now including pickup service, affected orders and audit |
| GET | /shopper/stores/{store}/pickup-hours?date=YYYY-MM-DD | Existing Shopper endpoint now exposes actual pickup-service range, store range and earliest future start |
| PUT | /supervisor/orders/{order}/pickup-schedule | Existing endpoint; now clears an authorized review flag and explicitly rejects expired/struck orders |

Removed ordinary Admin mutations: PUT /admin/stores/{store}/pickup-settings and POST /admin/stores/{store}/pickup-closures. The former returns 405 because its read route remains; the removed closure route returns 404. Supervisor/Shopper/Inventory Worker cannot acquire editing rights through Admin routes.

Staff cannot submit arbitrary store or audit-actor overrides. The approved account, current placement and active store are checked inside each Supervisor transaction.

## Approved migration application record

Applied to the working grocerease MariaDB database on October 19, 2026, following explicit user approval:

    2026_10_19_000014_add_pickup_service_hours_and_schedule_review.php

It adds only:

- Nullable JSON stores.pickup_service_hours.
- Boolean orders.pickup_schedule_review_required, default false.

No seeds, duplicate settings table, backfilled opening/closing time, approved-order deadline rewrite, stock movement or staff/account change is included. Applied historical migrations are untouched.

The approved application ran only this exact path from backend/laravel:

    php artisan migrate --path=database/migrations/2026_10_19_000014_add_pickup_service_hours_and_schedule_review.php

Before/after checks matched record counts and SHA-256 hashes of the original columns across all 28 existing business tables. Both stores were preserved, and the existing order count remained zero. The new pickup-service-hours values are null; the review flag has its false default. Exactly one migration record was added, with all previous migration records unchanged. No seeds, setting edits, stock movements or staff/account changes ran. The temporary verification script and hash/count snapshot were removed afterward.

The working schema is ready for Supervisor browser testing. Do not run migrate:fresh or roll back working data.

## Verification

- Full Laravel: 305 passed, 4,813 assertions, zero failures.
- SupervisorPickupSettingsTest: 17 new cases, covering ownership/roles/current approval and placement, Admin oversight, interval validation, suspension, future availability, late COP pickup, closing cutoff, unchanged existing order values, authorized review/code replacement and protected paid expiry.
- Existing PickupSchedulingCopTest updated for Supervisor operational ownership; the COP warning/30-day/permanent restriction and holding regressions remain covered.
- All Node API/cart/window tests: 86 passed, zero failures.
- All 13 changed frontend JS/JSX/MJS files passed ESLint without warnings.
- Vite production build passed. Existing >500 kB chunk warning remains (652.38 kB JS; 169.53 kB gzip).
- Isolated MariaDB harness applied all migrations, including 000014, to a guarded temporary test database and passed the three actual concurrent reservation/worker-assignment/handover scenarios. The test database/runtime file were removed.
- No browser acceptance is claimed from these automated results.

Commands from backend/laravel:

    C:\xampp\php\php.exe artisan test
    C:\Progra~1\nodejs\node.exe tests/mariadb-transaction-smoke.mjs

Commands from frontend:

    node --test tests/admin-staff-api.test.mjs tests/admin-stores-api.test.mjs tests/inventory-api.test.mjs tests/supervisor-staff-api.test.mjs tests/stock-api.test.mjs tests/shopper-cart.test.mjs tests/checkout-orders.test.mjs tests/store-workers.test.mjs tests/pickup-api.test.mjs tests/transaction-workflow-api.test.mjs tests/pickup-scheduling.test.mjs
    node node_modules/vite/bin/vite.js build

ESLint was run against all changed frontend source/test files. git diff --check and untracked-file whitespace checks were also run before handoff.

## Manual browser acceptance, migration now applied

Use approved Supervisor A and Inventory Worker A assigned to active Store A; Supervisor B assigned to Store B; Admin; and an email-verified Shopper. Use separate browser profiles. Test with dedicated products/orders and record their IDs.

1. Supervisor A → System Configuration: confirm the actual Store A name/address and "Store Operating Hours & Pickup Scheduling" heading. There is no arbitrary store selector, four-order setting, automatic-assignment toggle or mock save-success message.
2. Enter the store's actual weekly operating hours and a pickup-service interval inside them. Close non-operating weekdays. Select the approved 24/48-hour holding policy, or leave it explicitly unconfigured. Save and confirm. Refresh and reopen: every saved value persists.
3. Try pickup opening before store opening, pickup closing after store closing, reversed times, or pickup on a closed weekday. Expect validation without partial persistence or audit changes. A closed pickup-service weekday must be unavailable even if the supermarket itself is open.
4. Admin → Store Management → View pickup settings: confirm the same hours/holding, actual Supervisor actor and readable before/after audit. There are no edit/save/suspension controls. Admin store/staff assignment and COP Management still operate separately.
5. Supervisor B → System Configuration: confirm only Store B's values/audit/orders appear. Changing B must not change A. Shopper and Inventory Worker cannot use the Supervisor settings endpoints; unapproved/unassigned/inactive-store staff are denied.
6. Shopper → Browse Products → Review Cash on Pickup: choose a date. Confirm pickup-service hours, store hours and earliest future start are displayed. Closed/suspended/past dates and out-of-range windows cannot be reviewed. Place a valid test order and record its window and closing deadline. Stock reservation follows the existing Checkout rules.
7. Prepare/delegate the test order through the existing flow. Select a short future test window within genuine pickup operations, mark Ready before its end, and keep it unclaimed until just after the selected end while pickup service is still open. Confirm no strike at window end; verify/pay/hand over successfully before the saved store closing cutoff.
8. Create a separate valid Ready order and record its original QR/PIN, selected window, claim deadline and stock quantities. Change that weekday's operating or pickup-service hours as Supervisor A. Refresh settings and Orders: the order appears under review; its original window/deadline and stock/payment values are unchanged. Normal Ready/release actions are blocked until review; Shopper sees the review notice.
9. In that order's existing Schedule / unclaimed-order review, select a valid future window and enter the review reason before the original deadline. The same window may be reconfirmed if still valid. Approve; refresh. Expect review cleared, audit reason saved, new Shopper notification and replacement credential. Old PIN must fail; new PIN must work during permitted pickup operations.
10. Supervisor A records a future test suspension date with a required reason. Empty reason fails. Duplicate date fails. Shopper scheduling/claiming is blocked on that date; affected existing orders require review. Admin sees the suspension and audit. Existing strikes are not erased by a suspension.
11. An expired/completed order or one with a COP strike must reject normal rescheduling. Admin strike correction remains a separate audited process. Do not backdate working records or alter the server clock to fabricate expiry.
12. Refresh each role, sign out/in and check persistence. Recheck worker assignment: one active order per worker remains enforced, independently of this screen.
13. Long-duration prepaid 24/48-hour expiry and COP strike escalation use the isolated time-controlled tests above. Real prepaid browser acceptance still depends on a genuine payment-provider integration.

Read-only deadline preview from backend/laravel:

    php artisan orders:process-deadlines --dry-run

The real command without --dry-run changes eligible records at actual server time. Use the existing transaction checklist for deliberate No-Show consultation tests; no Shopper browser is required for server-side processing.

## Remaining limits

- Browser acceptance remains pending. Working migration 000014 is applied with explicit approval and record-preservation checks.
- One same-day interval per weekday; no split/overnight hours, appointment capacity or automatic scheduling optimizer.
- Changed weekdays are conservatively flagged even if a particular original window still fits. Review with a reason is required; the system does not silently approve it.
- The audit UI shows the latest 50 schedule changes; all existing audit rows remain stored. Suspensions are immutable date/reason records; a suspension correction/removal workflow is not added here.
- Expired, struck or already claimant-verified orders require reconciliation rather than this ordinary reschedule form. This change does not create a new reconciliation/override module.
- Actual digital payment integration, financial refunds and full invoice requirements remain outside this revision.
- AI, owner functionality, deferred profile changes, inventory accounting and platform COP strike policy were not changed.

## Files changed

The complete local revision manifest follows.

- backend/laravel/app/Http/Controllers/Api/OrderResolutionController.php
- backend/laravel/app/Http/Controllers/Api/PickupController.php
- backend/laravel/app/Http/Controllers/Api/StorePickupSettingsController.php
- backend/laravel/app/Models/Order.php
- backend/laravel/app/Models/Store.php
- backend/laravel/app/Services/OrderData.php
- backend/laravel/app/Services/OrderDeadlines.php
- backend/laravel/app/Services/PickupPolicy.php
- backend/laravel/app/Services/PickupScheduling.php
- backend/laravel/database/migrations/2026_10_19_000014_add_pickup_service_hours_and_schedule_review.php
- backend/laravel/routes/api.php
- backend/laravel/tests/Feature/PickupSchedulingCopTest.php
- backend/laravel/tests/Feature/SupervisorPickupSettingsTest.php
- docs/feature-6-shopper-catalog-cart.md
- docs/feature-7-to-10-transactions.md
- docs/module-progress-audit.md
- docs/october-19-transaction-sprint-report.md
- docs/pending-transaction-migrations.md
- docs/supervisor-pickup-settings.md
- docs/transaction-sprint-handoff.md
- docs/transaction-sprint-study-guide.md
- frontend/src/components/Shoppers/ShopperCheckout.jsx
- frontend/src/components/Supervisor/SupervisorContext.jsx
- frontend/src/components/Supervisor/SupervisorData.js
- frontend/src/components/Supervisor/SupervisorSystemConfiguration.jsx
- frontend/src/components/admin/StorePickupSettings.jsx
- frontend/src/components/orders/OrderPickup.jsx
- frontend/src/components/orders/OrderResolution.jsx
- frontend/src/components/orders/OrderWorkspace.jsx
- frontend/src/pages/admin/StoreManagement.jsx
- frontend/src/services/api.js
- frontend/src/services/pickup-scheduling.js
- frontend/tests/pickup-scheduling.test.mjs
- frontend/tests/transaction-workflow-api.test.mjs
