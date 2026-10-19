<?php

namespace App\Services;

use App\Models\Order;
use App\Models\WorkerAssignment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WorkerDelegation
{
    public function requireSchema(): void
    {
        abort_unless(Schema::hasTable('active_worker_assignments'), 503, 'Order preparation is awaiting database setup.');
    }

    public function requireCompleted(Order $order): void
    {
        $this->requireSchema();
        $completed = WorkerAssignment::where('order_id', $order->order_id)->where('status', 'completed')->lockForUpdate()->first();
        abort_unless($completed, 409, 'Complete and review the assigned preparation task before marking Ready.');
        foreach ($order->items()->orderBy('order_item_id')->lockForUpdate()->get() as $item) {
            abort_unless($item->prepared_qty === $item->quantity, 409, 'Every order item must be fully prepared before marking Ready.');
        }
    }

    public function cancelActive(Order $order, int $actorId, string $reason): void
    {
        $this->requireSchema();
        $active = DB::table('active_worker_assignments')->where('order_id', $order->order_id)->lockForUpdate()->first();
        if (!$active) return;
        $assignment = WorkerAssignment::whereKey($active->assignment_id)->lockForUpdate()->firstOrFail();
        $assignment->status = 'canceled';
        $assignment->canceled_by_user_id = $actorId;
        $assignment->canceled_at = now();
        $assignment->cancellation_reason = $reason;
        $assignment->save();
        DB::table('active_worker_assignments')->where('assignment_id', $assignment->assignment_id)->delete();
    }
}
