# Feature 4: Store-owned products and inventory

Status: corrected implementation and automated checks complete. The ownership
migration was applied to the local MariaDB database on October 19, 2026, after
explicit user approval. Read-only database verification passed. The user reported
browser testing done, then requested the Admin staff management/assignment React
integration for existing Features 2A/2B. Feature 5 has not been started.

## Confirmed business model

Each grocery store uses GrocerEase as its own online-store workspace. Products
belong to a store. Staff do not use a unified shared product list.

- An approved Inventory Worker creates and edits product details, selling price,
  and status only for their assigned active store, using the React form.
- The store's approved Supervisor can view the same products and quantities on
  /supervisor/inventory. Product editing remains the Inventory Worker's operation.
- Other stores' staff cannot list, reuse, edit, or link these product records.
- New products and inventory are created together in one transaction.
- New quantities start at zero. Quantity changes and hard/soft calculations remain
  deferred to the approved Stock Request / Supervisor Approval workflow.
- Picking/packing workers remain non-login personnel. Their later workers and
  worker_assignments features must enforce the same store ownership. The current
  Supervisor personnel screen is still a prototype, not verified functionality.
- Existing users/roles/profiles, Sanctum sessions, CSRF, staff approval, and
  assignment rules remain in place. Owner and cost fields remain deferred.

## Database and ownership migration

The already-applied inventory migration is:
database/migrations/2026_10_19_000005_create_store_inventory_table.php.

The applied ownership correction is:
database/migrations/2026_10_19_000006_scope_products_to_stores.php.

It adds products.store_id with a restricted foreign key to stores, replaces global
SKU uniqueness with UNIQUE(store_id, sku), and adds a parent store/product key.
Inventory gains a composite foreign key (store_id, product_id) to the owning
product. The database therefore rejects linking Store A's product to Store B's
inventory.

Existing products referenced by inventory receive the store from that inventory.
If an old product was used by multiple stores, each store receives an independent
product record; the inventory IDs, prices, quantities, status, and timestamps are
preserved. Legacy product records with no known store remain unassigned and hidden
from all store APIs. The nullable ownership field exists only to retain those
legacy records without guessing an owner. New UI/API products always have a store.

Read-only inspection after application confirmed that product 1 belongs to Store A
(store_id 1). Inventory row 1 retains its 67.00 price, zero quantities, active
status, original IDs, and original timestamps. Products 2 and 3 remain unassigned
and are excluded by the store-scoped APIs. No products were seeded and staff
assignments were unchanged.

The SQLite branch rebuilds inventory inside a transaction to preserve numeric
CHECK constraints while adding the ownership key. The working MariaDB branch
uses ALTER TABLE and data backfill; it does not drop inventory or product tables.
Automatic rollback to a shared catalog is intentionally refused because merging
independent store products could lose data.

## API contract

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | /api/inventory/items | inventory_worker, supervisor | Own-store product/inventory list |
| POST | /api/inventory/items | inventory_worker | Create own-store product and inventory |
| PUT | /api/inventory/items/{item} | inventory_worker | Edit own-store metadata, price, status |

The former /api/inventory/catalog route is removed.

POST fields: product_name (max 255), sku (max 64), category (max 100),
optional barcode (string, max 64), optional size (max 100), selling_price, status.
SKU is trimmed and uppercased before validation, and unique only within the store.
Barcode remains text so leading zeros are preserved.

PUT requires price/status and accepts the same metadata fields as optional changes.
It cannot change ownership or product identity IDs. Omitted optional metadata is
preserved; explicit null clears barcode/size.

Price is nonnegative DECIMAL(10,2), accepts at most two decimal places, and is
returned as a decimal string. Status is active/inactive; this is a product switch,
not a stock-availability calculation.

The browser cannot submit store/user/role overrides, product_id,
store_inventory_id, quantities, or cost fields. The controller resolves and locks
the current staff account, assignment, and active store before operating. Both
inventory.store_id and product.store_id are included in every product read/update.

Responses: GET returns store and inventory[]. Writes return message, store, and
inventory. Each item includes product_id, store_inventory_id, store_id, metadata,
price, both recorded quantities, status, and updated_at.

Errors: 401 guest; 403 unauthorized role/unapproved/unassigned/inactive store;
404 another store's or nonexistent item; 422 invalid fields or duplicate SKU
within the store; 429 write throttle. No error discloses another store's product.

## Files involved

Backend:

- database/migrations/2026_10_19_000005_create_store_inventory_table.php
- database/migrations/2026_10_19_000006_scope_products_to_stores.php
- app/Models/Product.php, Store.php, StoreInventory.php
- app/Http/Controllers/Api/StoreInventoryController.php
- routes/api.php
- database/seeders/LocalProductSeeder.php, LocalStoreInventorySeeder.php
- tests/Feature/ProductFoundationTest.php
- tests/Feature/StoreInventoryFoundationTest.php, StoreInventoryApiTest.php
- tests/Feature/ProductOwnershipMigrationTest.php

Frontend:

- src/pages/inventory/ProductManagement.jsx, StockManagement.jsx
- src/components/inventory/product-management/ProductFormModal.jsx,
  ProductTable.jsx, ProductStatCards.jsx
- src/components/inventory/stock-management/StockTable.jsx, StockStatCards.jsx
- src/components/inventory/layout/StoreSelector.jsx
- src/components/inventory/shared/InventoryLoadState.jsx
- src/hooks/useStoreInventory.js
- src/services/api.js, tests/inventory-api.test.mjs, package.json
- src/components/Supervisor/SupervisorInventory.jsx
- src/components/Supervisor/SupervisorApp.jsx, SupervisorSidebar.jsx

Existing unrelated admin-page changes and other developers' code are preserved.

## Executed checks (October 19, 2026)

- Laravel: 156 passed, 2,034 assertions. All database tests use guarded SQLite
  :memory: databases and array cache/session/mail.
- Frontend service tests: 8 passed; HTTP calls are mocked.
- ESLint: changed JS/JSX files passed.
- Vite production build: passed, with the existing over-500-kB bundle advisory.
- Migration conversion test: existing prices, quantities, IDs, timestamps, and
  references are preserved; old shared records become separate owned products.
- Database constraint test: cross-store product/inventory links are rejected.
- Local MariaDB: ownership migration recorded in batch 13; store-local SKU and
  parent product keys and the inventory ownership foreign key are present. All
  three nonnegative inventory CHECK constraints remain enabled. No inventory
  ownership mismatches were found; existing inventory values and staff
  assignments match the preflight inspection.
- User reported browser testing done after receiving the checklist below. Detailed
  individual browser results were not recorded by the assistant.

## Applied migration record

After the user approved "Apply the store-ownership migration," the following
command completed successfully from backend/laravel:

```powershell
php artisan migrate --path=database/migrations/2026_10_19_000006_scope_products_to_stores.php
```

No seeder or staff reassignment was run. No other pending migration was applied.

## Browser acceptance after migration

1. Sign in as Inventory Worker 3 (Store A), open /inventory/products, and confirm
   the assigned store plus the preserved existing 67.00 product.
2. Click Add New Product. Enter a name, SKU STORE-TEST-001, barcode 00012345,
   size 1 kg, category Staples, selling price 25.50, and Inactive status.
   Save and refresh; details persist and both quantities are zero.
3. Edit its name, barcode, price, and status. Refresh and open /inventory/stock.
   Verify the edits persisted. Cancel another edit and verify no changes.
4. Negative/excess-precision prices, missing required metadata, overlong values,
   and duplicate SKU in Store A must be rejected without saving anything.
5. Sign in as Supervisor 2 (Store A), open Store Products at
   /supervisor/inventory. Confirm the same Store A records, with no editing controls.
6. For Store B, use an approved worker/supervisor assigned to Store B in a separate
   browser profile. Current worker 9 is still in Store A; Admin can manually
   transfer that demo worker to Store B using the existing assignment endpoint.
   Create the same SKU in Store B with different details and price. It must get a
   different product_id. Store A's details must remain unchanged.
7. Attempt a PUT with an actual Store B inventory ID from a Store A account:
   expect 404. Supplying store_id, product_id, or quantities must return 422.
   GET inventory/items?store_id=<B> must also return 422.
8. Guest API calls return 401; Shopper/Admin calls return 403; Supervisor writes
   return 403. Unapproved/unassigned/inactive-store staff cannot read inventory.
9. Check loading, retry, empty states, search/filter behavior, and CSV export.
   Other prototype inventory screens are not part of this verification.

Read-only verification:

```sql
SELECT p.product_id, p.store_id, p.product_name, p.sku, p.barcode,
       si.store_inventory_id, si.selling_price, si.hard_stock_qty,
       si.soft_stock_qty, si.status
FROM products p
JOIN store_inventory si
  ON si.product_id = p.product_id AND si.store_id = p.store_id
ORDER BY p.store_id, p.product_id;
```

## CSRF-enabled browser-console helper

With frontend localhost:5173 and Laravel localhost:8000, paste after each login/reload:

```javascript
window.checkApi = async function (path, method = 'GET', body) {
  const backend = 'http://localhost:8000';
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    const csrf = await fetch(backend + '/sanctum/csrf-cookie', { credentials: 'include' });
    if (!csrf.ok) throw new Error('Could not initialize CSRF.');
    const cookie = document.cookie.split('; ').find(v => v.startsWith('XSRF-TOKEN='));
    if (!cookie) throw new Error('Missing CSRF cookie.');
    headers['X-XSRF-TOKEN'] = decodeURIComponent(cookie.substring('XSRF-TOKEN='.length));
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(backend + '/api' + path, {
    method, credentials: 'include', headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  console.log('HTTP ' + response.status, data);
  return { status: response.status, data };
};
```

Admin-only optional demo reassignment (changes worker 9's store):

```javascript
await checkApi('/admin/staff/9/store-assignment', 'PUT', { store_id: 2 });
```

## Later stock/worker integration

Stock accounting is now confirmed: physical on-hand includes reservations, soft
stock is reserved units, and available stock is their difference. Absolute physical
count corrections require same-store Supervisor approval and stale checks.
See `feature-5-stock-management.md` for implementation and acceptance instructions.
Workers and delegation will use store_id and the Supervisor's users.id; no picker
credentials or authentication role will be introduced.

The October 19 autonomous sprint instructions supersede the earlier per-feature
pause: continue after safe automated checks, keep browser acceptance separate,
and ask before working-database migrations or unresolved business rules.
