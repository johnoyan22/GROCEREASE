<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\StoreInventory;
use App\Services\LowStockMonitor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\TransactionTestCase;

class AutomaticLowStockTest extends TransactionTestCase
{
    private function evaluate(int $physical, ?int $level, string $status = 'active'): void
    {
        DB::transaction(function () use ($physical, $level, $status) {
            $store = Store::whereKey($this->store->store_id)->lockForUpdate()->firstOrFail();
            $item = StoreInventory::whereKey($this->inventory->store_inventory_id)->lockForUpdate()->firstOrFail();
            $item->forceFill(['hard_stock_qty' => $physical, 'soft_stock_qty' => min($physical, $item->soft_stock_qty), 'low_stock_threshold' => $level, 'status' => $status])->save();
            app(LowStockMonitor::class)->evaluate($item, $store, 'test');
        });
    }

    public function test_boundaries_use_physical_stock_and_equality_not_available_or_shortfall(): void
    {
        foreach ([[11, 10, false], [10, 10, true], [9, 10, true], [0, 10, true], [0, 0, true], [0, null, false]] as [$physical, $level, $low]) {
            $this->evaluate($physical, $level);
            $this->assertSame($low, $this->inventory->fresh()->isLowStock());
            $response = $this->signIn($this->inventoryWorker)->getJson('/api/inventory/low-stock')->assertOk();
            $response->assertJsonCount($low ? 1 : 0, 'inventory');
            if ($low) $response->assertJsonPath('inventory.0.shortfall', $level - $physical);
        }
        $this->inventory->refresh()->forceFill(['hard_stock_qty' => 100, 'soft_stock_qty' => 95])->save();
        $this->evaluate(100, 10);
        $this->assertFalse($this->inventory->fresh()->isLowStock());
        $this->signIn($this->inventoryWorker)->getJson('/api/dashboard/summary')->assertOk()->assertJsonPath('low_stock_products', 0);
    }

    public function test_episode_delivery_recovery_reentry_and_configuration_are_idempotent(): void
    {
        $this->evaluate(10, 10);
        $this->assertDatabaseCount('low_stock_episodes', 1);
        $this->assertDatabaseCount('staff_low_stock_notifications', 2);
        $this->assertEqualsCanonicalizing([$this->inventoryWorker->id, $this->supervisor->id], DB::table('staff_low_stock_notifications')->pluck('user_id')->all());
        $this->evaluate(9, 10);
        $this->evaluate(10, 10);
        $this->evaluate(10, 12);
        $this->artisan('inventory:reconcile-low-stock')->assertExitCode(0);
        $this->artisan('inventory:reconcile-low-stock')->assertExitCode(0);
        $this->assertDatabaseCount('staff_low_stock_notifications', 2);
        $this->assertDatabaseHas('low_stock_episodes', ['observed_physical_qty' => 10, 'reorder_level' => 10, 'current_reorder_level' => 12, 'closed_at' => null]);
        $this->evaluate(13, 12);
        $this->assertDatabaseHas('low_stock_episodes', ['closure_reason' => 'recovered', 'active_inventory_id' => null]);
        $this->evaluate(12, 12);
        $this->assertDatabaseCount('low_stock_episodes', 2);
        $this->assertDatabaseCount('staff_low_stock_notifications', 4);
        $this->evaluate(12, null);
        $this->assertDatabaseHas('low_stock_episodes', ['closure_reason' => 'threshold_cleared']);
        $this->evaluate(0, 0);
        $this->assertDatabaseCount('staff_low_stock_notifications', 6);
        $this->evaluate(0, 0, 'inactive');
        $this->assertDatabaseHas('low_stock_episodes', ['closure_reason' => 'offering_inactive']);
        $this->evaluate(0, 0);
        $this->store->update(['status' => 'inactive']);
        $this->artisan('inventory:reconcile-low-stock')->assertExitCode(0);
        $this->assertDatabaseHas('low_stock_episodes', ['closure_reason' => 'store_inactive']);
    }

    public function test_reconciliation_adds_new_eligible_recipients_without_missing_roles_blocking_stock(): void
    {
        $this->supervisor->forceFill(['staff_approved_at' => null])->save();
        $this->evaluate(0, 0);
        $this->assertDatabaseCount('staff_low_stock_notifications', 1);
        $this->supervisor->forceFill(['staff_approved_at' => now()])->save();
        $this->account('inventory_worker', $this->store, $this->admin)->forceFill(['account_status' => 'inactive'])->save();
        $new = $this->account('inventory_worker', $this->store, $this->admin);
        $this->artisan('inventory:reconcile-low-stock')->assertExitCode(0);
        $this->artisan('inventory:reconcile-low-stock')->assertExitCode(0);
        $this->assertDatabaseCount('staff_low_stock_notifications', 3);
        $this->assertDatabaseHas('staff_low_stock_notifications', ['user_id' => $new->id]);
    }

    public function test_reads_do_not_create_alerts_and_acknowledgement_is_personal_and_store_scoped(): void
    {
        $this->inventory->forceFill(['low_stock_threshold' => 100])->save();
        $this->signIn($this->inventoryWorker)->getJson('/api/inventory/low-stock')->assertOk();
        $this->getJson('/api/staff/low-stock-notifications')->assertOk()->assertJsonCount(0, 'notifications');
        $this->assertDatabaseCount('low_stock_episodes', 0);
        $this->artisan('inventory:reconcile-low-stock')->assertExitCode(0);
        $notice = $this->getJson('/api/staff/low-stock-notifications')->assertOk()->json('notifications.0');
        $this->assertSame('/inventory/low-stock?store='.$this->store->store_id.'&product='.$this->inventory->store_inventory_id, $notice['link']);
        $this->putJson('/api/staff/low-stock-notifications/'.$notice['id'].'/read')->assertOk();
        $this->assertDatabaseCount('low_stock_episodes', 1);
        $this->assertDatabaseHas('low_stock_episodes', ['closed_at' => null]);
        $this->signIn($this->supervisor)->putJson('/api/staff/low-stock-notifications/'.$notice['id'].'/read')->assertNotFound();
        $this->getJson('/api/staff/low-stock-notifications')->assertOk()->assertJsonPath('unread_count', 1);
        $this->signIn($this->foreign)->getJson('/api/staff/low-stock-notifications')->assertOk()->assertJsonCount(0, 'notifications');
        $this->getJson('/api/inventory/low-stock?product='.$this->inventory->store_inventory_id)->assertNotFound();
        $this->inventoryWorker->staffStoreAssignment()->update(['store_id' => $this->otherStore->store_id]);
        $this->signIn($this->inventoryWorker)->getJson('/api/staff/low-stock-notifications')->assertOk()->assertJsonCount(0, 'notifications');
        $this->putJson('/api/staff/low-stock-notifications/'.$notice['id'].'/read')->assertNotFound();
        $this->getJson('/api/inventory/low-stock?store='.$this->store->store_id)->assertConflict();
        $this->signIn($this->shopper)->getJson('/api/staff/low-stock-notifications')->assertForbidden();
        $this->signIn($this->supervisor)->getJson('/api/inventory/low-stock?store_id='.$this->otherStore->store_id)->assertUnprocessable();
        $this->supervisor->forceFill(['staff_approved_at' => null])->save();
        $this->getJson('/api/staff/low-stock-notifications')->assertForbidden();
    }

    public function test_alerts_and_stock_roll_back_together(): void
    {
        try {
            DB::transaction(function () {
                $this->evaluate(10, 10);
                throw new \RuntimeException('rollback');
            });
        } catch (\RuntimeException $e) { $this->assertSame('rollback', $e->getMessage()); }
        $this->assertDatabaseCount('low_stock_episodes', 0);
        $this->assertDatabaseCount('staff_low_stock_notifications', 0);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_policy_and_approved_correction_and_receipts_evaluate_inside_business_transactions(): void
    {
        $path = '/api/supervisor/inventory/items/'.$this->inventory->store_inventory_id.'/policy';
        $this->signIn($this->supervisor)->putJson($path, ['max_per_order' => null, 'low_stock_threshold' => 10])->assertOk();
        $batch = $this->inventory->batches()->firstOrFail();
        $payload = ['inventory_batch_id' => $batch->id, 'operation_id' => (string) Str::uuid(), 'expected_stock_version' => $this->inventory->fresh()->stock_version,
            'requested_remaining_quantity' => 9, 'reason' => 'Physical count verified.'];
        $rejected = $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-adjustments', $payload)->assertCreated()->json('adjustment.id');
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-adjustments/'.$rejected.'/decision', ['decision' => 'rejected', 'decision_note' => 'Recount first.'])->assertOk();
        $this->assertDatabaseCount('low_stock_episodes', 0);
        $payload['operation_id'] = (string) Str::uuid();
        $id = $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-adjustments', $payload)->assertCreated()->json('adjustment.id');
        $this->assertDatabaseCount('low_stock_episodes', 0);
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-adjustments/'.$id.'/decision', ['decision' => 'approved'])->assertOk();
        $this->assertDatabaseCount('staff_low_stock_notifications', 2);
        $this->assertDatabaseHas('low_stock_episodes', ['opened_from' => 'batch_correction']);
        $receipt = ['operation_id' => (string) Str::uuid(), 'quantity' => 1, 'received_date' => '2026-10-19', 'expiry_date' => '2027-01-01', 'description' => 'Delivery.'];
        $id = $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-receipts', $receipt)->assertCreated()->json('receipt.id');
        $this->assertDatabaseHas('low_stock_episodes', ['closed_at' => null]);
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-receipts/'.$id.'/decision', ['decision' => 'approved'])->assertOk();
        $this->assertSame(10, $this->inventory->fresh()->hard_stock_qty);
        $this->assertDatabaseHas('low_stock_episodes', ['closed_at' => null]);
        $this->assertDatabaseCount('staff_low_stock_notifications', 2);
        $receipt['operation_id'] = (string) Str::uuid();
        $id = $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-receipts', $receipt)->assertCreated()->json('receipt.id');
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-receipts/'.$id.'/decision', ['decision' => 'rejected', 'decision_note' => 'Duplicate delivery.'])->assertOk();
        $this->assertSame(10, $this->inventory->fresh()->hard_stock_qty);
        $this->assertDatabaseHas('low_stock_episodes', ['closed_at' => null]);
        $receipt['operation_id'] = (string) Str::uuid();
        $id = $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-receipts', $receipt)->assertCreated()->json('receipt.id');
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-receipts/'.$id.'/decision', ['decision' => 'approved'])->assertOk();
        $this->assertDatabaseHas('low_stock_episodes', ['closure_reason' => 'recovered']);
        $this->assertDatabaseCount('staff_low_stock_notifications', 2);
    }

    public function test_failed_after_commit_delivery_is_durable_even_if_stock_recovers_before_retry(): void
    {
        DB::unprepared("CREATE TRIGGER fail_low_notification BEFORE INSERT ON staff_low_stock_notifications BEGIN SELECT RAISE(ABORT, 'Simulated delivery outage'); END");
        $this->evaluate(10, 10);
        $this->assertSame(10, $this->inventory->fresh()->hard_stock_qty);
        $this->assertDatabaseHas('low_stock_episodes', ['delivery_pending' => true]);
        $this->assertDatabaseCount('staff_low_stock_notifications', 0);
        $this->evaluate(11, 10);
        DB::unprepared('DROP TRIGGER fail_low_notification');
        $this->artisan('inventory:reconcile-low-stock')->assertExitCode(0);
        $this->assertDatabaseHas('low_stock_episodes', ['delivery_pending' => false, 'closure_reason' => 'recovered']);
        $this->assertDatabaseCount('staff_low_stock_notifications', 2);
        $this->artisan('inventory:reconcile-low-stock')->assertExitCode(0);
        $this->assertDatabaseCount('staff_low_stock_notifications', 2);
    }

    public function test_offering_and_admin_store_status_hooks_close_and_reopen_monitoring_immediately(): void
    {
        $this->evaluate(100, 100);
        $this->signIn($this->inventoryWorker)->putJson('/api/inventory/items/'.$this->inventory->store_inventory_id, ['selling_price' => '67.00', 'status' => 'inactive'])->assertOk();
        $this->assertDatabaseHas('low_stock_episodes', ['closure_reason' => 'offering_inactive']);
        $this->putJson('/api/inventory/items/'.$this->inventory->store_inventory_id, ['selling_price' => '67.00', 'status' => 'active'])->assertOk();
        $this->assertDatabaseCount('staff_low_stock_notifications', 4);
        $this->signIn($this->admin)->putJson('/api/admin/stores/'.$this->store->store_id.'/status', ['status' => 'inactive'])->assertOk();
        $this->assertDatabaseHas('low_stock_episodes', ['closure_reason' => 'store_inactive']);
        $this->putJson('/api/admin/stores/'.$this->store->store_id.'/status', ['status' => 'active'])->assertOk();
        $this->assertDatabaseCount('staff_low_stock_notifications', 6);
    }

    public function test_physical_handover_crossing_threshold_creates_alert_immediately(): void
    {
        $this->inventory->forceFill(['low_stock_threshold' => 98])->save();
        $credential = $this->ready();
        $this->cash();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
        $this->assertDatabaseHas('low_stock_episodes', ['observed_physical_qty' => 98, 'opened_from' => 'physical_handover']);
        $this->assertDatabaseCount('staff_low_stock_notifications', 2);
    }
}
