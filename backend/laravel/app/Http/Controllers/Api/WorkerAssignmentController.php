<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Worker;
use App\Models\WorkerAssignment;
use App\Services\OrderData;
use App\Services\StoreStaffAccess;
use App\Services\WorkerDelegation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkerAssignmentController extends Controller
{
    public function assign(Request $request, int $order, StoreStaffAccess $access, WorkerDelegation $delegation, OrderData $data): JsonResponse
    {
        $validated = $request->validate(['worker_id' => ['required', 'integer', 'min:1'], 'reason' => ['nullable', 'string', 'max:500'],
            'store_id' => ['prohibited'], 'assigned_by_user_id' => ['prohibited'], 'status' => ['prohibited'], 'task_type' => ['prohibited']]);
        return DB::transaction(function () use ($request, $order, $access, $delegation, $data, $validated) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $delegation->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($record->status, ['waiting', 'preparing'], true), 409, 'Only an active preparation order can receive a worker.');
            $worker = Worker::where('store_id', $record->store_id)->whereKey($validated['worker_id'])->lockForUpdate()->firstOrFail();
            abort_unless($worker->status === 'active', 409, 'This worker is inactive.');
            $busy = DB::table('active_worker_assignments')->where('worker_id', $worker->worker_id)->lockForUpdate()->first();
            abort_if($busy, 409, 'This worker is Busy with an active order. Refresh the available workers.');
            abort_if(WorkerAssignment::where('order_id', $record->order_id)->where('status', 'completed')->lockForUpdate()->first(), 409, 'This order already has a completed preparation task.');
            $previous = DB::table('active_worker_assignments')->where('order_id', $record->order_id)->lockForUpdate()->first();
            if ($previous) {
                abort_unless(trim($validated['reason'] ?? '') !== '', 422, 'Provide a reason for reassignment.');
                $delegation->cancelActive($record, $context['user']->id, trim($validated['reason']));
            }
            $task = ['picker' => 'picking', 'packer' => 'packing', 'picker_packer' => 'picking_packing'][$worker->work_type];
            $assignment = WorkerAssignment::create([
                'store_id' => $record->store_id, 'order_id' => $record->order_id, 'worker_id' => $worker->worker_id,
                'worker_name' => $worker->full_name, 'task_type' => $task, 'status' => 'assigned',
                'assigned_by_user_id' => $context['user']->id, 'assigned_at' => now(),
            ]);
            DB::table('active_worker_assignments')->insert(['worker_id' => $worker->worker_id, 'store_id' => $record->store_id, 'order_id' => $record->order_id, 'assignment_id' => $assignment->assignment_id]);
            return response()->json(['message' => 'Worker assigned to this order.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    public function complete(Request $request, int $order, StoreStaffAccess $access, WorkerDelegation $delegation, OrderData $data): JsonResponse
    {
        $validated = $request->validate(['completion_note' => ['nullable', 'string', 'max:500'], 'completed_by_user_id' => ['prohibited'], 'store_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $order, $access, $delegation, $data, $validated) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $delegation->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            abort_unless($record->status === 'preparing', 409, 'Only a Preparing order can finish its preparation task.');
            $active = DB::table('active_worker_assignments')->where('order_id', $record->order_id)->lockForUpdate()->first();
            abort_unless($active, 409, 'No active worker task remains for this order.');
            foreach ($record->items()->orderBy('order_item_id')->lockForUpdate()->get() as $item) {
                abort_unless($item->prepared_qty === $item->quantity, 409, 'Complete the digital item checklist before reviewing preparation.');
            }
            $assignment = WorkerAssignment::whereKey($active->assignment_id)->lockForUpdate()->firstOrFail();
            $assignment->status = 'completed';
            $assignment->completed_at = now();
            $assignment->completed_by_user_id = $context['user']->id;
            $assignment->completion_note = $validated['completion_note'] ?? null;
            $assignment->save();
            DB::table('active_worker_assignments')->where('assignment_id', $assignment->assignment_id)->delete();
            return response()->json(['message' => 'Preparation reviewed and task completed. Worker is Available. Payment and pickup remain separate.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    public function prepare(Request $request, int $order, StoreStaffAccess $access, WorkerDelegation $delegation, OrderData $data): JsonResponse
    {
        $validated = $request->validate(['items' => ['required', 'array', 'min:1', 'max:100'], 'items.*' => ['array:order_item_id,prepared_qty'],
            'items.*.order_item_id' => ['required', 'integer', 'distinct'], 'items.*.prepared_qty' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'store_id' => ['prohibited'], 'prepared_by_user_id' => ['prohibited'], 'status' => ['prohibited']]);
        return DB::transaction(function () use ($request, $order, $access, $delegation, $data, $validated) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $delegation->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            abort_unless($record->status === 'preparing', 409, 'Only Preparing orders accept checklist changes.');
            abort_unless(DB::table('active_worker_assignments')->where('order_id', $record->order_id)->lockForUpdate()->first(), 409, 'Assign an active preparation worker first.');
            foreach ($validated['items'] as $requested) {
                $item = $record->items()->whereKey($requested['order_item_id'])->lockForUpdate()->firstOrFail();
                $quantity = (int) $requested['prepared_qty'];
                abort_if($quantity > $item->quantity, 422, 'Prepared quantity cannot exceed the ordered quantity.');
                if ($item->prepared_qty === $quantity) continue;
                DB::table('order_preparation_logs')->insert(['order_item_id' => $item->order_item_id, 'recorded_by_user_id' => $context['user']->id,
                    'previous_qty' => $item->prepared_qty, 'prepared_qty' => $quantity, 'created_at' => now(), 'updated_at' => now()]);
                $item->prepared_qty = $quantity;
                $item->prepared_by_user_id = $context['user']->id;
                $item->prepared_at = now();
                $item->save();
            }
            return response()->json(['message' => 'Preparation checklist saved.', 'order' => $data->present($record, true)]);
        }, 3);
    }
}
