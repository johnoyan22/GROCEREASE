<?php

namespace Tests\Feature;

use App\Models\InventoryBatch;
use App\Models\StockAdjustment;
use App\Models\StoreInventory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\TransactionTestCase;

class BatchCorrectionTest extends TransactionTestCase
{
    private InventoryBatch $a;
    private InventoryBatch $b;

    protected function setUp(): void
    {
        parent::setUp();
        $this->a = $this->inventory->batches()->firstOrFail();
        $this->a->update(['received_date' => '2026-10-01', 'expiry_date' => '2027-01-01']);
        $this->b = app(\App\Services\BatchStock::class)->create($this->inventory, 50, [
            'received_date' => '2026-10-02', 'expiry_date' => '2027-02-01', 'description' => 'Original delivery B.',
        ]);
        $this->inventory->forceFill(['hard_stock_qty' => 150])->save();
    }

    private function payload(InventoryBatch $batch, int|float $count = 40): array
    {
        return ['inventory_batch_id' => $batch->id, 'requested_remaining_quantity' => $count,
            'operation_id' => (string) Str::uuid(), 'expected_stock_version' => $this->inventory->fresh()->stock_version,
            'reason' => 'Shelf and storage count confirmed.'];
    }

    private function submitPath(): string { return '/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-adjustments'; }
    private function decision(int $id): string { return '/api/supervisor/stock-adjustments/'.$id.'/decision'; }
    private function submit(InventoryBatch $batch, int $count = 40): int
    {
        return $this->signIn($this->inventoryWorker)->postJson($this->submitPath(), $this->payload($batch, $count))
            ->assertCreated()->json('adjustment.id');
    }

    public function test_negative_positive_and_zero_counts_change_only_b_and_preserve_receipt_evidence(): void
    {
        $originalA = $this->a->getAttributes();
        $originalB = $this->b->fresh()->getAttributes();
        foreach ([40 => 140, 45 => 145, 0 => 100] as $actual => $total) {
            $id = $this->submit($this->b, $actual);
            $this->assertSame(2, InventoryBatch::count());
            $this->signIn($this->supervisor)->putJson($this->decision($id), ['decision' => 'approved'])
                ->assertOk()->assertJsonPath('adjustment.current_remaining_quantity', $actual);
            $this->assertSame($total, $this->inventory->fresh()->hard_stock_qty);
            $this->assertSame($actual, $this->b->fresh()->remaining_quantity);
            $this->assertSame($originalA, $this->a->fresh()->getAttributes());
            foreach (['reference', 'quantity_received', 'received_date', 'expiry_date', 'stock_receipt_id', 'source', 'description'] as $field) {
                $this->assertSame($originalB[$field], $this->b->fresh()->getAttributes()[$field], $field);
            }
            $this->assertSame(2, InventoryBatch::count());
            $this->assertSame($total - 2, $this->inventory->fresh()->availableStock());
            $this->putJson($this->decision($id), ['decision' => 'approved'])->assertConflict();
        }
        $this->assertDatabaseCount('stock_adjustments', 3);
        $this->assertDatabaseCount('batch_correction_logs', 3);
        $this->assertSame([-10, 5, -45], DB::table('batch_correction_logs')->orderBy('id')->pluck('quantity_change')->all());
    }

    public function test_pending_rejection_retry_and_new_request_preserve_all_quantities(): void
    {
        $before = DB::table('inventory_batches')->orderBy('id')->get()->toArray();
        $payload = $this->payload($this->b);
        $first = $this->signIn($this->inventoryWorker)->postJson($this->submitPath(), $payload)->assertCreated()->json('adjustment.id');
        $this->postJson($this->submitPath(), $payload)->assertOk()->assertJsonPath('adjustment.id', $first);
        $this->postJson($this->submitPath(), [...$payload, 'requested_remaining_quantity' => 41])->assertConflict();
        $this->postJson($this->submitPath(), $this->payload($this->b))->assertConflict();
        $this->getJson('/api/inventory/correction-batches')->assertOk()->assertJsonPath('batches.1.pending_adjustment_id', $first);
        $this->signIn($this->supervisor)->putJson($this->decision($first), ['decision' => 'rejected', 'decision_note' => 'Please recount.'])->assertOk();
        $this->assertEquals($before, DB::table('inventory_batches')->orderBy('id')->get()->toArray());
        $this->assertSame(150, $this->inventory->fresh()->hard_stock_qty);
        $this->assertNotSame($first, $this->submit($this->b, 42));
    }

    public function test_invalid_unchanged_and_batchless_contracts_cannot_create_requests(): void
    {
        foreach ([-1, 1.5, 50, 2147483648] as $count) {
            $this->signIn($this->inventoryWorker)->postJson($this->submitPath(), $this->payload($this->b, $count))
                ->assertUnprocessable()->assertJsonValidationErrors('requested_remaining_quantity');
        }
        $this->postJson($this->submitPath(), [...$this->payload($this->b), 'reason' => '   '])->assertUnprocessable();
        $this->postJson($this->submitPath(), ['requested_hard_stock_qty' => 140, 'expected_stock_version' => 1, 'reason' => 'Old client'])
            ->assertUnprocessable()->assertJsonValidationErrors(['inventory_batch_id', 'requested_hard_stock_qty']);
        $this->postJson($this->submitPath(), [...$this->payload($this->b), 'observed_remaining_quantity' => 100, 'expiry_date' => '2030-01-01'])
            ->assertUnprocessable()->assertJsonValidationErrors(['observed_remaining_quantity', 'expiry_date']);
        $this->assertDatabaseCount('stock_adjustments', 0);
    }

    public function test_allocated_discrepancy_is_saved_and_cannot_rewrite_orders_or_reservations(): void
    {
        $allocations = DB::table('order_batch_allocations')->get()->toArray();
        $orders = DB::table('orders')->get()->toArray();
        $id = $this->submit($this->a, 1);
        $this->signIn($this->supervisor)->getJson('/api/inventory/stock-adjustments')
            ->assertOk()->assertJsonPath('adjustments.0.reconciliation_required', true)
            ->assertJsonPath('adjustments.0.observed_allocated_quantity', 2);
        $this->putJson($this->decision($id), ['decision' => 'approved'])->assertConflict();
        $this->assertSame('pending', StockAdjustment::findOrFail($id)->status);
        $this->assertSame(1, StockAdjustment::findOrFail($id)->requested_remaining_quantity);
        $this->assertEquals($allocations, DB::table('order_batch_allocations')->get()->toArray());
        $this->assertEquals($orders, DB::table('orders')->get()->toArray());
        $this->assertSame(150, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(100, $this->a->fresh()->remaining_quantity);
    }

    public function test_expired_and_held_positive_corrections_retain_condition_and_are_not_sellable(): void
    {
        foreach (['expired', 'on_hold'] as $condition) {
            $this->b->refresh()->update(['status' => $condition === 'expired' ? 'active' : 'on_hold',
                'expiry_date' => $condition === 'expired' ? '2026-01-01' : '2027-02-01']);
            $id = $this->submit($this->b, $this->b->remaining_quantity + 5);
            $this->signIn($this->supervisor)->putJson($this->decision($id), ['decision' => 'approved'])->assertOk();
            $this->assertFalse($this->b->fresh()->eligible());
            $this->assertSame($condition, $this->b->fresh()->publicData()['status']);
            $this->assertSame(98, $this->inventory->fresh()->availableStock());
        }
    }

    public function test_legacy_history_is_labeled_and_must_be_rejected_without_inferred_batch(): void
    {
        $legacy = StockAdjustment::create(['store_id' => $this->store->store_id, 'store_inventory_id' => $this->inventory->store_inventory_id,
            'requested_by_user_id' => $this->inventoryWorker->id, 'observed_hard_stock_qty' => 150, 'observed_soft_stock_qty' => 2,
            'observed_stock_version' => $this->inventory->fresh()->stock_version, 'requested_hard_stock_qty' => 140, 'reason' => 'Legacy count', 'status' => 'pending']);
        $this->signIn($this->supervisor)->getJson('/api/inventory/stock-adjustments')->assertOk()
            ->assertJsonPath('adjustments.0.is_legacy', true)->assertJsonPath('adjustments.0.batch_no', null);
        $this->putJson($this->decision($legacy->id), ['decision' => 'approved'])->assertConflict();
        $this->putJson($this->decision($legacy->id), ['decision' => 'rejected', 'decision_note' => 'Resubmit an exact batch count.'])->assertOk();
        $this->assertSame(150, $this->inventory->fresh()->hard_stock_qty);
        $this->assertDatabaseCount('batch_correction_logs', 0);
    }

    public function test_server_search_filters_pages_empty_recovery_and_store_scope(): void
    {
        for ($i = 0; $i < 24; $i++) app(\App\Services\BatchStock::class)->create($this->inventory, 1);
        $this->b->update(['remaining_quantity' => 0, 'status' => 'on_hold']);
        $url = '/api/inventory/correction-batches';
        $this->signIn($this->inventoryWorker)->getJson($url)->assertOk()->assertJsonCount(10, 'batches')
            ->assertJsonPath('pagination.total', 25)->assertJsonPath('pagination.last_page', 3);
        $last = $this->inventory->batches()->orderByDesc('id')->firstOrFail();
        foreach (['Rice', 'RICE', InventoryBatch::displayNumber($last->id, $last->reference)] as $search) {
            $res = $this->getJson($url.'?search='.urlencode($search))->assertOk();
            $this->assertSame($search === 'Rice' || $search === 'RICE' ? 25 : 1, $res->json('pagination.total'));
        }
        $this->getJson($url.'?product='.$this->inventory->product_id.'&page=999')->assertOk()
            ->assertJsonPath('pagination.current_page', 3)->assertJsonCount(5, 'batches');
        $this->getJson($url.'?include_empty=1&condition=on_hold')->assertOk()->assertJsonCount(1, 'batches')
            ->assertJsonPath('batches.0.id', $this->b->id)->assertJsonPath('batches.0.remaining_quantity', 0);
        $this->getJson($url.'?include_empty=1&condition=empty')->assertOk()->assertJsonPath('pagination.total', 1);
        $this->a->update(['expiry_date' => '2026-01-01']);
        $this->getJson($url.'?condition=expired')->assertOk()->assertJsonCount(1, 'batches');
        foreach (['page=0', 'condition=bogus', 'include_empty=no', 'per_page=100', 'store_id=1', 'search='.str_repeat('a', 101)] as $invalid) {
            $this->getJson($url.'?'.$invalid)->assertUnprocessable();
        }
        $this->signIn($this->foreign)->getJson($url)->assertOk()->assertJsonCount(0, 'batches');
        $this->getJson($url.'?product='.$this->inventory->product_id)->assertNotFound();
        $foreignWorker = $this->account('inventory_worker', $this->otherStore, $this->admin);
        $this->signIn($foreignWorker)->postJson($this->submitPath(), $this->payload($this->b))->assertNotFound();
        $this->signIn($this->inventoryWorker)->postJson($this->submitPath(), [...$this->payload($this->b), 'inventory_batch_id' => 999999])->assertNotFound();
        $this->inventory->batches()->where('id', '>=', $last->id - 4)->update(['remaining_quantity' => 0]);
        $this->getJson($url.'?page=3')->assertOk()->assertJsonPath('pagination.current_page', 2)
            ->assertJsonPath('pagination.last_page', 2)->assertJsonPath('pagination.total', 20);
    }

    public function test_product_filter_batch_ownership_and_zero_recovery_are_scoped_to_the_recorded_product(): void
    {
        $product = \Tests\Support\CategoryFixture::product(['store_id' => $this->store->store_id, 'product_name' => 'Water', 'sku' => 'WATER', 'category' => 'Drinks']);
        $other = StoreInventory::create(['store_id' => $this->store->store_id, 'product_id' => $product->product_id,
            'selling_price' => '10.00', 'hard_stock_qty' => 0, 'status' => 'active']);
        $empty = app(\App\Services\BatchStock::class)->create($other, 50, ['remaining_quantity' => 0, 'status' => 'on_hold']);
        $other->forceFill(['batches_initialized' => true])->save();
        $url = '/api/inventory/correction-batches?include_empty=1&product='.$product->product_id;
        $this->signIn($this->inventoryWorker)->getJson($url)->assertOk()->assertJsonCount(1, 'batches')->assertJsonPath('batches.0.id', $empty->id);
        $this->postJson($this->submitPath(), $this->payload($empty, 5))->assertNotFound();
        $id = $this->postJson('/api/inventory/items/'.$other->store_inventory_id.'/stock-adjustments',
            [...$this->payload($empty, 5), 'expected_stock_version' => 0])->assertCreated()->json('adjustment.id');
        $this->signIn($this->supervisor)->putJson($this->decision($id), ['decision' => 'approved'])->assertOk();
        $this->assertSame(5, $empty->fresh()->remaining_quantity);
        $this->assertSame(50, $empty->fresh()->quantity_received);
        $this->assertSame('on_hold', $empty->fresh()->status);
        $this->assertSame(0, $other->fresh()->availableStock());
        $this->assertSame(5, $other->fresh()->hard_stock_qty);
    }

    public function test_other_batch_changes_that_return_to_original_counts_still_invalidate_the_request(): void
    {
        $id = $this->submit($this->b);
        foreach ([101, 100] as $actual) {
            $other = $this->submit($this->a, $actual);
            $this->signIn($this->supervisor)->putJson($this->decision($other), ['decision' => 'approved'])->assertOk();
        }
        $this->putJson($this->decision($id), ['decision' => 'approved'])->assertConflict();
        $this->assertSame(150, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(50, $this->b->fresh()->remaining_quantity);
        $this->assertSame('pending', StockAdjustment::findOrFail($id)->status);
    }

    public function test_new_allocations_after_a_safe_submission_block_approval_without_rewriting_them(): void
    {
        $id = $this->submit($this->a, 3); // Two allocated at submission; safe then.
        $this->placeOrder(); // Four allocated now; actual three requires reconciliation.
        $before = DB::table('order_batch_allocations')->orderBy('id')->get()->toArray();
        $this->signIn($this->supervisor)->getJson('/api/inventory/stock-adjustments')->assertOk()
            ->assertJsonPath('adjustments.0.reconciliation_required', true)->assertJsonPath('adjustments.0.current_allocated_quantity', 4);
        $this->putJson($this->decision($id), ['decision' => 'approved'])->assertConflict();
        $this->assertEquals($before, DB::table('order_batch_allocations')->orderBy('id')->get()->toArray());
        $this->assertSame(100, $this->a->fresh()->remaining_quantity);
    }

    public function test_reservation_handover_receiving_and_returned_counts_invalidate_saved_evidence(): void
    {
        $id = $this->submit($this->b);
        $this->placeOrder();
        $this->signIn($this->supervisor)->putJson($this->decision($id), ['decision' => 'approved'])->assertConflict();
        $this->putJson($this->decision($id), ['decision' => 'rejected', 'decision_note' => 'New reservations'])->assertOk();
        $id = $this->submit($this->b);
        $credential = $this->ready();
        $this->travelTo(\App\Models\Order::findOrFail($this->orderId)->pickup_window_start_at->copy()->addMinutes(5));
        $this->cash();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
        $this->putJson($this->decision($id), ['decision' => 'approved'])->assertConflict();
        $this->putJson($this->decision($id), ['decision' => 'rejected', 'decision_note' => 'Handover changed stock'])->assertOk();
        $id = $this->submit($this->b);
        $receipt = $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-receipts',
            ['operation_id' => (string) Str::uuid(), 'quantity' => 3, 'received_date' => now('Asia/Manila')->format('Y-m-d'), 'expiry_date' => null, 'description' => 'Another delivery.'])
            ->assertCreated()->json('receipt.id');
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-receipts/'.$receipt.'/decision', ['decision' => 'approved'])->assertOk();
        $this->putJson($this->decision($id), ['decision' => 'approved'])->assertConflict();
        $this->putJson($this->decision($id), ['decision' => 'rejected', 'decision_note' => 'Receipt changed stock'])->assertOk();
        $payload = $this->payload($this->b);
        // The version still changes if a physical count later returns to its previous value.
        $this->inventory->refresh()->increment('stock_version', 2);
        $this->signIn($this->inventoryWorker)->postJson($this->submitPath(), $payload)->assertConflict();
        $this->assertSame(50, $this->b->fresh()->remaining_quantity);
    }
}
