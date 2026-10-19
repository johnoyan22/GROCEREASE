# Transaction sprint: quick reverse-engineering guide

Follow React form → `services/api.js` → API route → controller → model → database,
then follow the response back to the loading hook and screen.

## Feature 5: Stock Management

React: `StockWorkspace.jsx`, `StockForms.jsx`, Inventory stock pages, `SupervisorStockApprovals.jsx`.
Loading: `useStoreStock.js`. Controllers: `StockAdjustmentController`, `StockReportingController`,
and availability auditing in `StoreInventoryController`. Access: `StoreStaffAccess`.
Models: `StoreInventory`, `StockAdjustment`, `LowStockReport`, `InventoryAvailabilityLog`, `InventoryPolicyLog`.
Relationships: Store → Inventory → Product; requests reference requesting/deciding Users and the inventory item.
Composite foreign keys prevent linking a history row to another store's inventory.

Five essential code blocks, abbreviated from the source:

1. The browser submits the desired count, version and reason, without choosing trusted snapshot or actor fields.

```javascript
body: JSON.stringify({
  requested_hard_stock_qty: details.requested_hard_stock_qty,
  expected_stock_version: details.expected_stock_version,
  reason: details.reason,
})
```

2. Laravel resolves current placement from the authenticated account inside a transaction.

```php
$user = User::query()->with('role')->lockForUpdate()->findOrFail($signedInUser->id);
$assignment = $user->staffStoreAssignment()->lockForUpdate()->first();
$store = Store::query()->lockForUpdate()->findOrFail($assignment->store_id);
```

3. The pending request preserves a server snapshot, leaving inventory unchanged.

```php
'observed_hard_stock_qty' => $inventory->hard_stock_qty,
'observed_soft_stock_qty' => $inventory->soft_stock_qty,
'observed_stock_version' => $inventory->stock_version,
'requested_hard_stock_qty' => $validated['requested_hard_stock_qty'],
'status' => 'pending',
```

4. Fresh approval changes physical stock and version, in the same transaction as the decision.

```php
if ($this->isStale($record)) {
    abort(409, 'Stock changed after this request. Reject it and request a new physical count.');
}
$inventory->hard_stock_qty = $record->requested_hard_stock_qty;
$inventory->stock_version = $inventory->stock_version + 1;
$inventory->save();
```

5. Available stock, rather than all physical stock, determines low-stock indications.

```php
public function availableStock(): int
{
    return $this->hard_stock_qty - $this->soft_stock_qty;
}
public function isLowStock(): bool
{
    return $this->low_stock_threshold !== null && $this->availableStock() <= $this->low_stock_threshold;
}
```

Execution: Worker loads inventory, physically counts a product and submits a reason. Laravel saves a pending
snapshot. Supervisor reviews the own-store queue. Laravel locks the rows, checks status/freshness/reservations,
saves stock and decision atomically, and returns persistent data. React reloads instead of changing a mock status.

Five likely defense questions:

1. **Why approval?** The worker records a physical observation; a separate authorized Supervisor approves the count change.
2. **Why a version?** Counts can change and return to their original values. A version detects intervening movements.
3. **Can approval run twice?** Only a locked pending request can be decided. A repeat returns 409; its original decision persists.
4. **Why prohibit physical below reserved?** Outstanding orders already hold those units. An explicit reconciliation process must resolve the discrepancy.
5. **How is store isolation enforced?** Fresh account approval/placement, store-scoped queries and composite foreign keys work together.

## Feature 6: Shopper catalog and cart

Main files: `ShopperBrowseProducts.jsx`, its mount in `ShopperDashboard.jsx`, `services/cart.js`,
`services/api.js`, `ShopperCatalogController.php` and verified Shopper routes in `routes/api.php`.
It reads Store → StoreInventory → Product. The cart is a browser draft, not an Order or stock reservation.

Five essential code blocks:

1. Catalog routes require a verified authenticated Shopper.

```php
Route::middleware(['auth:sanctum', 'verified', 'role:shopper'])->group(function () {
    Route::get('/shopper/stores', [ShopperCatalogController::class, 'stores']);
    Route::get('/shopper/stores/{store}/products', [ShopperCatalogController::class, 'products']);
});
```

2. The selected active store scopes the product query.

```php
$selectedStore = Store::active()->findOrFail($store);
$inventory = StoreInventory::forStore($selectedStore->store_id)
    ->where('status', StoreInventory::STATUS_ACTIVE)
    ->whereHas('product', function ($query) use ($selectedStore) {
        $query->forStore($selectedStore->store_id);
    })->with('product')->orderBy('store_inventory_id')->get();
```

3. The browser persists IDs and quantities, without trusted prices or payment fields.

```javascript
return { store_id: cart.store_id, items };
// Each item is only: { store_inventory_id: 7, quantity: 2 }
```

4. The maximum quantity respects both current availability and the Supervisor's limit.

```javascript
export function maximumQuantity(product) {
  if (product.max_per_order === null) return product.available_stock;
  return Math.min(product.available_stock, product.max_per_order);
}
```

5. Estimated totals use centavos and safe-integer validation; Checkout must recalculate them.

```javascript
const priceParts = product.selling_price.split('.');
const unitCentavos = Number(priceParts[0]) * 100 + Number(priceParts[1]);
lineCentavos = unitCentavos * item.quantity;
// cartSummary rejects amounts outside JavaScript's safe integer range.
```

Execution: Shopper selects a store. React fetches its products and derives search/filter/sort results.
Cart operations change only IDs and quantities. Current catalog prices produce estimates.
Switching stores requires confirmation before clearing items. Stock stays unchanged until real Checkout.

Five likely defense questions:

1. **Why one store per cart?** Each store owns independent stock, prices and fulfillment; one order must have one store.
2. **Does the cart reserve stock?** No. Reservations require successful validated order creation.
3. **What if a user changes a browser price?** Saved prices are discarded; the server must resolve authoritative prices at Checkout.
4. **What if stock/limits change?** Refresh flags excessive or unavailable cart items. Checkout must validate again under locks.
5. **Why hooks?** `useState` stores displayed values. `useEffect` loads data and cancels obsolete reads. Stock forms use
   `useRef` to block a second click immediately. Laravel remains responsible for permissions and stock correctness.
# Features 7–10: transaction flow study notes

The sections below extend the existing Feature 5/6 notes. All snippets are excerpts, not standalone files.
The real source files contain the surrounding validation, transaction and error handling.

## Feature 7 — scheduled Checkout and unpaid order creation

Main React files: `ShopperCheckout.jsx`, `services/checkout.js`, `services/api.js`.
Backend: `CheckoutController`, `CheckoutPricing`, `PickupScheduling`, `CopRestrictions`.
Models: `Order`, `OrderItem`, `OrderStatusHistory`, existing `StoreInventory`.
Relationships: one Store and Shopper per Order; many purchase-price Order Items; each item references inventory from that same Store.
Routes: POST `/api/shopper/checkout/quote`, POST `/api/shopper/orders`, GET `/api/shopper/checkout-attempts/{key}`.
Flow: choose schedule → review server quote → explicitly place → recover the same attempt if uncertain → track the actual order.

1. React sends the selected schedule together with the one-store cart:

```jsx
const selectedCart = { ...cart, ...selection };
const result = await getCheckoutQuote(selectedCart);
setReview(result);
setReviewCart(selectedCart);
```

2. Laravel validates the chosen window against actual store hours in Philippine time, then stores UTC:

```php
if ($start->isPast() || $end->lessThanOrEqualTo($start)
    || $start->lessThan($opening) || $end->greaterThan($closing)) {
    throw ValidationException::withMessages([
        'pickup_start' => 'Select a future pickup window within this store\'s operating hours.',
    ]);
}
```

3. The encrypted review is bound to the Shopper, cart/schedule, price data and technical expiry:

```php
$token = Crypt::encryptString(json_encode([
    'shopper_user_id' => $user->id,
    'cart_hash' => $pricing->cartHash($cart),
    'price_hash' => $pricing->priceHash($resolved),
    'expires_at' => $expiresAt->timestamp,
]));
```

4. An existing retry key returns its original order instead of creating another reservation:

```php
$existing = Order::where('shopper_user_id', $user->id)
    ->where('idempotency_key', $key)->first();
if ($existing) {
    if ($existing->request_hash !== $hash) {
        abort(409, 'This checkout key was already used for a different cart.');
    }
    return response()->json(['message' => 'This order was already placed.',
        'order' => $data->present($existing)]);
}
```

5. Inside the locked Checkout transaction, only reservations change:

```php
$inventory->soft_stock_qty = $inventory->soft_stock_qty + $line['quantity'];
$inventory->stock_version = $inventory->stock_version + 1;
$inventory->save();
```

Defense questions:

1. **Why calculate totals again in Laravel?** Browser values can be changed. Laravel reads current store prices, quantities, limits and schedules and saves purchase-time snapshots.
2. **Does Checkout collect cash?** No. It creates an unpaid COP order. A cashier actually collects cash later; Supervisor records evidence.
3. **Why a review token and a retry key?** The token prevents silently accepting changed prices. The key prevents duplicate orders when the same submission is retried. They solve different problems.
4. **Does a quote reserve inventory?** No. Only a successful validated order transaction increases reserved units.
5. **Why is the service fee zero?** The final partner fee policy is not approved. The platform does not invent a markup or treat grocery fees as subscription revenue.

## Feature 8 — tracking and digital preparation checklist

React: `OrderWorkspace.jsx`, `OrderPreparation.jsx`, `useOrders.js`, Shopper/Supervisor/Inventory wrappers.
Backend: `OrderController`, `WorkerAssignmentController`, `OrderData`, `WorkerDelegation`.
GET `/api/shopper/orders` reads own orders; GET `/api/staff/orders` reads current-store orders.
PUT `/api/staff/orders/{order}/preparation` saves actual prepared quantities.
Flow: worker assigned → Preparing → checklist saved → Supervisor review → task completed → Ready.
The checklist records the authenticated person reporting/reviewing a non-login worker's work.

1. Store scope comes from current staff approval and assignment:

```php
$context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
$record = Order::where('store_id', $context['store']->store_id)
    ->whereKey($order)->lockForUpdate()->firstOrFail();
```

2. The allowed stage map rejects skips and repeated transitions:

```php
$next = ['waiting' => 'preparing', 'preparing' => 'ready_for_pickup'];
if (($next[$record->status] ?? null) !== $validated['status']
    || $record->reservation_status !== 'active') {
    abort(409, 'This order status transition is not allowed. Refresh the order.');
}
```

3. Each checklist change preserves previous quantity and actor:

```php
DB::table('order_preparation_logs')->insert([
    'order_item_id' => $item->order_item_id,
    'recorded_by_user_id' => $context['user']->id,
    'previous_qty' => $item->prepared_qty,
    'prepared_qty' => $quantity,
    'created_at' => now(), 'updated_at' => now(),
]);
```

4. Ready requires an actually completed reviewed task and full item quantities:

```php
if ($validated['status'] === 'ready_for_pickup') {
    app(WorkerDelegation::class)->requireCompleted($record);
    app(PickupPolicy::class)->issue($record);
}
```

5. Status history is a database record, not a React-only array:

```php
OrderStatusHistory::create([
    'order_id' => $record->order_id,
    'changed_by_user_id' => $context['user']->id,
    'previous_status' => $previous,
    'new_status' => $record->status,
]);
```

Defense questions:

1. **Can Inventory Worker mark the order paid or completed?** No. They record permitted checklist information for their own store. Supervisor handles review and pickup authorization.
2. **Is preparation completion the same as order completion?** No. The worker's task can finish while the order remains unpaid and reserved.
3. **Why keep a history table?** It preserves who changed each stage and when, even after the current status changes.
4. **How are future pickups shown?** Orders contain UTC schedule timestamps, shown in Philippine time. The upcoming filter uses the server time from the latest refresh.
5. **What happens if one submitted item belongs to another order?** The request fails and the transaction rolls back prior checklist writes. No partial update remains.

## Feature 9 — non-login workers and one active order

React: `StorePersonnel.jsx`, `SupervisorStoreWorkers.jsx`, `OrderPreparation.jsx`, Supervisor dashboard.
Backend: `WorkerController`, `WorkerAssignmentController`, `WorkerDelegation`.
Models: plain Eloquent `Worker` and `WorkerAssignment`; neither is an authentication model.
Routes: `/api/supervisor/workers`, `/api/supervisor/orders/{order}/worker`,
`/api/supervisor/orders/{order}/preparation-completion`.
Flow: register store person → manually assign Available worker → Busy → review completed preparation → Available.

1. The worker belongs directly to a store; no User or Profile is created:

```php
$worker = Worker::create([
    'store_id' => $context['store']->store_id,
    'full_name' => $validated['full_name'],
    'work_type' => $validated['work_type'],
    'status' => 'active',
    'created_by_user_id' => $context['user']->id,
]);
```

2. Store/order ownership is also a composite database reference:

```php
$table->foreign(['store_id', 'order_id'], 'assignments_order_store_foreign')
    ->references(['store_id', 'order_id'])->on('orders')->restrictOnDelete();
```

3. Active-assignment keys enforce one active order per worker and one responsible worker per order:

```php
$table->unsignedBigInteger('worker_id')->primary();
$table->unsignedBigInteger('store_id');
$table->unsignedBigInteger('order_id')->unique();
$table->foreignId('assignment_id')->unique()
    ->constrained('worker_assignments', 'assignment_id')->restrictOnDelete();
```

4. Laravel checks current Busy state while holding the store transaction lock:

```php
$busy = DB::table('active_worker_assignments')
    ->where('worker_id', $worker->worker_id)->lockForUpdate()->first();
abort_if($busy, 409, 'This worker is Busy with an active order. Refresh the available workers.');
```

5. Finishing work updates the historical row and removes only the active occupancy record:

```php
$assignment->status = 'completed';
$assignment->completed_at = now();
$assignment->completed_by_user_id = $context['user']->id;
$assignment->completion_note = $validated['completion_note'] ?? null;
$assignment->save();
DB::table('active_worker_assignments')
    ->where('assignment_id', $assignment->assignment_id)->delete();
```

Defense questions:

1. **Why not use the inventory_worker role for pickers?** Inventory Worker is a login account. A picking/packing worker is a separate non-login store personnel record.
2. **Who records worker progress?** Authorized Inventory Worker records the checklist; assigned-store Supervisor assigns, reviews and records completion.
3. **Why have an active table and a history table?** A unique active row enforces capacity. Historical assignments remain after completion, reassignment or cancellation.
4. **Does completing a task create earnings?** No. Incentive rates/eligibility are pending partner approval. No automatic money credit or payout is created.
5. **How do two simultaneous assignments behave?** Store/current-row locks serialize the decision and unique keys prevent a second active occupancy. The isolated MariaDB concurrency check verifies one success and one conflict.

## Feature 10 — shared pickup, deadlines and transaction evidence

React: `OrderPickup.jsx`, `OrderResolution.jsx`, `OrderReceipt.jsx`, `TransactionRecords.jsx`, Admin COP/Store settings.
Backend: `PickupPolicy`, `PickupController`, `OrderDeadlines`, `CopRestrictions`, `PaymentEvidence`,
`OrderResolutionController`, `CopMonitoringController`, `TransactionRecordsController`.
Relationships: Order → credential history; separate payment → claimant verification → physical handover records.
Flow: Ready issues credential → in-person credential/claimant check → trusted payment → physical handover → atomic completion.
Receipts are read from completed payment/handover and purchase snapshots, with no extra payment effect.

1. COP uses the saved actual closing time. Paid holding uses the later of window end and Ready:

```php
if ($order->payment_method === 'cash_on_pickup' && $order->payment_status === 'unpaid') {
    $deadline = $order->scheduled_store_closes_at->copy();
} else {
    $start = $order->pickup_window_end_at->greaterThan($readyAt)
        ? $order->pickup_window_end_at : $readyAt;
    $deadline = $start->copy()->addHours($store->paid_order_holding_hours);
}
```

2. Credentials come from secure server randomness; hashes verify them and an encrypted cast supports the Shopper-only display:

```php
$token = bin2hex(random_bytes(32));
$pin = str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
// PickupCredential.secret_payload uses the encrypted:array model cast.
```

3. The restriction calculation preserves strike history and limits only COP:

```php
$count = $strikes->count();
$until = $count === 2
    ? CarbonImmutable::parse($strikes[1]->issued_at, 'UTC')->addDays(30) : null;
return ['strike_count' => $count, 'permanently_disabled' => $count >= 3,
    'disabled_until' => $until?->toIso8601String(),
    'allowed' => $count < 3 && (!$until || $until->lessThanOrEqualTo(now()))];
```

4. Payment is valid only with trusted evidence matching the actual order amount/method:

```php
if (!$payment || $order->payment_status !== 'paid'
    || (int) $payment->amount_centavos !== $order->total_centavos
    || $payment->method !== $order->payment_method) return false;
```

5. Inside the handover transaction, fulfillment subtracts both quantities and consumes the credential:

```php
$inventory->hard_stock_qty -= $item->quantity;
$inventory->soft_stock_qty -= $item->quantity;
$inventory->stock_version += 1;
$inventory->save();
// After all items and the handover audit are recorded:
$credential->consumed_at = now();
$credential->save();
```

Defense questions:

1. **Does scanning QR prove payment or automatically complete the order?** No. Credential/claimant verification, payment confirmation and physical handover are separate recorded steps.
2. **Must representatives register in advance?** No. They can present the Shopper-shared code. Supervisor still checks the actual claimant in person under supermarket procedure; the code alone is not identity.
3. **Does a paid but unclaimed order receive a COP strike?** No. It enters held/expired resolution with payment and reservations preserved. No refund is fabricated.
4. **Why not automatically release every No-Show reservation?** Prepared goods may be spoiled, damaged or missing. Supervisor must establish suitability/disposition before release.
5. **What is still incomplete?** Real digital payment/provider confirmation, final refund execution/policy, incentives/payroll, full invoice requirements and broad multi-role notification/reporting modules. Their prototypes and fixtures are not credited as completed modules.

QR images use the local browser renderer from the [qrcode maintainer documentation](https://github.com/soldair/node-qrcode#es6es7). No pickup credential is sent to an external QR-image service.
