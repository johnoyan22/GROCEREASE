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
