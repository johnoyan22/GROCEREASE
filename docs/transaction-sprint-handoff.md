# Groupmate handoff: connected transaction sprint

Branch: feature/multi-store-foundation, after baseline 0bcc621.
The sprint work belongs to this branch. Consult its Git history for the publication commit; preserve the implementation when integrating teammate changes.

Working implementation covers stock corrections/approvals and reporting; Shopper store catalog/cart;
scheduled unpaid COP Checkout; own-Shopper/current-store tracking; non-login workers and one-order delegation;
item preparation checklist/review; QR/PIN verification, cashier evidence and once-only physical handover;
closing/holding deadlines, COP strikes and corrections, resale disposition and pending refund review;
real payment records and completed receipt printing.

Evidence: 288 Laravel cases / 4,471 assertions, 80 Node client/cart cases, all 45 changed frontend files linted,
production build passed. A temporary MariaDB database also passed all migrations and actual concurrent
reservation, worker assignment and handover scenarios. User browser acceptance is still pending.

## Database handoff

- 000007/000008 stock migrations were applied locally with explicit approval; existing business records were preserved.
- 000009–000013 transaction migrations were applied to local grocerease MariaDB on October 19, 2026, with explicit approval. Before/after original-column hashes and counts matched for all 11 existing business tables; all 17 new tables were empty. Store settings remain null and no seeds ran.
- Follow pending-transaction-migrations.md; do not modify already-applied historical migrations.
- Admin configures actual per-store weekly hours before Checkout can operate. Paid holding has no silent default; select an approved 24 or 48 hours.
- Business schedule/deadline dates are explicit UTC DATETIME values; frontend displays Asia/Manila.
- The deadline job is registered every minute in routes/console.php. Run a backend scheduler in deployment.
  The consultation command is php artisan orders:process-deadlines --dry-run; the command without --dry-run classifies eligible records.

## Contracts that must remain stable

- Four auth roles: shopper, inventory_worker, supervisor, admin. Existing User/Role/Profile + Sanctum/CSRF architecture remains.
- Workers are plain non-login store personnel. No fifth role, credentials or authentication model.
- Store ownership is resolved and checked in Laravel. Do not accept frontend actor IDs, role, stock counts, price totals or paid claims as authority.
- Physical includes reserved units; available = physical − reserved. Every physical/reservation movement increments stock_version.
- A cart has one store. Checkout inputs are store_id, items[{store_inventory_id, quantity}], pickup_date (YYYY-MM-DD), pickup_start/end (HH:mm, Philippine local).
- Quote adds encrypted quote_token. Explicit placement adds UUID idempotency_key. Price changes require a new review; uncertain responses recover the existing attempt before a new submission.
- COP creation reserves soft stock only and remains unpaid. Waiting cancellation releases reserved units once.
- Order stages: waiting → preparing → ready_for_pickup → completed; initial cancellation produces canceled.
- One active order per non-login worker and one responsible active worker per order are enforced in active_worker_assignments.
  Historical worker_assignments remain after reassignment/completion/cancellation.
- Inventory Worker records the actual checklist. Supervisor reviews preparation and separately authorizes final pickup.
- QR/PIN is required for all supported order payment paths. It is not proof of identity or payment.
  Supervisor records an in-person claimant check without a representative-registration/ID-image module.
- Cash evidence, trusted provider evidence, claimant verification and physical handover are separate.
  Completion must atomically consume the credential, fulfill the reservation and deduct physical/reserved units once.
- COP closing deadlines use actual store configuration. Paid holding starts from the later of selected-window end and actual Ready.
- No-Show strikes affect COP only: warning, 30-day ban, permanent ban. Admin corrections preserve history.
- Do not blindly release prepared/unclaimed reservations. Confirm physical resale suitability, and retain prepaid goods/payment pending reconciliation/refund decisions.

## Integration boundaries

No external digital/debit payment integration is implemented. The shared schema/guards accept only trusted
provider evidence for such records; fixture-based tests do not establish a working gateway.
Do not revive a frontend Verify Payment button that marks digital payments paid.

Service-fee percentage/cap/distribution remain pending partner approval. Current charge is zero.
Do not add a hidden product markup, platform grocery-sales commission, automatic worker incentive credit,
GCash/bank transfer or platform wage obligation. Subscriptions remain separate.

Actual financial refunds, full invoice requirements, Admin account activation, broad financial/reporting modules
and complete multi-role notifications remain incomplete. Do not present their unrelated prototypes as integrated.
The completed receipt uses stored purchase-time prices and existing payment/handover records.

Avoid overwriting CheckoutController, CheckoutPricing, OrderController, OrderData, PickupScheduling,
PickupPolicy, PickupController, OrderDeadlines, CopRestrictions, WorkerAssignmentController, WorkerDelegation,
the new models/migrations/tests, ShopperCheckout, OrderWorkspace/Preparation/Pickup/Resolution/Receipt,
TransactionRecords, StorePersonnel, StorePickupSettings, stock workspaces/hooks, and shared API/cart/attempt services.
SupervisorContext no longer owns mock orders, workers, stock decisions or payment verification.

AI/Habel, owner functionality and deferred profile enhancements were not touched.
The source PDF's obsolete SuperAdmin and auth-linked worker concepts must not be reintroduced.
See feature-7-to-10-transactions.md for manual acceptance and transaction-sprint-study-guide.md for defense preparation.
