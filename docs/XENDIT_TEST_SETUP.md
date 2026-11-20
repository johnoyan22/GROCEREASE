# Xendit TEST grocery checkout

This increment adds hosted Xendit Payment Sessions for one-time Philippine grocery checkout. It does not enable live payments, subscription charging, tips, incentives, payouts or refunds. A successful payment still requires preparation, Ready for Pickup, the existing QR/PIN verification and physical handover.

Use a verified Shopper and a store whose Supervisor has configured pickup windows and an approved 24/48-hour prepaid holding policy. Start with GCash. A configured development key is not proof of a working external connection; complete the manual checklist below.

## 1. Migrate the existing database

Open PowerShell at the repository root, `D:\Programming\GROCEREASE`:

```powershell
cd backend/laravel
& 'C:\xampp\php\php.exe' artisan migrate --path=database/migrations/2026_11_20_000001_pin_checkout_providers.php --force
& 'C:\xampp\php\php.exe' artisan config:clear
```

The additive migration pins all pre-existing checkout attempts to **PayMongo**, their actual original provider. It adds Xendit reference/request/capture IDs, verification evidence, observed requests and a durable session-event inbox. It does not rewrite amounts, orders, financial policies, bills, receipts or budgets. Never reset/reseed the working database, regenerate APP_KEY or use `migrate:fresh` for this setup.

New checkout defaults to Xendit. Existing PayMongo attempts keep their old key, merchant, mode, channels, verification path and callbacks even if new checkout is disabled or its selected provider changes. Retain the original PayMongo backend variables while those attempts need reconciliation. The old PayMongo selection remains available for compatibility/testing; this guide selects Xendit.

## 2. Configure one Xendit TEST business

In Xendit Dashboard, switch to **Test**. Generate a development secret API key with the Money-in/Accept Payments read/write permissions needed for Payment Sessions creation/read/cancellation, V3 payment/request reads and supported test simulation. Do not grant Money-out/payout permissions for this feature. Obtain the business ID and callback verification token in that test business. Dashboard entitlement/channel availability still determines whether a request succeeds.

Enter credentials directly in **`backend/laravel/.env`**, never in chat, frontend env, screenshots or committed files. Keep the existing APP_KEY. These are the configuration names; fill empty values locally:

```dotenv
# New selector and Xendit settings
PAYMENT_GATEWAY_PROVIDER=xendit
XENDIT_TEST_STORE_ID=
XENDIT_TEST_BUSINESS_ID=
XENDIT_TEST_SECRET_KEY=
XENDIT_TEST_WEBHOOK_TOKEN=
XENDIT_TEST_CHANNELS=GCASH

# Existing gateway mode: change disabled to test
PAYMENT_GATEWAY_MODE=test
```

`XENDIT_TEST_STORE_ID` is the existing GrocerEase store's numeric ID, not its name or the Xendit business ID. Bind this credential set to **one** selected store. The business ID must be the 24-character ID returned by Xendit for that business. Use the TEST development key, never a production key. Other stores retain COP and show digital unavailable. The token is compared in constant time on callbacks; it is not a PayMongo HMAC secret.

`GCASH` maps to the stable internal method `gcash`. The only additional implemented mapping is internal `card` to Xendit `CARDS`; add `CARDS` to the comma-separated list only when that channel is authorized and tested for this PH test business. Old PayMongo channel codes are not sent to Xendit. Null financial method settings mean configured methods; `[]` means none. Unsupported saved methods remain in history, produce an Admin warning, and do not enable extra channels. Review them explicitly in Financial Setup.

Financial Setup's Actual/Test selector scopes subscription and funding records. It does not switch gateway mode or create separate shopper fee policies. Fees remain OFF unless an Admin explicitly enables the store-wide policy with approval/reference and a reason. To test a fee, use an isolated store; 300 basis points means 3%, with integer half-up rounding and the optional cap. Existing accepted orders never reprice.

## 3. One public HTTPS origin for phone, sessions and callbacks

Xendit return URLs require HTTPS. Run Laravel and Vite locally, then expose **Vite** through one HTTPS tunnel. Vite proxies `/api`, `/sanctum`, and `/email/verify` to Laravel so email verification uses the same origin and session as login.

PowerShell window 1, from `backend/laravel`:

```powershell
& 'C:\xampp\php\php.exe' artisan serve --host=127.0.0.1 --port=8000
```

PowerShell window 2, after installing/authenticating ngrok locally if needed:

```powershell
ngrok http http://127.0.0.1:5173
```

Copy your assigned public HTTPS hostname. Do not use a `--host-header=rewrite` option. In **`frontend/.env`**, set these non-secret values:

```dotenv
VITE_API_URL=/api
GROCEREASE_DEMO_HOST=your-assigned-host.ngrok-free.app
GROCEREASE_TLS_CERT=
GROCEREASE_TLS_KEY=
```

Use the exact assigned hostname, without scheme, port, wildcard or path. Vite's `allowedHosts` is an explicit list, never `true`. The optional TLS certificate/key path variables already existed; leave both empty when ngrok terminates HTTPS and the local upstream is HTTP. Do not start Vite with a local HTTPS listener while telling ngrok its upstream is HTTP.

Update these existing backend origin/session settings and the new exact-proxy setting in **`backend/laravel/.env`**, replacing the example hostname:

```dotenv
APP_ENV=local
APP_DEBUG=false
APP_URL=https://your-assigned-host.ngrok-free.app
FRONTEND_URL=https://your-assigned-host.ngrok-free.app
SANCTUM_STATEFUL_DOMAINS=your-assigned-host.ngrok-free.app,localhost:5173,127.0.0.1:5173
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
GROCEREASE_TRUSTED_PROXIES=127.0.0.1,::1
```

The loopback addresses are the actual local Vite-to-Laravel proxy hop for this topology. Do not enter `*` or trust arbitrary remote proxies. Vite overwrites forwarding headers and treats a request as tunnel HTTPS only for the exact demo host arriving from the local tunnel agent. Laravel honors forwarded HTTPS only from the configured exact proxy IPs. The configured `FRONTEND_URL` is added as an exact CORS origin; CSRF, authentication and role checks remain enabled.

PowerShell window 3, from `frontend`:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

After backend env edits, run `php artisan config:clear` using the XAMPP PHP path above and restart Laravel. Restart Vite after frontend env edits. Open the public **HTTPS** login URL on both laptop and phone, preferably in a new private tab. Old HTTP cookies are separate. Do not use a phone URL pointing at `localhost`, a mixed-origin `VITE_API_URL`, or direct `:8000` API requests for this tunnel setup. For ordinary LAN HTTP work later, restore local origin/stateful values and set secure cookies false; Xendit itself still needs an HTTPS return origin.

## 4. Register the exact callback and run durable verification

In the same Xendit **Test** business, configure Payment Session notifications:

- `payment_session.completed`
- `payment_session.expired`

The endpoint shown in Financial Setup and used by this implementation is:

```text
/api/payments/xendit/test/{store}/webhook
```

Replace `{store}` with the same numeric `XENDIT_TEST_STORE_ID`, and prepend your HTTPS origin. For example, for a store whose actual ID is 1:

```text
https://your-assigned-host.ngrok-free.app/api/payments/xendit/test/1/webhook
```

No V3 notification subscriptions are required for this flow. The callback validates its token, business, store, PAY session identity, currency and amount before durably saving a minimal event. It acknowledges the receipt promptly without waiting for provider API calls. It does not assume a universal webhook ID or use the delivery timestamp/body hash as identity. Unknown authenticated sample events create neither orders nor payments.

**Keep the scheduler running** in PowerShell window 4, from `backend/laravel`:

```powershell
& 'C:\xampp\php\php.exe' artisan schedule:work
```

The existing scheduler now runs `payments:xendit-retry-events` every minute, processing up to 25 pending notifications per pass. No queue backend or separate queue worker was added. Failed provider verification remains durably pending and retryable. Existing unpaid-expiry processing continues, with provider/linked-request safety checks before any stock release. A Shopper's Refresh payment status also verifies the existing session directly, so returning to the order need not wait for the next scheduled pass.

To retry pending events immediately:

```powershell
& 'C:\xampp\php\php.exe' artisan payments:xendit-retry-events
```

An accepted notification is not payment evidence. GrocerEase reads `GET /sessions/{session_id}`, the linked `GET /v3/payment_requests/{payment_request_id}` and `GET /v3/payments/{payment_id}`. V3 calls use `api-version: 2024-11-11`. A completed PAY session must bind to this business, its frozen order reference, its actual linked request and payment, PHP, allowed channel, SUCCEEDED and one full automatic capture. The V3 payment reference must match its retrieved linked request; it may be provider-generated rather than identical to the Session reference. Money is parsed from exact JSON decimal tokens to centavos. Browser redirects, authorization-only results and simulation acknowledgements do not mark Paid.

## 5. Diagnostics, uncertain creation and simulation

An attempt UUID is stored before any provider creation POST. Locate it in the local database's `payment_checkout_attempts` row for the existing order, or use your local database browser. Do not expose database/admin tools publicly through the tunnel.

These commands show safe identifiers/state, never keys, callback tokens, full provider payloads, customer wallet details or hosted URLs:

```powershell
# Local state only; read-only
& 'C:\xampp\php\php.exe' artisan payments:xendit-status YOUR_ATTEMPT_UUID

# Retrieve and reconcile provider evidence for that same attempt
& 'C:\xampp\php\php.exe' artisan payments:xendit-status YOUR_ATTEMPT_UUID --refresh

# If creation timed out, recover the ORIGINAL session ID from the authorized
# Xendit Test dashboard/API logs using this attempt's reference_id.
& 'C:\xampp\php\php.exe' artisan payments:reconcile-session YOUR_ATTEMPT_UUID ORIGINAL_ps_SESSION_ID
```

Never invent a session ID or submit another payable session to work around a timeout. An unknown creation result stays `reconciliation_required`; cancellation/expiry does not release its stock without recovery. If no original session can be established, retain it for authorized provider/manual reconciliation. Changing a database row to Paid, clearing an attempt or blindly retrying `POST /sessions` is not a recovery procedure. Keep the original business credentials available; changing them makes reconciliation fail closed.

For an existing active correctly bound TEST attempt, open the hosted link and select GCash first. This creates the actual linked request. Then, if supported by the channel/business, run:

```powershell
& 'C:\xampp\php\php.exe' artisan payments:xendit-simulate YOUR_ATTEMPT_UUID
```

The local/testing-only CLI retrieves the session and its real linked request, validates ownership/state, and calls `POST /v3/payment_requests/{payment_request_id}/simulate` with `api-version: 2024-11-11`. It refuses foreign, unlinked, terminal/live attempts and production application environments. Its response is **PENDING**, not Paid. Actual provider reads/webhook processing must subsequently establish capture. A channel may instead provide its own hosted test controls; if simulation is unsupported, use that documented flow or contact Xendit. There is no public simulation route and no manual Mark Paid action.

| Local state | Meaning / action |
| --- | --- |
| `pending` | Attempt stored; no creation POST has been claimed. |
| `creating` | A single creation POST was claimed. Repeated clicks do not create another. |
| `pending_payment` | Hosted TEST session exists. Pay using the same link. |
| `failed_attempt` | Provider reports a failed attempt within the same session; follow the existing hosted flow while active. |
| `awaiting_confirmation` | Linked authorization/payment needs completed-session/capture confirmation. Refresh/retry verification. |
| `reconciliation_required` | Creation outcome is uncertain; use original-session recovery. |
| `expired` / `canceled` | Session ended. Order stock is released only after safe provider closure, not because the browser closed. |
| `paid` | Server verified the full captured amount; preparation and handover still follow. |

If a linked request/payment can still succeed, cancellation/expiry preserves reserved stock for reconciliation. Observed request IDs are retained and checked. A verified late capture on an already closed order records the received payment and sets payment-review status; it never reopens the order or promises released stock. No refund is executed. Duplicate/out-of-order events cannot duplicate payment, deduction or handover.

Troubleshooting:

- **Digital unavailable:** check test mode, development-key prefix, exact store/business binding, nonempty channel configuration, financial method policy, HTTPS frontend URL and the Supervisor's prepaid holding policy. Settings show local configuration, not a fabricated verified connection.
- **Session creation rejected/uncertain:** inspect Xendit Test API logs privately for key permissions, channel eligibility or request validation. Do not expose response bodies/credentials in screenshots. Recover the same reference/session.
- **Too little time remains:** a new session needs at least ten minutes; the implementation keeps a 30-second transport margin within the existing stock/pickup deadline. It does not extend reservations. Safely cancel and choose a later window.
- **Returned but still pending:** refresh the existing order; check scheduler, callback URL/token/business, event inbox and provider request/capture status. A redirect alone proves nothing.
- **Login/419 on phone:** use the same public HTTPS origin for frontend, `/api` and `/sanctum`, exact stateful host, correct secure host-only cookies, and a fresh tab after origin changes. Do not disable CSRF or set wildcard CORS/proxies.
- **Callback sample acknowledged but no payment:** unknown samples are ignored; a real stored attempt and matching provider capture are required.

## 6. Checks and manual acceptance

From `backend/laravel`:

```powershell
& 'C:\xampp\php\php.exe' artisan test --compact
node tests/mariadb-xendit-smoke.mjs
```

From `frontend`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
node tests/xendit-browser-smoke.mjs
```

Automated provider cases use realistic HTTP fakes, not an actual Xendit transaction. The MariaDB test uses only a disposable random-name schema, never the working schema. Real external verification remains pending until an authorized development business, callback/tunnel and hosted channel complete the following:

1. Confirm a second, unbound store still offers COP and no digital payment. Confirm one correctly bound store offers GCash / Xendit (Test).
2. As Shopper, review a future pickup window and fee-inclusive total. Confirm the order once; the page prepares one payment link. Use **Pay with Xendit (Test)** in the same tab.
3. Select GCash, complete the supported hosted simulation or use the linked-request CLI simulation. Return to the existing order. Confirm Paid appears only after provider verification.
4. Disable the store method or fee after acceptance; confirm that this accepted order keeps its amount/method while new affected quotes are blocked/stale. Restore settings intentionally after the check.
5. Assign/prepare through the usual staff screens, mark Ready, verify the existing QR/PIN and explicitly confirm physical handover. Confirm Completed and exactly one stock deduction. Payment alone must not complete pickup.
6. Generate payment and financial reports/PDFs. Xendit is TEST/SANDBOX, never Actual or Legacy. Service-fee components stay separate from subscriptions, incentive funding and profit.
7. Test an unpaid expiry/cancel and a repeated callback. Pending/uncertain provider work must retain its reservation; confirmed closure may release it once.

## UI backlog (deferred)

Replace growing store/product selectors with searchable comboboxes backed by server search, bounded results and accessible keyboard navigation. Add server pagination, search and relevant filters to growing tables; Financial Setup currently loads every store in its selector. This integration does not add another dashboard or redesign those controls.

## Code map and official contracts

- Provider/configuration: `config/payments.php`, `app/Services/PaymentGateways.php`, `XenditGateway.php`, `XenditMoney.php`; legacy `PayMongoGateway.php` remains pinned.
- Lifecycle/evidence: `XenditCheckout.php`, `PaymentCheckout.php`, `PaymentEvidence.php`, `PaymentCheckoutAttempt.php`, `XenditWebhookController.php`, payment routes and scheduled CLI commands.
- Integration: checkout pricing/quote hash, financial settings validation/UI, order payment/return UI, centralized report mode classification, Vite proxy and exact trusted-proxy/origin configuration.
- Migration: `2026_11_20_000001_pin_checkout_providers.php`.

Reviewed official contracts: [create session](https://docs.xendit.co/apidocs/create-session), [get session](https://docs.xendit.co/apidocs/get-session), [cancel session](https://docs.xendit.co/apidocs/cancel-session), [V3 payment](https://docs.xendit.co/apidocs/get-payment), [V3 request](https://docs.xendit.co/apidocs/get-payment-request), [session notifications](https://docs.xendit.co/apidocs/webhook-notification-sent-defined-webhook-url-updates-payment-session), [test simulation](https://docs.xendit.co/apidocs/simulate-payment-test-mode), [GCash](https://docs.xendit.co/docs/gcash), [pre-integration](https://docs.xendit.co/docs/payments-integration-setup), [webhooks](https://docs.xendit.co/docs/handling-webhooks), [Vite allowed hosts](https://vite.dev/config/server-options.html#server-allowedhosts), [Laravel trusted proxies](https://laravel.com/docs/12.x/requests#configuring-trusted-proxies).
