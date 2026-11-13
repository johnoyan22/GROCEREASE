# Adviser improvement checkpoints

Date: 2026-11-13. Branch: `feature/adviser-improvements`. No pushes or merges.

## 1. Audit and baseline

- Inspected clean integration branch at reviewed `b611ae3`; fetched origin (no newer integration commits).
- Baseline Laravel: **357 passed, 5,957 assertions**, disposable SQLite.
- Baseline frontend: **113 passed**, ESLint passed, Vite production build passed.
- Existing large-JavaScript-chunk warning retained as a performance concern.
- Working MySQL was not migrated, reset or seeded. Environment files untouched.

## 2. Authentication and profiles

- Removed disconnected Google Login/Register buttons and dead Forgot Password action.
- Kept email/password and verified-email role redirects; no OAuth backend existed to remove.
- Reused Shopper profile API; private, own-account JPEG/PNG/WebP photo upload,
  replacement and removal (2 MB, maximum 4096 px). Existing `profiles.imagesrc`
  stores randomized references; no schema change required.
- Shared `components/shared/Avatar.jsx` uses actual names for staff initials;
  header and profile instances update from current account data.
- Removed unsaved Shopper preference controls and disabled staff global search/cart.
- Account & Security retains the existing password workflow; staff identity permissions unchanged.
- Login/Register layouts now stack on phones.

Phase results and later checkpoints are appended as executed. Human acceptance,
provider acceptance and working-database setup are separate from automated tests.

Checkpoint 2 validation: **49 Laravel tests / 521 assertions** for photo, profile,
staff account, authentication and email verification; **114 frontend tests**,
ESLint and production build passed. Initial photo fixture required GD; replaced
with an actual PNG fixture so no PHP configuration change is required.

## 3. Products and stock

- Additive catalog migration **000018** creates `store_categories`,
  `category_audits`, `product_price_changes`; adds nullable product category,
  selling-unit and image-reference fields plus historical order-item selling unit.
  Backfills only new category relationships from existing store category names.
- Automatic store-prefixed ULID SKU, existing database unique constraint,
  immutable API SKU; barcode remains separate. Active category dropdown and
  Supervisor CRUD/archive preserve products and AI category filter names/audits.
- Integer selling units, owned private catalog photos, lazy image fallback,
  purchase-time unit snapshot and store/actor/old/new price audit.
- **000019** creates receiving requests, batches/events and persistent alert,
  state and per-user acknowledgement tables. No existing stock is moved.
- Receiving/disposal requests and CSV preview/confirmation require Supervisor
  approval; no import overwrites stock. Signed preview expires after 15 minutes
  and is bound to actor/store; duplicate delivery references cannot be replayed.
- `low_stock_threshold` remains the one reorder level; order limit is separate.
- Sellable availability = max(0, Hard − Soft − expired/quarantined batch remainder).
  Expiration date is sellable through that Philippine calendar day. Hard Stock
  changes only through approval/handover; FEFO handover consumes safe batches.
  Legacy stock retains its existing count without invented expiry dates.
- Handover blocks if unsafe batches make total reservations unsafe. Supervisor
  reconciliation is required; no automatic order substitution or reservation release.
- Stock corrections cannot undercut tracked batch totals; approved disposal has
  before/after physical counts, actor, description and batch event audit.
- Model changes generate alerts; scheduled `inventory:monitor` detects date-based
  expiry every minute. Reads never generate alerts. Recovery closes an episode;
  another drop creates a new alert. Acknowledgements are user/store scoped.
- UI label Reason becomes Description; backend `reason` remains intact.

Catalog/stock targeted tests: **9 passed / 165 assertions**; updated catalog,
reporting and profile tests: **43 passed / 733 assertions**. Prior catalog API
fixtures now use category IDs and generated SKU behavior. No business/security
regression tests were removed. Schema-preservation/full regression follows.

Checkpoint 3 full regression: **372 Laravel tests / 6,269 assertions passed**;
**122 frontend tests passed**; ESLint and production build passed (same chunk
warning). Migration preservation covered original columns across every existing
SQLite table. FEFO and unsafe-handover tests passed. Working-database application
and actual MariaDB concurrency verification remain pending; no real-provider
tests were performed.

## 4. Orders, invoices and reports

- Assigned-active-store order ID, `GE-{order}`, existing receipt
  `GE-{order}-{handover}` and `TX-{payment}` lookup returns current order/payment/
  preparation/claim state. It does not grant a new verification or handover path.
- Separate immutable Draft / Pro Forma Sales Invoice with unique reference/order,
  historical prices/units, confirmed payment reference, seller snapshot, generation
  and export audit. Existing receipts are unchanged.
- Additive **000020** creates empty `store_invoice_settings`, `order_invoices`,
  `invoice_audits`. Admin records approved seller details. Official issuance and
  tax computation remain unavailable until partner/BIR authorization is reviewed.
- Real Dompdf **3.1.6** downloads for Supervisor order/stock/sales/transactions and
  Admin sales/transactions/stock/COP; filters, scope, accurate labeled totals,
  Philippine dates, Unicode peso, repeated headers and page numbers preserved.
- PDF fixture QA: one-page invoice and order summary; five-page / 100-row report,
  rendered through PDF.js to PNG because Poppler/Python are absent. Invoice,
  first and final report pages visually checked; text extraction verifies peso,
  page numbers and every-page draft marking. No fake records enter business data.
- Added `docs/invoice-and-payment-readiness.md`: current primary BIR sources,
  exact partner dependencies, existing test-only PayMongo setup/acceptance steps.
- PayMongo adapter and migrations remain intact; no provider credentials or real
  sandbox transactions were used. Existing HTTP-fake regression is retained.
- Composer identified existing advisories in five Symfony dependencies; limited
  patch updates address those packages without changing Laravel major versions.

Before dependency patch update: **378 Laravel tests / 6,439 assertions** passed;
**122 frontend tests**, ESLint and production build passed. Dedicated document/
lookup/PDF tests: **6 / 158 assertions** passed. Dependency recheck and final
regression follow; actual provider and partner acceptance remain pending.

After Symfony patch updates: Composer reports **no security vulnerability
advisories**. Document, migration, sandbox-payment and pickup regressions:
**38 tests / 862 assertions passed**; frontend adviser API tests **5 passed**;
ESLint passed. Final full-suite comparison remains checkpoint 6.

## 5. Visual consistency and responsiveness

- Shared Tailwind theme tokens, sans-serif type, readable labels, contrast,
  keyboard focus and comfortable touch controls retain the green/white identity.
- Shopper phone drawer/header, stacked dashboard/forms, quantity controls,
  contained order tables and native Checkout/product dialogs. Staff keep desktop
  sidebars; Supervisor/Admin navigation remains available on smaller screens.
- Removed sample-priced Shopper dashboard products and unsaved Admin preference
  toggles. Dashboard catalog cards use the existing store/cart services. Role
  Management now reads genuine role counts and provides authorized navigation;
  disconnected role CRUD controls and invented counts are removed.
- Responsive landing uses original local vector grocery artwork; removes fake
  supermarket location/distance/opening claims and dead search/actions. Guest
  and authenticated role CTAs navigate to real routes. No external brand images.
- Shared pickup workspace extracted from Admin; separate read-only Admin and
  editable Supervisor wrappers. Registration moved from Shopper folders to auth.
  Exact before/after tree and viewport checklist are in `ui-responsive-checklist.md`.
- Route-level lazy loading preserves URLs and removes the large bundle warning.
- **124 frontend tests, ESLint and production build passed. 29 real Chrome
  browser cases passed** across all listed phone/tablet/desktop dimensions.
  Browser tests use labeled API fixtures; no Gemini, PayMongo or working-data
  acceptance is inferred. Representative screenshots were visually reviewed.

## 6. Regression, preservation and handoff

- Final Laravel suite: **381 passed / 6,527 assertions** (41.68 seconds), versus
  baseline 357 / 5,957. Existing security/business regressions remain in place.
- Final frontend: **125 passed**, ESLint passed, production build passed on
  Vite 8.3.8 with no large-chunk warning. Final Chrome run: **29 passed**,
  zero failures/skips/flaky cases (65.44 seconds), using labeled API fixtures.
- Disposable MariaDB passed all migrations and **six concurrent scenarios**:
  generated SKU, receiving approval, reservation, worker assignment, handover and
  invoice generation. Temporary databases/runtime files were removed. A separate
  two-connection check verifies current batch-safety reads after an older
  repeatable-read snapshot. This is distinct from the SQLite regression suite.
- Actual MariaDB testing exposed timestamp compatibility in the new, unapplied
  migrations and a stale invoice lookup after waiting for an order lock. New
  audit fields now use `dateTime`; duplicate guards and inventory decisions use
  current locking reads. No applied historical migration was changed.
- Added multiline CSV physical-line reporting/UTF-8 validation, scoped price
  history presentation and an expiry-aware Admin low-stock summary. PDF export
  rejects unsupported filters; stock PDFs explicitly identify a current snapshot.
- Read-only working-data comparison: **31 business tables unchanged**, including
  original counts/column values. The helper explicitly restricts MySQL metadata
  to the configured schema and excludes volatile session/job/cache tables; an
  initial all-schema metadata count was corrected before reporting preservation.
  No raw business records or credentials are exported by the hash manifest.
- Original migrations through 000017, `.env`, Gemini provider and PayMongo
  architecture remain intact. No working migration, reset, seed, push or merge.
- Compatible dependency updates address the existing Symfony advisories and
  frontend high-severity findings. Final Composer audit: **0 advisories**;
  frontend production audit: **0 vulnerabilities**. Full frontend audit retains
  **7 moderate development-tool findings** around ESLint/minimatch. Details and
  the deferred breaking-tooling decision are in `dependency-audit.md`.
- Added four-role manual procedures, exact migration review and Gemini teammate
  handoff. Human/device, partner invoice/tax, real Gemini and real PayMongo
  acceptance remain pending. New migrations 18–20 await explicit approval;
  existing pending 15/16 are separate. Accepted module count remains **3/40**.

## 7. Original landing restored; verified-store locator prepared

The user's correction restores the original grocery hero, Smart Grocery title,
adjacent Shop Near You card and Fruits/Vegetables/Dairy & Eggs/Beverages/Meat &
Poultry categories. The extra marketing sections are removed. Existing artwork,
red/green identity, genuine links and mobile responsiveness are retained.

- Five original category photographs generated with the built-in image tool,
  visually checked and bundled as 93–170 kB WebP files. Exact prompts and paths
  are in `category-image-prompts.md`; no arbitrary product-photo hotlinks.
- Public read-only locator returns only registered active stores with verified
  coordinates. Click/drag/keyboard-center pin selection, optional browser location,
  radius-limited nearest sorting, clear no-result states and Google directions.
  Straight-line distance is labeled; chosen location is not saved to the account
  or transmitted to the GrocerEase API. Google loads only after explicit action.
- Separate Admin map-location form, validation, verification/source note and
  actor/before/after audit. Changed addresses hide locations; stale-address writes
  fail safely. Existing store details, stock, reservations and orders are unchanged.
- Additive migration **21** creates empty `store_locations` and
  `store_location_audits`, without modifying existing tables, guessing coordinates
  or auto-publishing stores. It remains **unapplied to the working database**.
- Google API-key/map-ID setup, official references, data-verification requirements
  and provider-dependent tests are in `landing-page-and-store-locator.md`.
  No key, billing activation, real Maps test, environment overwrite, push or merge.

Actual validation: **387 Laravel tests / 6,694 assertions** (49.49 seconds),
**131 frontend tests**, ESLint and production build passed. **29 Chrome cases**
passed; seven public/auth viewport cases passed again after the final compact
header/image QA adjustment. All five photos were checked rendered after scrolling
on mobile. Actual Google pin interactions use an explicitly labeled API stub;
provider acceptance remains pending. Disposable MariaDB accepted migration 21
and all six existing concurrency scenarios; temporary test data was removed.
Read-only working comparison: **31 business tables unchanged**. Human/module
acceptance remains pending; no additional module credit.

## Exact file manifest

Tracked paths below come from the local checkpoint commits; `A`, `M`, `D` and
`R` are Git add/modify/delete/rename classifications. The rename entries preserve
URLs; removed prototype markup is represented by file modifications.

### 5beb51c docs: audit adviser requirements against reviewed AI integration

```text
A	docs/adviser-improvements-audit.md
```

### 42fda19 feat: refine authentication and own-account profiles

```text
A	backend/laravel/app/Http/Controllers/Api/ProfilePhotoController.php
M	backend/laravel/app/Models/Profile.php
M	backend/laravel/routes/api.php
A	backend/laravel/tests/Feature/ProfilePhotoTest.php
A	docs/adviser-improvements-changelog.md
M	frontend/src/components/Shoppers/ShopperHeader.jsx
M	frontend/src/components/Shoppers/ShopperMyProfile.jsx
M	frontend/src/components/Shoppers/ShopperSettings.jsx
M	frontend/src/components/Shoppers/registerForm.jsx
M	frontend/src/components/Shoppers/registerHero.jsx
M	frontend/src/components/Supervisor/SupervisorHeader.jsx
M	frontend/src/components/Supervisor/SupervisorProfile.jsx
M	frontend/src/components/auth/loginForm.jsx
M	frontend/src/components/auth/loginHero.jsx
M	frontend/src/components/inventory/layout/Topbar.jsx
A	frontend/src/components/shared/Avatar.jsx
M	frontend/src/pages/auth/LoginPage.jsx
M	frontend/src/pages/inventory/InventoryProfile.jsx
M	frontend/src/pages/shopper/Register.jsx
M	frontend/src/services/api.js
A	frontend/src/services/identity.js
A	frontend/tests/adviser-ui.test.mjs
A	frontend/tests/identity.test.mjs
```

### ae4e3c0 feat: add store catalog controls and approved batch receiving

```text
A	.gitignore
M	backend/laravel/app/Http/Controllers/Api/CheckoutController.php
M	backend/laravel/app/Http/Controllers/Api/PickupController.php
A	backend/laravel/app/Http/Controllers/Api/ProductPhotoController.php
M	backend/laravel/app/Http/Controllers/Api/ShopperCatalogController.php
M	backend/laravel/app/Http/Controllers/Api/StockAdjustmentController.php
A	backend/laravel/app/Http/Controllers/Api/StockAlertController.php
A	backend/laravel/app/Http/Controllers/Api/StockReceivingController.php
A	backend/laravel/app/Http/Controllers/Api/StoreCategoryController.php
M	backend/laravel/app/Http/Controllers/Api/StoreInventoryController.php
M	backend/laravel/app/Models/AiRecommendationSetting.php
M	backend/laravel/app/Models/OrderItem.php
M	backend/laravel/app/Models/Product.php
A	backend/laravel/app/Models/StoreCategory.php
M	backend/laravel/app/Models/StoreInventory.php
M	backend/laravel/app/Services/AiRecommendation/RecommendationEngine.php
A	backend/laravel/app/Services/BatchStock.php
M	backend/laravel/app/Services/CheckoutPricing.php
M	backend/laravel/app/Services/OrderData.php
A	backend/laravel/app/Services/StockAlerts.php
A	backend/laravel/database/migrations/2026_11_13_000018_add_catalog_management.php
A	backend/laravel/database/migrations/2026_11_13_000019_add_stock_receiving_and_alerts.php
A	backend/laravel/routes/adviser.php
M	backend/laravel/routes/api.php
M	backend/laravel/routes/console.php
A	backend/laravel/tests/Feature/AdviserCatalogStockTest.php
A	backend/laravel/tests/Feature/AdviserMigrationTest.php
M	backend/laravel/tests/Feature/StockReportingTest.php
M	backend/laravel/tests/Feature/StoreInventoryApiTest.php
M	docs/adviser-improvements-changelog.md
M	frontend/src/components/Shoppers/ShopperAIrecommendations.jsx
M	frontend/src/components/Shoppers/ShopperBrowseProducts.jsx
M	frontend/src/components/Shoppers/ShopperCheckout.jsx
M	frontend/src/components/Shoppers/ShopperMyCart.jsx
M	frontend/src/components/StaffUpdates.jsx
A	frontend/src/components/Supervisor/SupervisorCategories.jsx
M	frontend/src/components/Supervisor/SupervisorStockApprovals.jsx
M	frontend/src/components/Supervisor/SupervisorSystemConfiguration.jsx
A	frontend/src/components/inventory/notifications/StockAlerts.jsx
M	frontend/src/components/inventory/product-management/ProductFormModal.jsx
A	frontend/src/components/inventory/product-management/ProductPhotoEditor.jsx
M	frontend/src/components/inventory/product-management/ProductTable.jsx
M	frontend/src/components/inventory/stock-management/StockForms.jsx
A	frontend/src/components/inventory/stock-management/StockReceivingWorkspace.jsx
M	frontend/src/components/inventory/stock-management/StockUpdateModal.jsx
M	frontend/src/components/inventory/stock-management/StockWorkspace.jsx
M	frontend/src/components/orders/OrderReceipt.jsx
M	frontend/src/components/orders/OrderWorkspace.jsx
A	frontend/src/components/shared/ProductImage.jsx
M	frontend/src/pages/inventory/ProductManagement.jsx
M	frontend/src/pages/inventory/StockManagement.jsx
M	frontend/src/services/api.js
A	frontend/tests/adviser-api.test.mjs
M	frontend/tests/inventory-api.test.mjs
```

### 50d4d05 feat: add guarded invoice drafts and scoped PDF reports

```text
A	backend/laravel/app/Http/Controllers/Api/InvoiceController.php
M	backend/laravel/app/Http/Controllers/Api/OrderController.php
A	backend/laravel/app/Http/Controllers/Api/ReportPdfController.php
M	backend/laravel/app/Http/Controllers/Api/TransactionRecordsController.php
A	backend/laravel/app/Services/DocumentPdf.php
M	backend/laravel/app/Services/OrderData.php
M	backend/laravel/composer.json
M	backend/laravel/composer.lock
A	backend/laravel/database/migrations/2026_11_13_000020_create_pro_forma_invoices.php
A	backend/laravel/resources/views/pdf/invoice.blade.php
A	backend/laravel/resources/views/pdf/report.blade.php
M	backend/laravel/routes/adviser.php
M	backend/laravel/tests/Feature/AdviserMigrationTest.php
A	backend/laravel/tests/Feature/AdviserOrdersDocumentsTest.php
M	docs/adviser-improvements-changelog.md
A	docs/invoice-and-payment-readiness.md
M	frontend/src/components/Supervisor/SupervisorInventory.jsx
A	frontend/src/components/admin/AdminStockReport.jsx
A	frontend/src/components/admin/InvoiceSellerSettings.jsx
M	frontend/src/components/inventory/stock-management/StockWorkspace.jsx
A	frontend/src/components/orders/InvoiceDocument.jsx
A	frontend/src/components/orders/OrderReferenceLookup.jsx
M	frontend/src/components/orders/OrderWorkspace.jsx
M	frontend/src/components/orders/TransactionRecords.jsx
A	frontend/src/components/shared/PdfExportButton.jsx
M	frontend/src/pages/admin/ReportModule.jsx
M	frontend/src/services/api.js
M	frontend/tests/adviser-api.test.mjs
```

### 8f9d883 refactor: unify role layouts and verify responsive workflows

```text
M	.gitignore
M	docs/adviser-improvements-changelog.md
A	docs/asset-sources.md
A	docs/ui-responsive-checklist.md
A	frontend/e2e/adviser-responsive.spec.js
M	frontend/package-lock.json
M	frontend/package.json
A	frontend/playwright.config.js
M	frontend/src/components/Shoppers/ShopperAIrecommendations.jsx
M	frontend/src/components/Shoppers/ShopperBrowseProducts.jsx
M	frontend/src/components/Shoppers/ShopperCheckout.jsx
M	frontend/src/components/Shoppers/ShopperHeader.jsx
M	frontend/src/components/Shoppers/ShopperMainContent.jsx
M	frontend/src/components/Shoppers/ShopperMyCart.jsx
M	frontend/src/components/Shoppers/ShopperMyProfile.jsx
M	frontend/src/components/Shoppers/ShopperNotifications.jsx
M	frontend/src/components/Shoppers/ShopperPaymentMethods.jsx
M	frontend/src/components/Shoppers/ShopperPickupInformation.jsx
M	frontend/src/components/Shoppers/ShopperSettings.jsx
M	frontend/src/components/Shoppers/ShopperSidebar.jsx
M	frontend/src/components/Supervisor/StaffAssignmentDialog.jsx
M	frontend/src/components/Supervisor/SupervisorHeader.jsx
M	frontend/src/components/Supervisor/SupervisorLayout.jsx
A	frontend/src/components/Supervisor/SupervisorPickupSettings.jsx
M	frontend/src/components/Supervisor/SupervisorProfile.jsx
M	frontend/src/components/Supervisor/SupervisorSidebar.jsx
M	frontend/src/components/Supervisor/SupervisorStoreWorkers.jsx
M	frontend/src/components/Supervisor/SupervisorSystemConfiguration.jsx
M	frontend/src/components/Supervisor/SupervisorUI.jsx
M	frontend/src/components/admin/AdminLayout.jsx
M	frontend/src/components/admin/StaffActionDialog.jsx
M	frontend/src/components/admin/StoreActionDialog.jsx
M	frontend/src/components/admin/StorePickupSettings.jsx
M	frontend/src/components/auth/ProtectedRoute.jsx
R086	frontend/src/components/Shoppers/registerForm.jsx	frontend/src/components/auth/RegisterForm.jsx
R093	frontend/src/components/Shoppers/registerHero.jsx	frontend/src/components/auth/RegisterHero.jsx
M	frontend/src/components/auth/loginForm.jsx
M	frontend/src/components/auth/loginHero.jsx
M	frontend/src/components/inventory/activity-log/ActivityLogTable.jsx
M	frontend/src/components/inventory/dashboard/StatCards.jsx
M	frontend/src/components/inventory/layout/InventoryLayout.jsx
M	frontend/src/components/inventory/layout/Sidebar.jsx
M	frontend/src/components/inventory/layout/Topbar.jsx
M	frontend/src/components/inventory/low-stock/LowStockStatCards.jsx
M	frontend/src/components/inventory/low-stock/LowStockTable.jsx
M	frontend/src/components/inventory/notifications/NotificationList.jsx
M	frontend/src/components/inventory/product-management/ProductFormModal.jsx
M	frontend/src/components/inventory/product-management/ProductStatCards.jsx
M	frontend/src/components/inventory/stock-update/StockProductSelection.jsx
M	frontend/src/components/inventory/stock-update/StockQuantityStep.jsx
M	frontend/src/components/inventory/stock-verification/VerificationStatCards.jsx
M	frontend/src/components/inventory/stock-verification/VerificationTable.jsx
M	frontend/src/components/public/CategorySection.jsx
A	frontend/src/components/public/GroceryIllustration.jsx
M	frontend/src/components/public/HeroSection.jsx
M	frontend/src/components/public/Navbar.jsx
A	frontend/src/components/shared/NavigationDrawer.jsx
A	frontend/src/components/shared/PickupSettingsWorkspace.jsx
M	frontend/src/index.css
M	frontend/src/pages/admin/AdminDashboard.jsx
M	frontend/src/pages/admin/RoleManagement.jsx
M	frontend/src/pages/admin/Settings.jsx
M	frontend/src/pages/admin/StaffManagement.jsx
M	frontend/src/pages/admin/StoreManagement.jsx
R068	frontend/src/pages/shopper/Register.jsx	frontend/src/pages/auth/RegisterPage.jsx
M	frontend/src/pages/auth/VerifyEmailPage.jsx
M	frontend/src/pages/inventory/InventoryProfile.jsx
M	frontend/src/pages/public/LandingPage.jsx
M	frontend/src/pages/shopper/ShopperDashboard.jsx
M	frontend/src/routes/AppRoutes.jsx
M	frontend/tests/adviser-ui.test.mjs
```

### Checkpoint 6 — final review and handoff

```text
M	backend/laravel/app/Http/Controllers/Api/DashboardController.php
M	backend/laravel/app/Http/Controllers/Api/InvoiceController.php
M	backend/laravel/app/Http/Controllers/Api/ReportPdfController.php
M	backend/laravel/app/Http/Controllers/Api/StockAdjustmentController.php
M	backend/laravel/app/Http/Controllers/Api/StockReceivingController.php
M	backend/laravel/app/Http/Controllers/Api/StoreCategoryController.php
M	backend/laravel/app/Http/Controllers/Api/StoreInventoryController.php
M	backend/laravel/app/Models/StoreInventory.php
M	backend/laravel/app/Services/BatchStock.php
M	backend/laravel/app/Services/CheckoutPricing.php
M	backend/laravel/app/Services/StockAlerts.php
M	backend/laravel/database/migrations/2026_11_13_000018_add_catalog_management.php
M	backend/laravel/database/migrations/2026_11_13_000019_add_stock_receiving_and_alerts.php
M	backend/laravel/database/migrations/2026_11_13_000020_create_pro_forma_invoices.php
M	backend/laravel/resources/views/pdf/report.blade.php
M	backend/laravel/tests/Feature/AdviserCatalogStockTest.php
M	backend/laravel/tests/Feature/AdviserOrdersDocumentsTest.php
M	backend/laravel/tests/mariadb-transaction-smoke.mjs
M	backend/laravel/tests/mariadb-transaction-smoke.php
M	docs/adviser-improvements-audit.md
M	docs/adviser-improvements-changelog.md
M	docs/module-progress-audit.md
M	docs/ui-responsive-checklist.md
M	frontend/e2e/adviser-responsive.spec.js
M	frontend/package-lock.json
M	frontend/src/components/Shoppers/ShopperSidebar.jsx
M	frontend/src/components/Supervisor/SupervisorStockApprovals.jsx
M	frontend/src/components/auth/RegisterForm.jsx
M	frontend/src/components/inventory/dashboard/StatCards.jsx
M	frontend/src/components/inventory/layout/Sidebar.jsx
M	frontend/src/components/inventory/layout/Topbar.jsx
M	frontend/src/components/inventory/product-management/ProductTable.jsx
M	frontend/src/components/shared/NavigationDrawer.jsx
M	frontend/src/components/shared/PickupSettingsWorkspace.jsx
M	frontend/src/services/api.js
M	frontend/tests/adviser-ui.test.mjs
A	backend/laravel/tests/adviser-data-fingerprint.php
A	docs/adviser-database-review.md
A	docs/ai-teammate-handoff.md
A	docs/dependency-audit.md
A	docs/manual-acceptance-checklist.md
A	frontend/src/components/inventory/product-management/ProductPriceHistory.jsx
```

### Landing follow-up file manifest

```text
M	backend/laravel/routes/adviser.php
M	docs/adviser-database-review.md
M	docs/adviser-improvements-audit.md
M	docs/adviser-improvements-changelog.md
M	docs/asset-sources.md
M	docs/manual-acceptance-checklist.md
M	docs/ui-responsive-checklist.md
M	frontend/e2e/adviser-responsive.spec.js
M	frontend/src/components/public/CategorySection.jsx
M	frontend/src/components/public/HeroSection.jsx
M	frontend/src/components/public/Navbar.jsx
M	frontend/src/pages/admin/StoreManagement.jsx
M	frontend/src/pages/public/LandingPage.jsx
M	frontend/src/services/api.js
A	backend/laravel/app/Http/Controllers/Api/StoreLocationController.php
A	backend/laravel/database/migrations/2026_11_13_000021_create_verified_store_locations.php
A	backend/laravel/tests/Feature/StoreLocatorTest.php
A	docs/category-image-prompts.md
A	docs/landing-page-and-store-locator.md
A	frontend/src/assets/categories/beverages.webp
A	frontend/src/assets/categories/dairy-eggs.webp
A	frontend/src/assets/categories/fruit.webp
A	frontend/src/assets/categories/meat-poultry.webp
A	frontend/src/assets/categories/vegetables.webp
A	frontend/src/components/admin/StoreLocationDialog.jsx
A	frontend/src/components/public/GoogleStoreMap.jsx
A	frontend/src/components/public/StoreLocator.jsx
A	frontend/src/services/googleMaps.js
A	frontend/src/services/storeLocator.js
A	frontend/tests/store-locator-ui.test.mjs
A	frontend/tests/store-locator.test.mjs
```
