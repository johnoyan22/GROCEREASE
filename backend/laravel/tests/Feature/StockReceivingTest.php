<?php

namespace Tests\Feature;

use App\Models\InventoryBatch;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockReceipt;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\TransactionTestCase;

class StockReceivingTest extends TransactionTestCase
{
    // Reuse the real pickup helpers, but start with an empty, isolated store.
    protected function setUp(): void
    {
        \Tests\TestCase::setUp();
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->travelTo(\Carbon\Carbon::parse('2026-11-16 16:30:00', 'UTC')); // Already Nov 17 in Manila.
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->shopper = $this->account('shopper');
        $this->store = Store::create(['store_name' => 'Receiving A', 'address' => 'A']);
        $this->otherStore = Store::create(['store_name' => 'Receiving B', 'address' => 'B']);
        $this->store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => '00:00', 'closes_at' => '23:59'])])->save();
        $this->supervisor = $this->account('supervisor', $this->store, $this->admin);
        $this->foreign = $this->account('supervisor', $this->otherStore, $this->admin);
        $this->inventoryWorker = $this->account('inventory_worker', $this->store, $this->admin);
    }

    private function product(array $changes = []): array
    {
        return $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items', array_replace([
            'product_name' => 'Coke', 'category' => 'Drinks', 'size_amount' => 1.5, 'size_unit' => 'L',
            'selling_unit' => 'bottle', 'selling_price' => '1.00', 'status' => 'active',
        ], $changes))->assertCreated()->json('inventory');
    }

    private function receipt(int $itemId, array $changes = []): array
    {
        return $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$itemId.'/stock-receipts', $this->receiptPayload($changes))
            ->assertCreated()->json('receipt');
    }

    private function receiptPayload(array $changes = []): array
    {
        return array_replace(['operation_id' => (string) Str::uuid(), 'quantity' => 100, 'received_date' => '2026-11-16',
            'expiry_date' => '2027-12-31', 'description' => 'Delivery from supplier.'], $changes);
    }

    private function approve(array $receipt): void
    {
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-receipts/'.$receipt['id'].'/decision', ['decision' => 'approved'])->assertOk();
    }

    private function orderFor(int $itemId, int $quantity): int
    {
        $cart = ['store_id' => $this->store->store_id, 'items' => [['store_inventory_id' => $itemId, 'quantity' => $quantity]],
            'pickup_date' => now('Asia/Manila')->addDay()->format('Y-m-d'), 'pickup_start' => '10:00', 'pickup_end' => '11:00'];
        $quote = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        return $this->postJson('/api/shopper/orders', [...$cart, 'quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()])
            ->assertCreated()->json('order.order_id');
    }

    private function finish(int $id): void
    {
        $this->orderId = $id;
        $credential = $this->ready($id);
        $physical = StoreInventory::findOrFail(Order::findOrFail($id)->items->first()->store_inventory_id)->hard_stock_qty;
        $this->cash();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->assertSame($physical, StoreInventory::findOrFail(Order::findOrFail($id)->items->first()->store_inventory_id)->hard_stock_qty);
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
    }

    public function test_requested_coke_water_example_and_fefo_pickups(): void
    {
        $coke = $this->product();
        $water = $this->product(['product_name' => 'Nature Spring', 'size_amount' => 500, 'size_unit' => 'mL']);
        $this->assertNotSame($coke['sku'], $water['sku']);
        $this->assertSame(0, $coke['hard_stock_qty']);
        $this->signIn($this->supervisor)->putJson('/api/supervisor/inventory/items/'.$coke['store_inventory_id'].'/policy', [
            'max_per_order' => 50, 'low_stock_threshold' => 20,
        ])->assertOk();
        $this->approve($this->receipt($coke['store_inventory_id']));
        $this->approve($this->receipt($water['store_inventory_id'], ['expiry_date' => '2028-12-31']));
        $this->approve($this->receipt($coke['store_inventory_id'], ['quantity' => 50, 'received_date' => '2026-11-17', 'expiry_date' => '2028-12-31', 'description' => 'Later Coke delivery.']));
        $items = $this->signIn($this->inventoryWorker)->getJson('/api/inventory/items')->assertOk()->assertJsonCount(2, 'inventory')->json('inventory');
        $this->assertSame(150, $items[0]['hard_stock_qty']);
        $this->assertSame($coke['sku'], $items[0]['sku']);
        $this->assertSame('2027-12-31', $items[0]['nearest_expiry']);
        $this->assertCount(2, $items[0]['batches']);
        $this->assertCount(1, $items[1]['batches']);
        $this->assertSame('2026-11-17', $items[0]['batches'][1]['received_date']);
        $this->assertSame('Later Coke delivery.', $items[0]['batches'][1]['description']);
        foreach ([50, 50, 30] as $quantity) {
            $id = $this->orderFor($coke['store_inventory_id'], $quantity);
            $this->assertSame($quantity, StoreInventory::findOrFail($coke['store_inventory_id'])->soft_stock_qty);
            $ops = $this->signIn($this->inventoryWorker)->getJson('/api/staff/orders')->assertOk()->json('orders');
            $row = collect($ops)->firstWhere('order_id', $id);
            $this->assertSame($quantity, array_sum(array_column($row['items'][0]['picking_batches'], 'quantity')));
            $this->finish($id);
        }
        $batches = InventoryBatch::where('store_inventory_id', $coke['store_inventory_id'])->orderBy('expiry_date')->get();
        $this->assertSame([0, 20], $batches->pluck('remaining_quantity')->all());
        $final = StoreInventory::findOrFail($coke['store_inventory_id']);
        $this->assertSame(20, $final->hard_stock_qty);
        $this->assertSame(0, $final->soft_stock_qty);
        $this->assertTrue($final->isLowStock());
        $this->assertSame(100, StoreInventory::findOrFail($water['store_inventory_id'])->hard_stock_qty);
        $this->assertSame(0, StoreInventory::findOrFail($water['store_inventory_id'])->soft_stock_qty);
        $this->assertSame(100, InventoryBatch::where('store_inventory_id', $water['store_inventory_id'])->sum('remaining_quantity'));
        $this->assertSame(130, DB::table('order_batch_allocations')->where('status', 'fulfilled')->sum('quantity'));
    }

    public static function measurements(): array { return [['mg'], ['g'], ['kg'], ['mL'], ['L'], [null]]; }

    #[DataProvider('measurements')]
    public function test_supported_measurements_and_immutable_automatic_sku(?string $unit): void
    {
        $product = $this->product(['size_amount' => $unit ? 500 : null, 'size_unit' => $unit]);
        $this->assertSame($unit ? '500 '.$unit : null, $product['size']);
        $this->signIn($this->inventoryWorker)->putJson('/api/inventory/items/'.$product['store_inventory_id'], [
            'product_name' => 'New name', 'category' => 'Other', 'selling_price' => '2.00', 'status' => 'active',
            'size_amount' => 1.5, 'size_unit' => 'L',
        ])->assertOk()->assertJsonPath('inventory.sku', $product['sku']);
        $this->putJson('/api/inventory/items/'.$product['store_inventory_id'], ['sku' => $product['sku'], 'selling_price' => '1.00', 'status' => 'active'])
            ->assertUnprocessable()->assertJsonValidationErrors('sku');
        $this->postJson('/api/inventory/items', ['sku' => 'FORGED'])->assertUnprocessable()->assertJsonValidationErrors('sku');
    }

    public function test_invalid_measurements_and_quantities_dates(): void
    {
        foreach ([['size_amount' => 0], ['size_amount' => -1], ['size_amount' => 1, 'size_unit' => null], ['size_unit' => 'oz'], ['selling_unit' => 'carton'], ['size_amount' => 1, 'size_unit' => 'L', 'size' => '2 kg']] as $changes) {
            $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items', array_replace([
                'product_name' => 'Invalid', 'category' => 'Test', 'selling_price' => 1, 'status' => 'active',
                'size_amount' => 1, 'size_unit' => 'L', 'selling_unit' => 'bottle',
            ], $changes))->assertUnprocessable();
        }
        $product = $this->product();
        foreach ([['quantity' => 0], ['quantity' => -1], ['quantity' => 1.5], ['received_date' => '2026-11-18'],
            ['received_date' => '2026-02-30'], ['expiry_date' => '2026-02-30'], ['expiry_date' => '2026-11-15'], ['description' => '   ']] as $changes) {
            $this->postJson('/api/inventory/items/'.$product['store_inventory_id'].'/stock-receipts', $this->receiptPayload($changes))->assertUnprocessable();
        }
        $this->assertDatabaseCount('stock_receipts', 0);
        $this->approve($this->receipt($product['store_inventory_id'], ['received_date' => '2026-11-17', 'expiry_date' => null]));
        $this->assertNull(InventoryBatch::firstOrFail()->expiry_date);
        $cart = ['store_id' => $this->store->store_id, 'items' => [['store_inventory_id' => $product['store_inventory_id'], 'quantity' => 0.5]],
            'pickup_date' => '2026-11-18', 'pickup_start' => '10:00', 'pickup_end' => '11:00'];
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertUnprocessable();
    }

    public function test_pending_rejected_duplicate_submissions_and_decisions(): void
    {
        $product = $this->product(); $id = $product['store_inventory_id'];
        $payload = $this->receiptPayload();
        $receipt = $this->postJson('/api/inventory/items/'.$id.'/stock-receipts', $payload)->assertCreated()->json('receipt');
        $this->postJson('/api/inventory/items/'.$id.'/stock-receipts', $payload)->assertOk()->assertJsonPath('receipt.id', $receipt['id']);
        $this->postJson('/api/inventory/items/'.$id.'/stock-receipts', [...$payload, 'quantity' => 5])->assertConflict();
        $this->assertSame(0, StoreInventory::findOrFail($id)->hard_stock_qty);
        $this->assertDatabaseCount('inventory_batches', 0);
        $path = '/api/supervisor/stock-receipts/'.$receipt['id'].'/decision';
        $this->signIn($this->supervisor)->putJson($path, ['decision' => 'rejected'])->assertUnprocessable();
        $this->putJson($path, ['decision' => 'rejected', 'decision_note' => 'Wrong delivery'])->assertOk();
        $this->putJson($path, ['decision' => 'approved'])->assertConflict();
        $this->assertSame(0, StoreInventory::findOrFail($id)->hard_stock_qty);
        $receipt = $this->receipt($id); $this->approve($receipt);
        $this->putJson('/api/supervisor/stock-receipts/'.$receipt['id'].'/decision', ['decision' => 'approved'])->assertConflict();
        $this->assertSame(100, StoreInventory::findOrFail($id)->hard_stock_qty);
        $this->assertDatabaseCount('inventory_batches', 1);
        $this->assertSame($this->supervisor->id, StockReceipt::findOrFail($receipt['id'])->decided_by_user_id);
    }

    public function test_store_and_role_permissions(): void
    {
        $product = $this->product(); $id = $product['store_inventory_id']; $receipt = $this->receipt($id);
        $path = '/api/supervisor/stock-receipts/'.$receipt['id'].'/decision';
        $this->signIn($this->inventoryWorker)->putJson($path, ['decision' => 'approved'])->assertForbidden();
        $this->putJson('/api/supervisor/inventory/items/'.$id.'/policy', ['max_per_order' => null, 'low_stock_threshold' => 20])->assertForbidden();
        $this->signIn($this->foreign)->putJson($path, ['decision' => 'approved'])->assertNotFound();
        $this->putJson('/api/supervisor/inventory/items/'.$id.'/policy', ['max_per_order' => null, 'low_stock_threshold' => 20])->assertNotFound();
        $this->getJson('/api/inventory/stock-receipts')->assertOk()->assertJsonCount(0, 'receipts');
        $foreignWorker = $this->account('inventory_worker', $this->otherStore, $this->admin);
        $this->signIn($foreignWorker)->postJson('/api/inventory/items/'.$id.'/stock-receipts', $this->receiptPayload())->assertNotFound();
        $this->inventoryWorker->forceFill(['role_id' => Role::where('slug', 'supervisor')->value('role_id')])->save();
        $this->signIn($this->inventoryWorker)->putJson($path, ['decision' => 'approved'])->assertForbidden();
    }

    public function test_expired_and_hold_batches_are_excluded_at_checkout_and_handover(): void
    {
        $product = $this->product(); $id = $product['store_inventory_id'];
        $this->approve($this->receipt($id, ['expiry_date' => '2026-11-16', 'received_date' => '2026-11-15']));
        $this->assertSame(0, StoreInventory::findOrFail($id)->availableStock());
        $cart = ['store_id' => $this->store->store_id, 'items' => [['store_inventory_id' => $id, 'quantity' => 1]],
            'pickup_date' => '2026-11-18', 'pickup_start' => '10:00', 'pickup_end' => '11:00'];
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertUnprocessable();
        $this->approve($this->receipt($id, ['quantity' => 10]));
        $order = $this->orderFor($id, 5);
        $this->orderId = $order;
        $credential = $this->ready($order); $this->cash();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $batch = InventoryBatch::where('expiry_date', '2027-12-31')->firstOrFail();
        $batch->status = 'on_hold'; $batch->save();
        $this->assertSame(0, StoreInventory::findOrFail($id)->availableStock());
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertUnprocessable();
        $this->signIn($this->supervisor);
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $batch->status = 'active'; $batch->expiry_date = '2026-11-16'; $batch->save();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->assertSame(110, StoreInventory::findOrFail($id)->hard_stock_qty);
        $this->assertSame(5, StoreInventory::findOrFail($id)->soft_stock_qty);
        $this->assertDatabaseCount('order_handovers', 0);
    }

    public function test_short_generated_sku_skips_a_preserved_legacy_identifier(): void
    {
        $legacy = sprintf('GE-S%03d-P000001', $this->store->store_id);
        Product::create(['store_id' => $this->store->store_id, 'sku' => $legacy, 'product_name' => 'Legacy SKU', 'category' => 'Legacy']);
        $product = $this->product();
        $this->assertSame(sprintf('GE-S%03d-P000002', $this->store->store_id), $product['sku']);
        $this->assertSame($legacy, Product::where('product_name', 'Legacy SKU')->firstOrFail()->sku);
    }

    public function test_expiry_is_rechecked_before_recording_physical_picking(): void
    {
        $product = $this->product(); $id = $product['store_inventory_id'];
        $this->approve($this->receipt($id));
        $order = $this->orderFor($id, 2);
        $this->assignWorker($order);
        $this->signIn($this->supervisor)->putJson($this->path('status', $order), ['status' => 'preparing'])->assertOk();
        $batch = InventoryBatch::firstOrFail(); $batch->expiry_date = '2026-11-16'; $batch->save();
        $line = Order::findOrFail($order)->items->first();
        $this->signIn($this->inventoryWorker)->putJson('/api/staff/orders/'.$order.'/preparation', [
            'items' => [['order_item_id' => $line->order_item_id, 'prepared_qty' => 2]],
        ])->assertConflict();
        $this->assertSame(0, $line->fresh()->prepared_qty);
        $this->assertSame(100, StoreInventory::findOrFail($id)->hard_stock_qty);
    }

    public function test_distinct_legitimate_receipts_can_share_dates_and_description(): void
    {
        $product = $this->product(); $id = $product['store_inventory_id'];
        $this->approve($this->receipt($id));
        $this->approve($this->receipt($id));
        $this->assertDatabaseCount('inventory_batches', 2);
        $this->assertSame(200, StoreInventory::findOrFail($id)->hard_stock_qty);
        $this->assertSame(2, InventoryBatch::distinct()->count('reference'));
    }

    public function test_failed_batch_audit_rolls_back_approval_and_stock(): void
    {
        $product = $this->product(); $id = $product['store_inventory_id']; $receipt = $this->receipt($id);
        $this->withoutExceptionHandling();
        InventoryBatch::creating(function () { throw new \RuntimeException('Simulated batch audit failure'); });
        try {
            $this->approve($receipt);
            $this->fail('Expected batch failure');
        } catch (\RuntimeException $error) {
            $this->assertSame('Simulated batch audit failure', $error->getMessage());
        } finally { InventoryBatch::flushEventListeners(); }
        $this->assertSame(0, StoreInventory::findOrFail($id)->hard_stock_qty);
        $this->assertSame('pending', StockReceipt::findOrFail($receipt['id'])->status);
        $this->assertDatabaseCount('inventory_batches', 0);
    }

    public function test_legacy_size_is_kept_until_explicit_measurement_edit_and_approval_is_current(): void
    {
        $product = $this->product(); $id = $product['store_inventory_id'];
        DB::table('products')->where('product_id', $product['product_id'])->update(['size' => 'uncertain old label', 'size_amount' => null, 'size_unit' => null, 'selling_unit' => null]);
        $this->putJson('/api/inventory/items/'.$id, ['selling_price' => '2.00', 'status' => 'active'])->assertOk()
            ->assertJsonPath('inventory.size', 'uncertain old label')->assertJsonPath('inventory.selling_unit', null);
        $receipt = $this->receipt($id);
        $this->inventoryWorker->forceFill(['staff_approved_at' => null])->save();
        $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$id.'/stock-receipts', $this->receiptPayload())->assertForbidden();
        $this->store->status = 'inactive'; $this->store->save();
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-receipts/'.$receipt['id'].'/decision', ['decision' => 'approved'])->assertForbidden();
        $this->assertSame('pending', StockReceipt::findOrFail($receipt['id'])->status);
    }

    public function test_cancellation_and_count_correction_preserve_batch_balances(): void
    {
        $product = $this->product(); $id = $product['store_inventory_id'];
        $this->approve($this->receipt($id));
        $receivingEvidence = DB::table('stock_receipts')->orderBy('id')->get()->toArray();
        $order = $this->orderFor($id, 10);
        $this->signIn($this->shopper)->putJson('/api/shopper/orders/'.$order.'/cancellation', ['reason' => 'Changed plans'])->assertOk();
        $this->assertSame(0, DB::table('order_batch_allocations')->where('status', 'reserved')->sum('quantity'));
        foreach ([90, 105] as $total) {
            $item = StoreInventory::findOrFail($id);
            $request = $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$id.'/stock-adjustments', [
                'inventory_batch_id' => $item->batches()->value('id'), 'operation_id' => (string) \Illuminate\Support\Str::uuid(), 'requested_remaining_quantity' => $total, 'expected_stock_version' => $item->stock_version, 'reason' => 'Actual count.',
            ])->assertCreated()->json('adjustment.id');
            $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-adjustments/'.$request.'/decision', ['decision' => 'approved'])->assertOk();
            $this->assertSame($total, (int) InventoryBatch::where('store_inventory_id', $id)->sum('remaining_quantity'));
            $this->assertSame($total, StoreInventory::findOrFail($id)->hard_stock_qty);
        }
        $this->assertDatabaseCount('batch_correction_logs', 2);
        $this->assertEquals($receivingEvidence, DB::table('stock_receipts')->orderBy('id')->get()->toArray());
        $this->assertSame(0, InventoryBatch::where('source', 'correction')->count());
        $this->assertSame(100, InventoryBatch::where('store_inventory_id', $id)->firstOrFail()->quantity_received);
    }
}
