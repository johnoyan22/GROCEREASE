# October 20 implementation sprint

Date: October 20, 2026 (Asia/Manila). Branch: `feature/multi-store-foundation`.
The local tree was clean when reviewed. Work was based on the local files, including
the October 19 pickup/preparation safeguards. No commit, push, merge, reset, working
database migration or seeding was performed.

## Phase 1: shared Shopper cart and Checkout

**Behavior implemented:** one account-keyed `useShopperCart` instance owns the cart
and authenticated selected-store catalog. Browse, My Cart, Header and Dashboard
observe it. Header and dashboard cart buttons open My Cart; adding/removing items
immediately updates quantities and catalog-price totals. Browse retains store
selection with confirmation before clearing another store's cart, search/category/
sort/details and stock/per-order limits. Header search opens Browse with the query.

My Cart shows the selected supermarket, product/category/size/SKU/barcode, current
catalog price, quantity, line subtotal, remove action, subtotal, empty state,
Continue Shopping and Proceed to Checkout. Unavailable catalog prices are labeled
unavailable, not displayed as a partial or fabricated total. No fee is invented.
Cart storage contains IDs/quantities only, under the existing account-specific key.
Changing the signed-in account remounts the workspace; another account's draft is
never loaded into its cart.

Checkout keeps the existing modal step, now titled **Checkout**, with required
store-hours-based pickup selection, payment selection, authoritative quote,
explicit final review and Confirm / Place Order. Clicking View Cart places nothing.
Uncertain checkout results retain their key; refresh recovers that order before
editing the cart. Successful placement clears the submitted cart once and refreshes
dashboard data. My Orders, History and Pickup Information now use actual orders;
notification messages and unread badge use recorded notifications.

**Files reviewed/changed:** `frontend/src/pages/shopper/ShopperDashboard.jsx`;
`frontend/src/hooks/useShopperCart.js`; `services/cart.js`, `services/checkout.js`,
`services/api.js`; `components/Shoppers/ShopperHeader.jsx`, `ShopperSidebar.jsx`,
`ShopperMainContent.jsx`, `ShopperBrowseProducts.jsx`, `ShopperMyCart.jsx`,
`ShopperCheckout.jsx`, `ShopperMyOrders.jsx` (reviewed), `ShopperHistory.jsx`,
`ShopperPickupInformation.jsx`, `ShopperNotifications.jsx`, `ShopperPaymentMethods.jsx`;
shared `components/orders/OrderWorkspace.jsx`. AI components and the existing AI
recommendation panel were deliberately left untouched.

**Endpoints:** reused authenticated store/catalog, pickup-hours, quote, order,
checkout-attempt, order-notification/read and cancellation endpoints. Quote/order
payment fields were extended in Phase 3; prices and stock still resolve in Laravel.
**Database migration:** none for the cart or COP UI.
**Automation:** cart/service regressions plus React/jsdom navigation, account/store
isolation, persistence, exact totals, header search, checkout schedule/review and
recovery tests pass. The jsdom checks are automated UI tests, not browser acceptance.

**Manual browser acceptance:** sign in to an existing verified Shopper; add two
units at one supermarket; compare Browse, Header, My Cart and Dashboard. Change a
quantity and remove an item. Navigate tabs, reload, sign out and sign in as another
Shopper. Confirm the second account starts with its own draft. Switch supermarket
with a nonempty cart and check both confirmation choices. Confirm View Cart does
not create an order. Select actual future pickup service hours, review and place
one COP order; check the cart clears and My Orders/Active Orders update. Refresh
after an interrupted placement and verify recovery returns the original order.
Test an over-PHP-1,500 COP cart and a stale price/stock quote rejection.

**Potential module-role improvements:** Shopper Automated Cart Management,
Checkout and Cart Processing, Product Catalog/Stock presentation, Order Tracking
and Pickup Verification access. Full module acceptance is still required.

## Phase 2: truthful dashboard statistics

**Endpoint created:** `GET /api/dashboard/summary`, authenticated and role checked.
Staff store identity is resolved from current approved assignment; client actor or
store filters are rejected. Missing schema and failed requests remain errors.

**Definitions:**

- Shopper Items in Cart sums quantities; cart total uses the loaded authenticated
  catalog. The summary counts only that Shopper's active orders and all unread
  notification records, with up to five recent active order summaries.
- Active orders are Waiting, Preparing or Ready, with an active reservation and
  `awaiting_preparation`/`claimable` claim state. Completed, canceled, No-Show,
  released and unclaimed-resolution records are excluded from that operating count.
- Inventory physical and reserved units are separate; available units equal
  physical minus reserved. Active product records, configured threshold alerts,
  pending Supervisor stock decisions, approved corrections today and recent
  availability/adjustment/report records are store-scoped.
- Supervisor counts active/preparing/ready orders, current available/busy personnel,
  stock approvals and schedule reviews only for the assigned supermarket.
- Admin registered users and role counts are real. Low stock requires an active
  inventory record, a configured threshold and available stock at/below it. Current
  COP restrictions exclude voided strikes and expired two-strike suspensions.
- Today's sales are gross verified supermarket payments **confirmed** within the
  current Asia/Manila calendar day (UTC half-open bounds), excluding completed
  refunds. This is not net settlement, profit or subscription revenue.
- Service Charge Pool is **Not configured**; SaaS subscription revenue is **Not
  available**. Growth percentages and sample financial/stock/COP records were removed.

**Files reviewed/changed:** backend `DashboardController.php`, `Order.php`, routes;
frontend `useDashboardSummary.js`, `DashboardLoadState.jsx`, the Shopper header/main
cards, `pages/admin/AdminDashboard.jsx`, `pages/inventory/InventoryDashboard.jsx`,
all six `components/inventory/dashboard/` widgets and staff header/notification
surfaces, `SupervisorDashboard.jsx`, `SupervisorContext.jsx`/layout/header. Existing
product/stock/stat APIs, worker definitions, COP restrictions and reporting schemas
were reviewed. Unused legacy mock-data exports are not imported by these screens.

All dashboards support loading, unavailable/error, zero/empty and explicit refresh.
Summaries also refresh on successful local API mutations, focus and a one-minute
timer. Staff message unread tracking is not configured; fake badges were removed.
The staff update view shows actual stock records and explains that limitation.

**Migration:** none for summaries. **Automation:** eight dashboard API tests cover
ownership, store isolation, approval/store revocation, real zeros, cancellation,
cash payment/completion refresh, threshold definitions, COP restriction correction,
all-unread count and Manila reporting boundaries. React tests cover Admin loading,
zero/error states and removal of sample growth/sales.

**Manual acceptance:** compare each role's cards to its existing operational pages.
Refresh after placement, cancellation, preparation and physical completion. For
Admin, distinguish a real cashier/provider payment from an unpaid order; compare
payment confirmation dates in Philippine time. For Store B staff, verify Store A
orders, personnel and stock changes never appear. Test API failure/retry and an
account without an active staff assignment.

**Potential points:** truthful data supports COP, stock, tracking/delegation and
Reports/Analytics review; dashboard cards alone earn no complete module-role point.

## Phase 3: PayMongo sandbox adapter

**Implemented, disabled on the working configuration.** No PayMongo environment
configuration was found (only variable-name presence was checked; secrets were not
printed). No provider request with a real merchant credential or charge was made.

The adapter uses backend-created Hosted Checkout sessions, stored order-item price
snapshots and integer PHP centavos. Wallet/card selections expose only configured
channels, and the approved prepaid holding setting is required. Digital quotes do
not inherit the COP ceiling; COP retains its PHP 1,500 limit and restrictions.
No raw card/wallet credentials or frontend paid claims are accepted.

`PAYMENT_GATEWAY_MODE` must be exactly `test`; live keys/mode fail closed. A merchant
configuration is explicitly keyed to one store; there is no fallback merchant.
Duplicate store assignments of the same merchant/key are rejected. The order and
one payment-attempt row commit with one reservation. A durable creation claim is
committed before the external POST; retries recover the same known session and do
not issue a second POST after an ambiguous result.

Paid confirmation verifies a timestamped HMAC over the raw webhook body, test-event
mode, replay identity/hash, store/merchant/attempt/session/reference metadata, and
retrieves the session under that store's bound test secret. The exact paid payment
amount, currency, channel and test mode must match. Payment evidence, Paid state,
attempt state and webhook receipt commit together. A browser return does not mark
anything Paid. Preparation/delegation is blocked while digital payment is unpaid;
Paid still requires preparation, valid QR/PIN/claimant verification and physical
handover. Existing 24/48-hour holding and COP No-Show safeguards remain.

**Reservation policy:** sandbox unpaid reservations expire after 15 minutes or the
pickup window start, whichever is earlier. The scheduler cancels/releases a Waiting
unpaid order only when no provider session was ever requested, or the provider
confirms its session expired without a paid/processing payment. Failed attempts can
reuse the same active hosted session. A cancel redirect alone is not cancellation.
Unknown creation, provider outage, paid/processing delays or configuration changes
preserve stock for reconciliation; the job reports those exceptions. These cases
need operator action and must not be treated as successfully expired.

`payments:reconcile-session ATTEMPT_UUID cs_ID` retrieves and verifies an uncertain
session using the authorized merchant configuration before binding it. It does not
mark payment Paid. The signed paid webhook must be delivered/re-delivered; an expired
unpaid recovered session can then pass normal expiration. No replacement payable
session is automatically created. A process interruption before/after a provider
POST therefore remains a visible reconciliation task, not an automatic duplicate.

**Files reviewed/changed:** `CheckoutController.php`, `CheckoutPricing.php`,
`PaymentEvidence.php`, `OrderData.php`, `OrderController.php`,
`WorkerAssignmentController.php`, new `PaymentCheckoutController.php`,
`PayMongoGateway.php`, `PaymentCheckout.php`, `PaymentCheckoutAttempt.php`,
`config/payments.php`, `.env.example`, API/console routes; frontend shared checkout,
payment-method view, `usePaymentOptions.js`, `OrderPayment.jsx`, API/recovery services.
`PickupController.php`, `PickupPolicy.php`, `PickupScheduling.php`, `OrderDeadlines.php`
and the order/payment schema were reviewed; their approved pickup policy is retained.

**Endpoints added:**

- `GET /api/shopper/stores/{store}/payment-options`
- `POST /api/shopper/orders/{order}/payment-session`
- `GET /api/shopper/orders/{order}/payment-session`
- `POST /api/payments/paymongo/test/{store}/webhook` (signed provider callback)

Quote/order endpoints accept a validated method/channel; they still reject
client-controlled prices, totals and paid/provider evidence. Digital cancellation
uses provider expiry before release. Commands: `payments:expire-unpaid --dry-run`,
`payments:expire-unpaid`, `payments:reconcile-session`; the expiration command is
scheduled every minute with overlap protection.

**Migration requiring approval, NOT APPLIED:**
`backend/laravel/database/migrations/2026_10_20_000015_create_payment_checkout_attempts.php`
adds `payment_checkout_attempts` and `payment_webhook_events`. No historical
migration was edited; no existing stock/price/order record is seeded or rewritten.
Hosted URLs are encrypted at rest. Event receipts store a hash/identity, not raw
provider payloads or billing/card data.

**Automation:** 18 sandbox tests use Laravel HTTP fakes with stray requests blocked.
They cover disabled/live/unconfigured paths, COP-vs-digital ceiling, snapshot amounts,
quote integrity, retry/reservation uniqueness, ambiguous POST recovery, exact signed
provider confirmation, wrong merchant/session/amount/currency/channel/test mode,
forged/stale/replayed events, failed payment, cancellation, processing delays,
dry-run/expiration/reconciliation and paid-order physical handover. Frontend tests
exercise COP/wallet/card selection with scheduling and API field restrictions.
These fixtures are not evidence of actual merchant/browser integration acceptance.

**Required setup:** privately populate backend-only `PAYMONGO_TEST_STORE_ID`,
`PAYMONGO_TEST_MERCHANT_ID`, `PAYMONGO_TEST_SECRET_KEY` (`sk_test_...`),
`PAYMONGO_TEST_WEBHOOK_SECRET` and enabled `PAYMONGO_TEST_METHODS`. The supplied
environment template configures one explicit store; additional stores require
their own authorized entries in the backend merchant mapping, never reused keys.
Keep credentials out of Git, chat output, logs and frontend environment variables.
Approve/apply migration 000015, confirm the store's actual operating/pickup hours
and 24/48-hour holding policy, register the publicly reachable HTTPS test webhook
for `checkout_session.payment.paid`, and run the Laravel scheduler.

Only after this setup should `PAYMENT_GATEWAY_MODE=test` be enabled and a genuine
hosted sandbox success, rejection, cancellation, delayed webhook, duplicate delivery
and expiration be checked. Compare the authorized account's real test response to
the validated resource fields. The adapter supports the documented event-resource
webhook envelope (`data.id`, `data.attributes`); an account using another envelope
must remain disabled until that envelope is validated and tested.

Primary provider references: [Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout),
[session lifecycle/expiry](https://docs.paymongo.com/docs/payment-channels-key-concepts),
[webhook signatures](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management),
[event resources](https://docs.paymongo.com/docs/developer-tools-webhooks-events),
[create v2](https://docs.paymongo.com/reference/create_checkout_sessions_2).
No undocumented provider idempotency guarantee is assumed.

**Potential points:** Payment/Transaction Management for Shopper/Supervisor/Admin
remains partial until real authorized sandbox and full module acceptance.

## Phase 4: non-AI gaps

**Implemented:** Admin User Accounts lists real accounts, filters and explicitly
activates/deactivates with a required reason/audit record. Self-deactivation is
blocked, simultaneous cross-admin changes serialize, inactive accounts cannot log
in or keep using authenticated APIs, and deactivation removes database sessions
and any stored access tokens. Account state is separate from supermarket status,
staff approval/assignment and COP restrictions. Provider webhooks still reconcile
existing payments for an inactive Shopper. Reactivation does not restore old tokens.

**Files/endpoints:** new `AdminAccountController.php`, `EnsureAccountActive.php`,
`pages/admin/AccountManagement.jsx`; auth/access checks, middleware bootstrap,
Admin routes/navigation and API helpers. New `GET /api/admin/accounts` and
`PUT /api/admin/accounts/{user}/status` require Admin authentication.

**Migration requiring approval, NOT APPLIED:**
`2026_10_20_000016_add_account_status.php` adds `users.account_status` defaulting to
active and `account_status_logs`. Existing account fields/approvals/store placement
are unchanged. The new page displays a setup error until the migration is applied.

**Reports and truthful pending settings:** Supervisor Sales Reports and Admin
Reports use verified payment/transaction records, Philippine date/store filters,
actual gross totals and existing completed receipt links. Refund review uses the
real guarded order-resolution workspace. Financial Setup states that markup,
service allocations, incentives and SaaS revenue are not configured; sample charges,
growth figures, report exports and fake approvals were removed. Supervisor profile/
logout headers resolve the actual assigned store instead of a hardcoded supermarket.
Transaction endpoints now exclude records lacking valid payment evidence.

**Files:** `TransactionRecordsController.php`, `TransactionRecords.jsx`,
`SupervisorSalesReports.jsx`, `SupervisorReturnRefund.jsx`, `SupervisorUI.jsx`,
`SupervisorProfile.jsx`, `SupervisorLogout.jsx`, Admin `ReportModule.jsx` and
`FinancialSetup.jsx`, `services/dates.js`. Existing receipt/preparation, stock,
COP reporting and staff password flows were reviewed.

**Automation:** three account-status tests and a staff own-account regression test
verify viewing/password changes with the current password, role guards, own-account
ownership, deactivation/reactivation, unchanged store/COP/approval and audit behavior.
The additive migration tests compare existing business columns/rows, verify
all three new tables are empty and check COP/dashboard compatibility before approval.
They run only in isolated in-memory SQLite.

**Manual acceptance:** after approval/application of migration 000016, use a second
existing test account to verify deactivation, rejected login/old session, activation
and new login. Confirm store status/approval/placement and COP records are unchanged;
test the own-Admin deactivation rejection. Test each staff role's profile/password
flow and confirm another account's password is unchanged. Compare report filters
to real payment confirmation dates and existing receipt access.

**Still incomplete/blocked:** product substitute logging requires the exact approved
substitution/Shopper-consent and price/refund treatment; none was invented. Staff
identity/contact self-edit acceptance remains unspecified, so existing view/password
scope stays provisional. Invoice issuance, tax/merchant fields and invoice acceptance
remain undefined; completed receipts continue to work. Full staff/Admin notification
delivery/read tracking, broad inventory/financial report exports, subscription
revenue, external refunds and worker incentives/payout remain incomplete. No
service-charge, markup, tip or payout formula was introduced. The legacy Admin Role
Management prototype is not claimed as completed functionality.

The official 17-module/40-role matrix in `module-progress-audit.md` was used. The
original PDF was not included in this workspace; this sprint does not claim a fresh
line-by-line acceptance of that original source. Potential improvements include
Admin Account Management, reports for Supervisor/Admin and Shopper notifications;
none receives a new completed point without complete module-role acceptance.

## Phase 5: verification and acceptance boundary

- Laravel: **337 passed, 5,436 assertions**, `php artisan test --compact`.
- Frontend: **102 passed**, `npm test`, including 11 React/jsdom behavior tests.
- ESLint and Vite production build: passed. Build retains the existing >500 kB
  chunk warning; this sprint did not undertake unrelated application code splitting.
- Added jsdom as a dev dependency; two vulnerable transitive packages were updated
  within their supported ranges. npm audit reports **0 vulnerabilities**.
- Prior stock, COP strikes/ban exceptions, preparation/delegation uniqueness,
  24/48-hour holding, QR/PIN, physical-handover and rollback tests still pass.
- No working MariaDB schema/records were changed. New migrations were exercised
  only on the tests' explicitly checked SQLite `:memory:` database. Actual MariaDB
  application/concurrency for these two new migrations remains pending approval.
- **Manual browser acceptance and an actual PayMongo merchant test have not been
  performed.** The checklists above remain pending. Automated success is not
  substituted for consultation/browser acceptance.

Conservative credited count remains **3/40 (7.5%)**. New credited points: **0**.
