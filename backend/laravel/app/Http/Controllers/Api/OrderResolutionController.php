<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\PickupCredential;
use App\Models\StoreInventory;
use App\Services\OrderData;
use App\Services\OrderNotifications;
use App\Services\PickupPolicy;
use App\Services\PickupScheduling;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderResolutionController extends Controller
{
    public function reschedule(Request $request, int $order, StoreStaffAccess $access, PickupScheduling $scheduling, OrderData $data): JsonResponse
    {
        $validated = $request->validate(array_merge($scheduling->selectionRules(), ['reason' => ['required', 'string', 'max:500', 'regex:/\S/u'],
            'store_id' => ['prohibited'], 'shopper_user_id' => ['prohibited'], 'approved_by_user_id' => ['prohibited']]));
        return DB::transaction(function () use ($request, $order, $access, $scheduling, $data, $validated) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $scheduling->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($record->status, ['waiting', 'preparing', 'ready_for_pickup'], true)
                && in_array($record->claim_status, ['awaiting_preparation', 'claimable'], true) && $record->reservation_status === 'active', 409, 'This order requires reconciliation rather than a normal reschedule.');
            abort_if(DB::table('pickup_verifications')->where('order_id', $record->order_id)->lockForUpdate()->first(), 409, 'A verified claimant requires pickup reconciliation before changing the schedule.');
            $previous = $record->only(['pickup_window_start_at', 'pickup_window_end_at', 'scheduled_store_closes_at']);
            $record->fill($scheduling->resolve($context['store'], $validated));
            if (!$record->isDirty()) return response()->json(['message' => 'Pickup schedule is unchanged.', 'order' => $data->present($record, true)]);
            if ($record->status === 'ready_for_pickup') app(PickupPolicy::class)->issue($record);
            $record->save();
            $this->log($record, $context['user']->id, 'rescheduled', trim($validated['reason']), ['previous' => $previous, 'current' => $record->only(array_keys($previous))]);
            app(OrderNotifications::class)->notify($record, 'rescheduled_'.$record->updated_at->timestamp, 'The store approved a new pickup schedule. Review My Orders and use the latest pickup code.');
            return response()->json(['message' => 'Pickup rescheduled. Any previous pickup code was revoked.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    public function resale(Request $request, int $order, StoreStaffAccess $access, PickupScheduling $scheduling, OrderData $data): JsonResponse
    {
        $validated = $request->validate(['all_items_suitable_for_resale' => ['required', 'accepted'], 'reason' => ['required', 'string', 'max:500', 'regex:/\S/u'],
            'store_id' => ['prohibited'], 'resolved_by_user_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $order, $access, $scheduling, $data, $validated) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $scheduling->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            abort_unless($record->claim_status === 'no_show' && $record->payment_status === 'unpaid' && $record->reservation_status === 'active', 409, 'Only an unresolved unpaid COP No-Show can release goods through this resale check.');
            foreach ($record->items()->orderBy('store_inventory_id')->get() as $item) {
                $inventory = StoreInventory::forStore($record->store_id)->whereKey($item->store_inventory_id)->lockForUpdate()->firstOrFail();
                abort_if($inventory->soft_stock_qty < $item->quantity, 409, 'Reserved quantities require reconciliation.');
                $inventory->soft_stock_qty -= $item->quantity;
                $inventory->stock_version += 1;
                $inventory->save();
            }
            DB::table('order_dispositions')->insert(['order_id' => $record->order_id, 'resolved_by_user_id' => $context['user']->id,
                'disposition' => 'all_items_confirmed_suitable_for_resale', 'reason' => trim($validated['reason']), 'created_at' => now(), 'updated_at' => now()]);
            $record->status = 'canceled';
            $record->claim_status = 'canceled';
            $record->reservation_status = 'released';
            $record->canceled_at = now();
            $record->save();
            PickupCredential::where('order_id', $record->order_id)->whereNull('consumed_at')->whereNull('revoked_at')->update(['revoked_at' => now(), 'revocation_reason' => 'Unclaimed order disposition completed']);
            OrderStatusHistory::create(['order_id' => $record->order_id, 'changed_by_user_id' => $context['user']->id,
                'previous_status' => 'ready_for_pickup', 'new_status' => 'canceled', 'note' => trim($validated['reason'])]);
            return response()->json(['message' => 'Resale suitability recorded. Reserved units released once; physical stock is unchanged.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    public function requestRefundReview(Request $request, int $order, StoreStaffAccess $access, OrderData $data): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'max:500', 'regex:/\S/u'], 'refund_status' => ['prohibited'], 'resolved_by_user_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $order, $access, $data, $validated) {
            $context = $access->resolve($request->user(), ['supervisor']);
            app(PickupScheduling::class)->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            abort_unless($record->claim_status === 'unclaimed_pending_resolution' && $record->payment_status === 'paid' && $record->refund_status === 'pending_decision', 409, 'This order does not need another refund review request.');
            $record->refund_status = 'pending';
            $record->save();
            $this->log($record, $context['user']->id, 'refund_review_requested', trim($validated['reason']));
            return response()->json(['message' => 'Refund review requested. Payment and reserved goods are preserved; no refund was executed.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    private function log(Order $order, int $actorId, string $action, string $reason, ?array $details = null): void
    {
        DB::table('order_resolution_logs')->insert(['order_id' => $order->order_id, 'recorded_by_user_id' => $actorId,
            'action' => $action, 'reason' => $reason, 'details' => $details ? json_encode($details) : null, 'created_at' => now(), 'updated_at' => now()]);
    }
}
