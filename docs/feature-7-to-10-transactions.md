# Features 7–10: scheduled checkout, preparation and pickup

Implementation: October 19, 2026, `feature/multi-store-foundation` after `0bcc621`.
Code and automated checks are ready. Approved MariaDB migrations 000009–000013 are applied. Supervisor settings migration 000014 is also applied with explicit approval; original-column hashes/counts matched across 28 business tables. User browser acceptance of this revision remains pending.
See `pending-transaction-migrations.md` for the application record: 11 existing business tables preserved and 17 empty new tables confirmed.

## Connected workflow

1. The assigned Supervisor configures actual weekly store and pickup-service hours in System Configuration. Admin retains read-only store/audit oversight. No universal closing time is supplied.
2. Verified Shopper chooses a store, adds its products, and selects a future pickup date/start/end within that store's hours.
3. Laravel quotes current prices, stock, limits, schedule and the ₱1,500 COP ceiling. A review token expires after ten minutes; this is not a pickup deadline.
4. Explicit Checkout creates one unpaid COP order, price snapshots, status history and reserved units atomically. Cart and quote reads never reserve stock.
5. Same-store Supervisor assigns an Available non-login worker. One active worker assignment per order and one active order per worker are enforced in Laravel and database keys.
6. Supervisor starts Preparing. Inventory Worker records the actual digital item checklist. Supervisor reviews the completed checklist and finishes the worker task. This frees the worker without completing or paying the order.
7. Marking Ready atomically records the actual Ready time, claim deadline and secure QR/PIN. The authenticated purchasing Shopper can display it.
8. Supervisor checks the actual claimant in person under supermarket procedure, verifies the PIN or scanned QR token, and records the claimant name/check confirmation. An authorized representative may present the Shopper-shared code without advance registration.
9. For COP, Supervisor records the cashier name, cash-collection confirmation and evidence reference. This marks payment paid; it does not hand over the order.
10. Confirmed payment plus verified claimant plus an explicit physical-handover confirmation complete the order. Physical and reserved units decrease once, the credential is consumed, and separate payment/verification/handover records remain.
11. Shopper/Supervisor can view a completed receipt; Admin/Supervisor can view actual transaction records. Receipt prices come from the purchase snapshots.

GrocerEase adds no product markup. Service fees remain **zero / pending partner approval**.
No sales share, worker credit, payroll transfer or platform wage obligation is created.

## Deadlines, restrictions and reconciliation

- COP credentials expire at the saved store closing time on the scheduled pickup date. Claiming still requires an active store and current pickup operating hours.
- An approved Supervisor reschedule validates a new future window and retains an audit record. For Ready orders it revokes the old credential and issues a replacement. A verified claimant requires reconciliation rather than an ordinary reschedule.
- `orders:process-deadlines` classifies eligible unpaid COP No-Shows once per order. It skips unprepared/canceled/released orders, preparation after the selected window, missing/changed closing configuration, inactive stores, a recorded pickup suspension, and orders with an in-person claimant check or payment evidence. Those exceptional orders need store review.
- First valid COP strike: warning. Second: COP unavailable for 30 days from that strike. Third: permanent COP restriction. Checkout checks the current restriction in Laravel. The Shopper account stays usable; corrected records remain in history and eligibility is recalculated.
- The deadline command does **not** automatically return prepared goods to sale. Supervisor must physically confirm that **all** reserved goods are suitable for resale. That disposition releases reserved units once and leaves physical stock unchanged. Mixed damage/spoilage cases remain held for an authorized physical reconciliation; this initial workflow does not invent a new stock-loss operation.
- Paid orders never receive COP strikes. For a verified prepaid order, the assigned Supervisor explicitly selects the store-approved 24 or 48 holding hours. The deadline starts from the later of pickup-window end and actual Ready time. No default is selected. Already-issued deadlines stay unchanged when this setting changes.
- Expired paid orders become `unclaimed_pending_resolution`; payment and reservations remain. Supervisor can request an audited refund review. No endpoint executes a refund, declares one successful, silently keeps funds as earned, or authorizes prepaid goods for resale.
- Digital payment is a future provider integration. The shared lifecycle requires trusted provider evidence and a provider reference for such records. No public API or frontend button can declare a digital payment successful. Automated provider fixtures test the shared guards; they are not a working gateway.

The five approved main statuses remain `waiting`, `preparing`, `ready_for_pickup`, `completed`, `canceled`.
Separate `claim_status` records No-Show / unclaimed resolution without mislabeling payment or physical handover.
Business dates are stored as UTC `DATETIME` values and API ISO timestamps; displays explicitly use `Asia/Manila`.
The current hours editor supports one same-day store interval and one pickup-service interval per weekday, plus suspended dates. Pickup service must be within store hours. Split/overnight intervals are not implemented. Late COP claiming must occur during permitted pickup service; the No-Show cutoff remains the saved store closing time.

Changing hours flags active orders on affected weekdays for review without rewriting their approved window, deadline, payment or inventory. Suspension dates flag that date's active orders. Review uses the existing reasoned Supervisor reschedule flow. Flagged COP orders cannot receive an automatic strike; expired/struck/verified orders cannot be silently revived. See supervisor-pickup-settings.md for the current detailed checklist.

## Exact browser acceptance

Use separate browser profiles for Shopper, Inventory Worker A, Supervisor A and Supervisor B. All checks below remain **pending user acceptance**.

### Supervisor setup and Admin oversight

1. With migration 000014 applied, Supervisor A opens **System Configuration → Store Operating Hours & Pickup Scheduling**. Enter actual store and pickup-service hours. Leave paid holding unconfigured unless that store has approved 24 or 48 hours. Save, reopen and refresh: settings must persist.
2. Attempt a closing time before opening, a missing time on an open day, or 36 holding hours: validation must fail. No setting should partially save.
3. Supervisor B configures Store B independently. Admin → Store Management → View pickup settings shows each store's settings and change audit without editing controls. Existing products, staff placements and quantities must remain unchanged.
4. Supervisor/Shopper requests to `/api/admin/stores/{store}/pickup-settings` must fail with 403.
5. To record a genuine pickup suspension, Supervisor enters its date and required reason in System Configuration. The date blocks new windows/claims and suppresses automatic COP strikes. Existing affected orders need review; erroneous strikes already issued still require Admin correction in **COP Management**.

### Shopper Checkout and recovery

1. As an email-verified Shopper, open **Browse Products**, select Store A, add an available item within its per-order limit, then choose **Review Cash on Pickup order**.
2. Select a pickup date and start/end within the displayed actual store hours. Choose **Review current prices and pickup schedule**. Verify unit prices, centavo totals, Philippine-local schedule, closing deadline and fee ₱0.
3. Try yesterday, a closed/suspended date, an end before start, and an out-of-hours interval: Laravel must reject the review. Unconfigured stores cannot accept Checkout.
4. Place the order. Expect a real order ID, `waiting`, `unpaid`, and an active reservation. In staff stock, physical stays the same; reserved increases by the ordered units. Refresh **My Orders**: the same order and schedule persist.
5. Double-click placement / retry the same saved attempt after an interrupted response. Expect one order and one reservation. The UI checks the original attempt before allowing a new submission after an uncertain result.
6. Change the product's price in an Inventory Worker session after the review. Placement must fail with 409; require explicit updated review. It must not silently raise the price or create a partial order.
7. With another Shopper, consume the last available units after the first quote. The first Shopper's later placement must reject insufficient stock. A quote is not a reservation.
8. Test exactly ₱1,500 and above ₱1,500 COP totals. The former is allowed if stock/limits permit; the latter is rejected. A manipulated frontend total or `payment_status=paid` must not be accepted.
9. Cancel a separate unpaid Waiting order with a reason. Reserved units release once; physical stays unchanged. Repeating cancellation fails with 409. Once Preparing, Shopper cancellation fails.
10. Shopper B cannot read Shopper A's order, pickup credential, notification or receipt. Signed-out calls return 401; unverified/wrong-role calls fail authorization.

### Store Workers, preparation and tracking

1. Supervisor A opens **Store Workers → Pickers & Packers** and registers a person. Refresh: the worker persists. No email, password, new role or login account should appear.
2. Open **Orders** or the Supervisor dashboard. Assign the worker to the Waiting order. Expect worker name and Busy / assigned order information. Supervisor B must not see the order/worker.
3. Create another order. Attempt to assign the same Busy worker: expect 409 and one active assignment. Attempt to deactivate that worker: expect 409.
4. Assign a different Available worker to the first order with a reassignment reason. Previous assignment remains canceled in history; the replacement is active. Missing reason fails.
5. Choose **Start preparing**. Status and history persist after refresh. Skipping directly from Waiting to Ready fails. A Waiting order with no worker cannot start preparation.
6. Inventory Worker A opens **Store Orders** and records actual prepared quantities, then **Save item checklist**. Partial preparation is allowed; quantities above the order are rejected. Foreign order items must fail without partial saved changes.
7. Supervisor A sees the saved checklist, enters a review note, and chooses **Confirm preparation complete and free worker**. Worker becomes Available; payment remains unpaid and stock remains reserved. Repeating task completion fails.
8. Choose **Mark ready for pickup**. A real credential and deadline are generated together. Refresh Shopper **My Orders**: the schedule and Ready status match. Use the upcoming-order filter and refresh to review scheduled work.
9. Check Store B, inactive store, removed approval and transferred Supervisor sessions. Old-store operations must fail. Store A's records must not move to Store B.

### QR/PIN, cash, physical handover and receipts

1. Shopper opens **My Orders → Show QR / pickup PIN**. Both representations must display for that order, with the claim deadline. No credential should be present in a general order list or receipt.
2. Supervisor opens the same Ready order during store pickup hours. Try a wrong PIN / another order's QR: reject. After five attempts in one minute, expect 429; wait before retrying.
3. Verify the correct PIN, or select **Scanned QR token** and scan the displayed QR with a scanner that enters text into the field. This is scanner input; an embedded camera scanner is not included. Check the actual claimant under store procedure, enter their name and tick the in-person check confirmation.
4. A representative can present the Shopper-shared QR/PIN. No advance registration, ID image upload or authorization-letter module is required. The in-person claimant check still applies.
5. Verification alone must leave payment unpaid and prevent final release. Confirm the cashier actually collected cash; enter cashier name and receipt/confirmation reference. Payment becomes paid, while status remains Ready until handover.
6. Choose **Record physical handover and complete** only after actual handover. Expect Completed, fulfilled reservation, physical and reserved quantities decreased exactly once, consumed credential and separate audit records.
7. Retry verification, payment and handover for that order: no duplicate payment, stock deduction or release record. Store B Supervisor must receive 404 / be denied throughout.
8. Shopper and Supervisor choose **View / print receipt**. Verify store, order, transaction, purchase-time prices, fee and paid total. Refresh and open it again: no new transaction is created. Print preview is a manual acceptance check.
9. Supervisor opens **Transactions**; Admin opens **Transactions**. A sees only A, B sees only B, Admin sees permitted platform records. An unpaid or merely Ready order cannot have a final completed receipt.

### Deadline command, No-Shows and paid holding

From `backend/laravel`:

```powershell
php artisan orders:process-deadlines --dry-run
php artisan orders:process-deadlines
```

The second command changes eligible records at the real server time. Run it for genuine test orders only after database setup and disposition review. The consultation can use `--dry-run` when no real deadline has passed.
Laravel also schedules it every minute. A backend scheduler must be running; a Shopper browser is not required:

```powershell
php artisan schedule:work
```

1. At a real configured closing deadline, an eligible unpaid Ready/unclaimed COP order gets one strike and warning, invalid credential and a held reservation. Repeat the command: no second strike for that order.
2. Inspect goods as Supervisor, confirm all suitable for resale and record a reason. Reserved units release once; physical stays unchanged. Do not use that action for damaged/spoiled/missing or prepaid goods.
3. Admin **COP Management** shows real strike history. Only Admin can correct an erroneous strike with a reason; the record remains, and current eligibility recalculates.
4. Warning 1, 30-day ban 2, automatic availability after 30 days, and permanent COP ban 3 are covered in isolated time-controlled tests. Do not alter the working server clock or backdate real records merely to demonstrate them.
5. Paid 24/48-hour holding, later Ready timing, prepaid expiry without COP strikes, preserved funds/stock and pending refund review are covered with trusted-provider **test fixtures**. A real prepaid browser test awaits an actual approved provider integration. Do not simulate payment success in the UI.
6. Confirm the scheduler never strikes an unprepared/canceled order, a late-prepared order, a suspended/changed-hours date, or an already recorded in-person claimant. Such exceptions remain for store review.

## Automated evidence

- Full Laravel after the Supervisor settings revision: **305 passed / 4,813 assertions**; no failures.
- Client API/cart: **86 passed**; no failures.
- All 13 frontend JS/JSX/MJS files changed in that revision linted; production build passed.
- Isolated MariaDB: all migrations applied; concurrent last-unit Checkout, one-worker assignment and repeated handover each produced one successful effect. Temporary test database/runtime file were removed.
- Backend classes: `CheckoutOrderTest`, `StoreWorkerTest`, `OrderDelegationTest`, `PickupLifecycleTest`, `PickupSchedulingCopTest`, `OrderResolutionRecordsTest`, alongside existing stock/catalog/auth regressions.

This evidence is automation, not user browser acceptance. External payment/refund transfers, incentives, tax invoice requirements, account activation, full notification delivery and financial reporting are not declared complete.
