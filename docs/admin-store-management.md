# Admin Store Management

Date: October 19, 2026.
Status: implemented and automated checks passed. The user reported browser testing
done, then requested the Supervisor Staff Assignment UI. Individual browser case
results were not recorded by the assistant.

## Functionality and decisions

Admin > Store Management opens `/admin/stores` and loads real database records.
Admin can search by name/address/ID, filter active/inactive status, create a store,
edit its name/address, and deactivate or reactivate it through a confirmation
dialog. The list shows actual registered/active/inactive totals and assigned staff
counts. Loading, empty, filtered-empty, retry, field-error, and success states are
connected to the API. Dialogs trap focus through the native browser dialog, support
Cancel/Escape, and prevent dismissal/repeated submission while saving.

The existing `stores` table is reused. Name is required, maximum 100 characters;
address is required, maximum 255. Stores may share a name because different branches
have separate `store_id` identities. New stores start Active. Name/address editing
does not change status; a separate action updates status explicitly.

Deactivating a store retains its products, inventory values, and staff assignments.
It removes that store from new staff-assignment choices and blocks the currently
implemented Inventory Worker/Supervisor store operations. Reactivation restores
those operations for staff who still satisfy approval/assignment requirements.
Accounts can still authenticate while their store is inactive. Other stores keep
their existing status and access. This feature does not specify future order or
shopper storefront behavior, which must use the same store-status checks when built.

No hard delete, new migration, Owner role/relationship, or automatic staff transfer
was added. The implementation did not seed or modify the working MariaDB data.
Store edits/status changes lock the store row, matching the lock used by inventory
writes and staff placement. Repeated saves of an unchanged status are harmless and
preserve the original update timestamp.

## Files changed for this feature

Backend:

- `backend/laravel/app/Http/Controllers/Api/AdminStoreController.php`: store list,
  create, detail edit and status actions; validation, field whitelists and row locks.
- `backend/laravel/routes/api.php`: four Sanctum/Admin-protected routes and write
  throttles, preserving existing staff/inventory/auth routes.
- `backend/laravel/tests/Feature/AdminStoreTest.php`: 24 safe database/API cases,
  including lifecycle integration with staff assignments and inventory access.

Frontend:

- `frontend/src/pages/admin/StoreManagement.jsx`: real store list, search/filter,
  totals, staff counts, create/edit/status controls and result states.
- `frontend/src/components/admin/StoreActionDialog.jsx`: create/edit and explicit
  activation/deactivation confirmation forms, field errors and saving lock.
- `frontend/src/hooks/useAdminStores.js`: cancellable reads, validation and retry.
- `frontend/src/services/api.js`: four store API calls, shared Sanctum/CSRF helpers,
  whitelisted metadata bodies and explicit status body.
- `frontend/src/components/admin/AdminLayout.jsx`: Store Management sidebar link.
- `frontend/src/routes/AppRoutes.jsx`: `/admin/stores` inside the Admin-only routes.
- `frontend/tests/admin-stores-api.test.mjs`: eight API contract/error tests.
- `frontend/package.json`: `npm run test:stores`.

Existing unrelated edits were preserved. Staff Management's earlier browser test
was reported done by the user; its store choices refresh from the existing backend
when the page is opened or Refresh is clicked.

## API contract

| Method | Path | Input | Response |
|---|---|---|---|
| GET | /api/admin/stores | None | stores[] (active and inactive) |
| POST | /api/admin/stores | store_name, address | 201, message, store |
| PUT | /api/admin/stores/{store} | store_name, address | message, store |
| PUT | /api/admin/stores/{store}/status | status: active or inactive | message, store |

Each store DTO contains store_id, store_name, address, status,
assigned_staff_count, created_at, updated_at. The custom primary key is used by
Laravel's route binding; an unknown store returns 404. Metadata and status actions
explicitly whitelist their own mutable fields, so an empty protected status cannot
clear the existing status. IDs, Owner/actor/role fields, assigned staff IDs/counts,
and timestamps cannot be supplied as mutable store attributes.

Sanctum session authentication and Admin role checks apply to every route. Writes
use the existing CSRF-protected shared client. Guests receive 401, non-Admin roles
403, invalid values 422, unknown stores 404, and throttled writes 429. There is no
DELETE operation (405 on an existing store resource URL).

## Executed automated checks

- `php artisan test --compact`: **180 passed, 2,476 assertions**, zero failed,
  including 24 new AdminStoreTest cases and all prior regression tests. Database
  tests guard for SQLite `:memory:`, array sessions/cache/mail, and enabled foreign
  keys before migrating their disposable database.
- Node tests for stores, staff and inventory: **26 passed**, zero failed (8 new
  store API tests); HTTP requests are mocked.
- ESLint: all changed JS/JSX files passed.
- PHP syntax checks: new controller and test passed.
- `artisan route:list --path=admin/stores -vv`: all four routes show Sanctum and
  Admin-role middleware; write throttles are present.
- Vite production build passed, with the existing bundle-size advisory (about
  614 kB minified JavaScript before gzip).
- The first targeted backend run exposed eight fixture-comparison failures:
  in-memory Eloquent attributes used insertion ordering/string decimals while DB
  snapshots used column ordering/SQLite numeric types. Both sides now compare
  fresh database snapshots strictly; the full suite passes.
- Browser form interaction and working MariaDB mutation checks are pending the
  user's manual test below. Automated tests did not modify the working database.

## Exact browser test

Use the usual running frontend and Laravel servers. No migration/seeder is needed.
These browser actions intentionally persist your test records in the local DB.

1. Log in as Admin. Open `http://localhost:5173/admin/stores`, or click Store
   Management. Confirm the existing Store A/Store B records, correct status and
   assigned staff counts. Search by name/address/ID, filter status, clear filters,
   and refresh. Counts must reflect the database, not demo totals.
2. Click Create Store. Enter `UI Test Grocery` and a test address, then Create
   store. Expect an Active row with a new store ID and zero assigned staff. Refresh
   the browser: the same row/ID persists. Same-named branches are allowed and must
   have distinct IDs, so identify this test store by ID/address.
3. Edit that test store's name/address, save and refresh. Expect the same ID and
   unchanged Active status with the edited details. Open another edit, change text,
   then Cancel or Escape. Refresh: cancelled changes must not persist. Empty
   required values or whitespace-only names/addresses must not save; the input
   limits are 100/255 characters and the backend enforces those limits too.
4. Click Manage staff. Open an approved test staff account's Assign store/Transfer
   store form. The new store must appear with the updated name, ID and address.
   Assign a test Inventory Worker and test Supervisor to it, then refresh Store
   Management: the assigned staff count should increase. Use test accounts to
   avoid interrupting normal staff while verifying this feature.
5. In a separate browser profile, log in as the test Inventory Worker. Open
   `/inventory/products`, add a test product at 25.50, and refresh. Confirm its store
   ID/details and zero initial quantities. As the test Supervisor,
   `/supervisor/inventory` should show the same product read-only. Note the product
   and inventory IDs for persistence checks.
6. As Admin, click Deactivate on the test store. Check the displayed name, ID,
   address, assigned staff count and explanation. Cancel once and refresh to prove
   no change. Repeat and confirm Deactivate store: the row becomes Inactive and
   remains present; staff count does not change.
7. Refresh the worker's Products/Stock page and the Supervisor's Store Products
   page: store access should be denied with an explanatory error. The staff can
   still log in. In Admin Staff Management, refresh and open assignment choices:
   this inactive store is excluded. Existing assigned staff retain the inactive
   store label and can be manually transferred to an active store. Other active
   stores and their staff should continue to work.
8. As Admin, Reactivate the test store and refresh. Assignment choices include it
   again. Refresh the existing assigned worker/supervisor pages: access returns,
   with the same product IDs, price, quantities, status and assignments. No staff
   reassignment or product recreation should be needed.
9. Log out and visit `/admin/stores`: expect login. As Shopper, Inventory Worker
   and Supervisor, that URL must not show Admin controls. Direct API calls to the
   four endpoints return 401 for guests and 403 for non-Admin roles. An authorized
   edit/status call to a nonexistent numeric store ID returns 404.
10. Set the browser Network panel to Offline and click Refresh: show an error and
    Retry. Restore the connection and retry. Check keyboard access and Cancel/Escape
    in dialogs. During saving, controls must prevent a second submission. If a
    write response is lost, refresh the list before attempting another creation.

Read-only database checks (replace 3 with the actual test store ID):

```sql
SELECT store_id, store_name, address, status, created_at, updated_at
FROM stores ORDER BY store_id;

SELECT id, user_id, store_id, assigned_by_user_id, created_at, updated_at
FROM staff_store_assignments WHERE store_id = 3;

SELECT product_id, store_id, product_name, sku, created_at, updated_at
FROM products WHERE store_id = 3;

SELECT store_inventory_id, store_id, product_id, selling_price,
       hard_stock_qty, soft_stock_qty, status, created_at, updated_at
FROM store_inventory WHERE store_id = 3;
```

Only the store's status/updated_at should change during deactivate/reactivate.
Related product, inventory and assignment rows/values/timestamps stay unchanged.

## Execution flow and team handoff

Create Store -> StoreManagement/StoreActionDialog -> createAdminStore -> Sanctum
CSRF cookie and POST /api/admin/stores -> Admin middleware -> AdminStoreController
validation -> Store model -> stores row -> JSON -> success notice and fresh list.

Status changes use the same path through updateAdminStoreStatus and the explicit
status endpoint. Store::active() already controls destination store choices in
StaffStoreAssignmentController. Existing staff/inventory authorization checks the
current store's status on every request, so a stale browser cannot bypass
deactivation by retaining an old store selector.

For errors, inspect Network status/body, then Laravel's
`backend/laravel/storage/logs/laravel.log`. 422 responses contain field errors;
401 requires login; 419 concerns CSRF/session; 403 requires the appropriate role
or, on staff endpoints, current approval and an active assigned store.

Team summary: the Admin store setup now has real backend/frontend operations and
connects to staff placement and existing store access controls. No schema or login
role change. The user reported manual completion; no module-role completion
percentage is independently claimed from automated checks or that brief report.
