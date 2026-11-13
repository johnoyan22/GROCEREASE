# Public catalog and report exports

Date: 2026-11-13. Branch: `feature/adviser-improvements`; reviewed base `d330fc0`.
Original hero, branding, category images and auth URLs are preserved. Exact file
manifest: checkpoint 8 of `adviser-improvements-changelog.md`.

## Public discovery

Visitors choose/drag a map pin or use its center, then **Confirm selected area**.
Browser permission is requested only after **Use my location**. A verified
pickup-area selector and store/address search work without geocoding or a map
key. The verified store list is browsable before choosing an area; distances
appear only after confirmation, as approximate straight-line distances within
5/10/25/50 km. The chosen area stays in temporary page state.

Markers and store cards select/highlight the same store. **View Available
Products** opens a preview below the hero with search, category filtering and
pagination (12 per page, maximum 24). Switching stores aborts the old preview and
resets its filters. No extra marketing sections or generated catalog data.

`PublicStoreAccess` shares verification rules across discovery, catalog and
photos: active store, valid coordinates, verifier/time and exact current/verified
address match. The existing Admin checkbox explicitly approves public display;
no duplicate approval field/table. Admin address edits revoke verification and
append an audit, even if an old address is later restored.

`CatalogInventory` shares owned/active inventory selection with the authenticated
Shopper catalog. Public reads apply `BatchStock`'s existing formula in SQL before
pagination: Hard − Soft − expired/quarantined remainder > 0. Expiry remains
inclusive of its Philippine calendar day. Legacy stock is not reconstructed.

Public fields: product/store IDs, name, category, size, unit, current selling
price, availability label and eligible image URL. No exact physical/reserved/
sellable quantities, supplier costs, audits, staff/customer or reservation data.
Search is bounded and treats `%`/`_` literally; stable order is name then inventory ID.

## Public API and authentication

| Route | Access / behavior |
| --- | --- |
| `GET /api/public/store-locations` | Existing public verified-store read; 60/minute |
| `GET /api/public/stores/{store}/products` | New read-only preview; `search`, `category`, `page`, `per_page`; 60/minute |
| `GET /api/public/stores/{store}/products/{product}/photo` | New scoped image read; repeats public-store/sellable-product checks; safe path and JPEG/PNG/WebP MIME; 120/minute; no-store/nosniff |

Unverified/inactive/address-changed stores and ineligible photos return 404.
Authenticated Shopper catalog, original `/catalog/products/{product}/photo`,
selected-store writes, cart/Checkout/orders/accounts and AI remain protected.
Guests have Login/Register links and no Add to Cart, reservation or order action.

A validated positive store ID can pass through Login/Register/verification URLs.
Authenticated Shoppers reach Browse with **Use previewed store**, using the
existing active-store selector and mixed-store confirmation. No silent clearing,
cart mixing or automatic item addition. Checkout still validates real prices/stock.

## Dedicated Reports

| Role | Reports screen | Reports / scope |
| --- | --- | --- |
| Inventory Worker | New `/inventory/reports` and Reports navigation | Current stock, low-stock/reorder; approved staff's assigned active store only |
| Supervisor | `/supervisor/reports`; old `/supervisor/sales-reports` remains compatible | Sales, verified transactions, orders, current/low stock; assigned active store |
| Admin | `/admin/reports` | Sales, verified transactions, current/low stock, COP failures/restrictions; selected store/all stores |

Worker Reports is an adviser-requested read-only operational feature. No Worker
financial permission or official Reports/Analytics module point is added. The
accepted module-role count remains **3/40**.

JSON table and PDF use one authorized filtered dataset in `ReportPdfController`,
reusing Dompdf/DocumentPdf. Screen pages show 50 rows; totals/PDF cover all matching
records. Above 5,000 records the request is rejected, never silently truncated.
Empty reports remain valid. Unapplied filter changes disable Export PDF.

| API prefix | JSON / PDF |
| --- | --- |
| `/api/inventory/reports` | New `GET /{kind}` and `GET /{kind}.pdf`; only `stock`, `low-stock` |
| `/api/supervisor/reports` | New `GET /{kind}`; existing `GET /{kind}.pdf` extended for `low-stock` |
| `/api/admin/reports` | New `GET /{kind}`; existing `GET /{kind}.pdf` extended for `low-stock` |

Filters: search, exact stock category/status, order status/upcoming pickup,
dated-report date range, Admin supermarket. Existing Admin orders report endpoint
remains available. Staff-supplied `store_id` is rejected; `StoreStaffAccess`
enforces assigned active stores. Shopper/foreign-role exports fail safely.
Stock is a current snapshot and rejects historical dates. Dated reports use
Asia/Manila; peso/refund/revenue labels, branding, repeated headers and page
numbers remain intact. No inferred historical stock balances.

PDF controls were removed from ordinary Supervisor Orders, Inventory and shared
stock-editing screens. `TransactionRecords` exports only in explicit report mode;
ordinary transaction/detail screens have no generic export. Current Reports
screens use shared `ReportWorkspace`. Receipt/invoice documents and CSV import/
templates remain separate; unapproved invoices remain Draft / Pro Forma.
The existing stock CSV download is retained and explicitly labeled **Export CSV**;
it is not a PDF report control. Receiving CSV imports/templates are unchanged.

## Actual verification and pending acceptance

- Laravel: **398 passed / 6,971 assertions** (52.25 seconds).
- Frontend: **137 passed**; ESLint and production build passed.
- Chrome: **44 passed**, no failures/skips/flaky cases (78.64 seconds), including
  guest pin/card/catalog/photo/filter flow at 320/375/390/430/768/1024/1366/1440 px,
  fallback/permission denial, safe cart switching, all staff Reports downloads
  and export absence in ordinary screens.
- Disposable MariaDB: public catalog eligibility/pagination/query syntax, exact
  address matching, assigned stock-report JSON and read-only invariants passed,
  plus six existing concurrency scenarios. Temporary data removed. Read-only
  working comparison: **31 business tables unchanged**.

Browser checks use labeled API fixtures and a Google SDK stub. The browser PDF
fixture is a real Dompdf document. Laravel independently generates actual role-
scoped PDFs and compares real filtered table/PDF rows/totals and no-write
snapshots. Phone/desktop screenshots were inspected. These are automated checks,
not human partner acceptance, physical-device tests or live Google acceptance.

No additional migration was needed/created. Existing 18–21 remain unapplied to
the working database, pending their existing approval process. No environment
file, Google key/billing, Gemini provider/key or PayMongo configuration changed;
no push/merge. Pending: authorized Google/referrer/map-ID/latency tests, verified
partner locations/catalog/photos, human/device acceptance, and teammates'
Gemini/PayMongo provider tests.
