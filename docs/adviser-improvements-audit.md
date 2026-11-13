# Adviser improvements audit

Audit date: 2026-11-13 (Asia/Manila). Base: `feature/ai-integration`,
`b611ae33636556bee59ab85c75801a539a803d90`. Clean working tree; fetched origin;
no newer commits on the integration reference. Work branch: `feature/adviser-improvements`.

## Existing implementation and decisions

| Area | Existing evidence | Required change |
| --- | --- | --- |
| Authentication | `frontend/src/components/auth/loginForm.jsx`, `components/Shoppers/registerForm.jsx`; `backend/laravel/routes/api.php` | Remove disconnected Google buttons and Forgot Password placeholder. No Google OAuth route exists. Preserve email verification and role redirects. |
| Profile | `ShopperProfileController.php`, `ShopperMyProfile.jsx`, `profiles.imagesrc` | Reuse own-profile update; separate authenticated photo endpoint and private storage; immutable contact/verification fields. |
| Staff identity | `inventory/layout/Topbar.jsx`, `SupervisorHeader.jsx`, staff profiles | Shared initials avatar; Admin retains identity-edit authority. |
| Settings | `ShopperSettings.jsx`, staff headers | Remove unsaved preference toggles, disabled cart/global search. Preserve password APIs and Supervisor configuration. |
| Catalog | `StoreInventoryController.php`, `Product.php`, `ProductFormModal.jsx` | Backend SKU, store categories, selling unit, photos, price audit. Existing store/SKU unique constraint retained. |
| Stock | `StockAdjustmentController.php`, `StoreInventory.php` | Preserve approved absolute corrections, integer stock, version locks. Add approved batch receiving/import; reuse `low_stock_threshold` as reorder level. |
| Checkout | `CheckoutPricing.php`, `CheckoutController.php` | Existing authoritative quote, explicit stale-price review, atomic reservations and historical order prices retained. Add historical selling unit and batch safety. |
| Orders | `OrderController.php`, `OrderWorkspace.jsx` | Add assigned-store reference lookup without changing verification/handover guards. |
| Receipts/payments | `TransactionRecordsController.php`, `PayMongoGateway.php`, `PaymentCheckout.php` | Keep receipts and test-only adapter. Add separately identified pro forma invoice and scoped PDF reports. |
| AI | `routes/habel.php`, `Services/AiRecommendation/*`, `ShopperAIrecommendations.jsx`, `SupervisorAiSettings.jsx`, migration 000017 | Preserve provider and all store/cart logic. Accurate setup-unavailable handling only. No provider credentials or real API test. |
| Responsive UI | `ShopperDashboard.jsx`, Shopper header/sidebar, `index.css`, public landing components | Shared tokens; phone drawer; mobile forms/cards; contained staff tables. Preserve role navigation. |

## Module alignment

Use the existing 40-combination matrix in `module-progress-audit.md`. The source
module PDF is not available in this checkout. Do not invent incentive, tax,
financial or self-service staff identity rules. CSV receiving remains subject to
Supervisor approval and must never overwrite counts. Added automation is not
full module acceptance.

## Safety boundaries

- No working-database migration, reset, seed, `.env` change, push, merge or branch deletion.
- Historical migrations, especially AI 000017 and payment 000015, remain intact.
- Additive migrations are reviewed and tested in disposable SQLite and MariaDB.
  The working database is inspected through read-only queries only.
- Legacy stock stays physically counted. Untracked stock remains explicitly legacy;
  expired/quarantined batch quantities reduce sellable stock, never silently hard stock.
- Invoices remain Draft / Pro Forma until partner legal/tax/numbering authorization is confirmed.
- Real Gemini/PayMongo acceptance and human acceptance remain separate from automated checks.

## Baseline

- Frontend: 113/113 tests; ESLint passed; Vite build passed (existing chunk-size warning).
- Backend baseline: 357 passed / 5,957 assertions (disposable SQLite).

## Final audit findings

- Checkpoints 1–5 are recorded as separate local commits; final regression and
  handoff are recorded in checkpoint 6. No merge/push/branch deletion or `.env` change.
- Current working status (read-only): AI 000017 applied; payment 000015,
  account-status 000016 and adviser 18–20 pending. New schema is not live yet.
- Added `StoreCategoryController`, `ProductPhotoController`,
  `StockReceivingController`, `StockAlertController`, `InvoiceController`,
  `ReportPdfController` under `backend/laravel/app/Http/Controllers/Api/`;
  routes are in `backend/laravel/routes/adviser.php`.
- Batch safety/FEFO and persistent episodes live in
  `backend/laravel/app/Services/{BatchStock,StockAlerts}.php`; printable PDFs in
  `app/Services/DocumentPdf.php` and `resources/views/pdf/`.
- Original migrations through 000017 are preserved. New 18–20 are additive;
  disposable MariaDB testing corrected their audit date-column compatibility
  and verified current-read duplicate guards under real concurrency.
- Price history is available in the shared catalog table and scoped API. Unit
  snapshots and existing authoritative price review protect historical orders.
- Nonfunctional Google/reset, Shopper/Admin preference toggles, staff search/cart,
  invented dashboard products/role counts and public store claims were removed.
  Existing password, account/staff-management and Supervisor operational/AI APIs remain.
- Registration files now live in `components/auth/` and `pages/auth/`.
  `components/shared/PickupSettingsWorkspace.jsx` owns one implementation;
  Admin/Supervisor wrappers retain their original permissions and URLs.
- Browser tests (`frontend/e2e/adviser-responsive.spec.js`) use real rendered
  pages and labeled fixtures; Laravel/MariaDB tests cover persistence and locks.
  No physical-device, Gemini/PayMongo or human full-module acceptance is claimed.
- Remaining dependencies are explicit in the manual checklist, database review,
  invoice/payment readiness and Gemini handoff. Accepted module points stay 3/40.
- Final verification: 381 Laravel tests / 6,527 assertions, 125 frontend tests,
  ESLint, production build and 29 Chrome cases pass. Six disposable MariaDB
  concurrency scenarios pass; read-only comparison preserves all 31 working
  business tables. Composer/production npm audits are clean; seven moderate
  development-tool findings remain documented in `dependency-audit.md`.
