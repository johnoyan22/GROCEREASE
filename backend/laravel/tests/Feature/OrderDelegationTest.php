<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Worker;
use App\Models\WorkerAssignment;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class OrderDelegationTest extends TransactionTestCase
{
    public function test_one_active_order_per_worker_is_enforced_and_busy_order_is_reported(): void
    {
        $worker = $this->assignWorker();
        $otherId = $this->placeOrder();
        $this->signIn($this->supervisor)->putJson($this->path('worker', $otherId), ['worker_id' => $worker->worker_id])->assertConflict();
        $this->getJson('/api/supervisor/workers')->assertOk()->assertJsonPath('workers.0.availability', 'Busy')
            ->assertJsonPath('workers.0.busy_order_id', $this->orderId);
        $this->assertDatabaseCount('active_worker_assignments', 1);
        $this->assertDatabaseCount('worker_assignments', 1);
    }

    public function test_reassignment_requires_reason_and_preserves_previous_assignment_audit(): void
    {
        $first = $this->assignWorker();
        $second = Worker::create(['store_id' => $this->store->store_id, 'full_name' => 'Replacement', 'work_type' => 'picker_packer', 'created_by_user_id' => $this->supervisor->id]);
        $this->putJson($this->path('worker'), ['worker_id' => $second->worker_id])->assertUnprocessable();
        $this->putJson($this->path('worker'), ['worker_id' => $second->worker_id, 'reason' => 'Shift change'])->assertOk();
        $this->assertDatabaseHas('worker_assignments', ['worker_id' => $first->worker_id, 'status' => 'canceled', 'cancellation_reason' => 'Shift change', 'canceled_by_user_id' => $this->supervisor->id]);
        $this->assertDatabaseHas('active_worker_assignments', ['worker_id' => $second->worker_id, 'order_id' => $this->orderId]);
        $this->assertDatabaseCount('worker_assignments', 2);
        $this->assertDatabaseCount('active_worker_assignments', 1);
    }

    public function test_preparation_checklist_review_and_ready_are_distinct_from_paid_pickup(): void
    {
        $worker = $this->assignWorker();
        $this->putJson($this->path('status'), ['status' => 'preparing'])->assertOk();
        $this->putJson($this->path('preparation-completion'), [])->assertConflict();
        $item = Order::findOrFail($this->orderId)->items()->firstOrFail();
        $this->signIn($this->inventoryWorker)->putJson('/api/staff/orders/'.$this->orderId.'/preparation', ['items' => [
            ['order_item_id' => $item->order_item_id, 'prepared_qty' => 2],
        ]])->assertOk();
        $this->signIn($this->supervisor)->putJson($this->path('preparation-completion'), ['completion_note' => 'Reviewed packed groceries'])->assertOk();
        $this->putJson($this->path('preparation-completion'), [])->assertConflict();
        $this->getJson('/api/supervisor/workers')->assertOk()->assertJsonPath('workers.0.availability', 'Available');
        $this->putJson($this->path('status'), ['status' => 'ready_for_pickup'])->assertOk();
        $this->assertDatabaseHas('worker_assignments', ['worker_id' => $worker->worker_id, 'status' => 'completed', 'completed_by_user_id' => $this->supervisor->id]);
        $this->assertDatabaseCount('order_preparation_logs', 1);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertSame('unpaid', Order::findOrFail($this->orderId)->payment_status);
    }

    public function test_waiting_cancellation_frees_worker_and_releases_reserved_units_once(): void
    {
        $this->assignWorker();
        $this->signIn($this->shopper)->putJson($this->shopperPath('cancellation'), ['reason' => 'Plans changed'])->assertOk();
        $this->putJson($this->shopperPath('cancellation'), ['reason' => 'Repeat'])->assertConflict();
        $this->assertDatabaseCount('active_worker_assignments', 0);
        $this->assertDatabaseHas('worker_assignments', ['order_id' => $this->orderId, 'status' => 'canceled', 'canceled_by_user_id' => $this->shopper->id]);
        $this->assertSame(0, $this->inventory->fresh()->soft_stock_qty);
    }

    public function test_busy_worker_cannot_be_deactivated_or_claimed_by_foreign_store(): void
    {
        $worker = $this->assignWorker();
        $this->putJson('/api/supervisor/workers/'.$worker->worker_id, ['full_name' => $worker->full_name, 'work_type' => 'picker_packer', 'status' => 'inactive'])->assertConflict();
        $this->signIn($this->foreign)->putJson($this->path('worker'), ['worker_id' => $worker->worker_id])->assertNotFound();
        $this->putJson($this->path('preparation-completion'), [])->assertNotFound();
        $this->putJson('/api/staff/orders/'.$this->orderId.'/preparation', ['items' => [['order_item_id' => 1, 'prepared_qty' => 2]]])->assertNotFound();
    }

    public function test_preparation_rejects_foreign_items_and_rolls_back_prior_item_changes(): void
    {
        $otherOrder = $this->placeOrder();
        $this->assignWorker();
        $this->putJson($this->path('status'), ['status' => 'preparing'])->assertOk();
        $item = Order::findOrFail($this->orderId)->items()->firstOrFail();
        $foreignItem = Order::findOrFail($otherOrder)->items()->firstOrFail();
        $this->signIn($this->inventoryWorker)->putJson('/api/staff/orders/'.$this->orderId.'/preparation', ['items' => [
            ['order_item_id' => $item->order_item_id, 'prepared_qty' => 2], ['order_item_id' => $foreignItem->order_item_id, 'prepared_qty' => 2],
        ]])->assertNotFound();
        $this->assertSame(0, $item->fresh()->prepared_qty);
        $this->assertDatabaseCount('order_preparation_logs', 0);
        $this->putJson('/api/staff/orders/'.$this->orderId.'/preparation', ['items' => [['order_item_id' => $item->order_item_id, 'prepared_qty' => 3]]])->assertUnprocessable();
    }

    public function test_roles_and_server_owned_assignment_fields_are_enforced(): void
    {
        $worker = Worker::create(['store_id' => $this->store->store_id, 'full_name' => 'Worker', 'work_type' => 'picker', 'created_by_user_id' => $this->supervisor->id]);
        $this->signIn($this->shopper)->putJson($this->path('worker'), ['worker_id' => $worker->worker_id])->assertForbidden();
        $this->signIn($this->inventoryWorker)->putJson($this->path('worker'), ['worker_id' => $worker->worker_id])->assertForbidden();
        $this->signIn($this->supervisor)->putJson($this->path('worker'), ['worker_id' => $worker->worker_id, 'store_id' => $this->otherStore->store_id, 'assigned_by_user_id' => $this->foreign->id])->assertUnprocessable();
        $worker->status = 'inactive'; $worker->save();
        $this->putJson($this->path('worker'), ['worker_id' => $worker->worker_id])->assertConflict();
    }

    public function test_store_staff_can_read_assignment_history_but_shoppers_do_not_receive_personnel_records(): void
    {
        $this->assignWorker();
        $this->getJson('/api/staff/orders')->assertOk()->assertJsonCount(1, 'orders.0.assignments');
        $this->signIn($this->inventoryWorker)->getJson('/api/staff/orders')->assertOk()->assertJsonCount(1, 'orders.0.assignments');
        $this->signIn($this->shopper)->getJson('/api/shopper/orders')->assertOk()->assertJsonCount(0, 'orders.0.assignments');
    }

    public function test_database_uniqueness_also_rejects_a_second_active_order_for_worker(): void
    {
        $worker = $this->assignWorker();
        $secondOrder = $this->placeOrder();
        $assignment = WorkerAssignment::create(['store_id' => $this->store->store_id, 'order_id' => $secondOrder, 'worker_id' => $worker->worker_id,
            'worker_name' => $worker->full_name, 'task_type' => 'picking_packing', 'assigned_by_user_id' => $this->supervisor->id, 'assigned_at' => now()]);
        $this->expectException(QueryException::class);
        DB::table('active_worker_assignments')->insert(['store_id' => $this->store->store_id, 'order_id' => $secondOrder, 'worker_id' => $worker->worker_id, 'assignment_id' => $assignment->assignment_id]);
    }
}
