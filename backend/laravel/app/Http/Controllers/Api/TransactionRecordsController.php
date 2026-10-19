<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderData;
use App\Services\PaymentEvidence;
use App\Services\PickupPolicy;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionRecordsController extends Controller
{
    public function adminIndex(PickupPolicy $pickup): JsonResponse
    {
        $pickup->requireSchema();
        return response()->json(['transactions' => $this->records()->get()]);
    }

    public function supervisorIndex(Request $request, StoreStaffAccess $access, PickupPolicy $pickup): JsonResponse
    {
        return DB::transaction(function () use ($request, $access, $pickup) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $pickup->requireSchema();
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name', 'address']),
                'transactions' => $this->records()->where('orders.store_id', $context['store']->store_id)->lockForUpdate()->get()]);
        }, 3);
    }

    public function receipt(Request $request, int $order, StoreStaffAccess $access, PickupPolicy $pickup, OrderData $data): JsonResponse
    {
        return DB::transaction(function () use ($request, $order, $access, $pickup, $data) {
            $pickup->requireSchema();
            $query = Order::whereKey($order);
            $role = $request->user()->role?->slug;
            if ($role === 'supervisor') {
                $context = $access->resolve($request->user(), ['supervisor']);
                $query->where('store_id', $context['store']->store_id);
            } elseif ($role === 'shopper') $query->where('shopper_user_id', $request->user()->id);
            else abort_unless($role === 'admin', 403);
            $record = $query->lockForUpdate()->firstOrFail();
            $payment = DB::table('order_payments')->where('order_id', $record->order_id)->lockForUpdate()->first();
            $handover = DB::table('order_handovers')->where('order_id', $record->order_id)->lockForUpdate()->first();
            abort_unless($record->status === 'completed' && $record->reservation_status === 'fulfilled' && $handover
                && app(PaymentEvidence::class)->valid($record, $payment), 409, 'A final receipt requires a paid and completed physical handover.');
            return response()->json(['receipt' => ['receipt_number' => 'GE-'.$record->order_id.'-'.$handover->id,
                'transaction_id' => $payment->id, 'confirmed_at' => $payment->confirmed_at, 'handed_over_at' => $handover->handed_over_at,
                'amount_paid_centavos' => (int) $payment->amount_centavos, 'order' => $data->present($record)]]);
        }, 3);
    }

    private function records()
    {
        return DB::table('order_payments')->join('orders', 'orders.order_id', '=', 'order_payments.order_id')
            ->leftJoin('order_handovers', 'order_handovers.order_id', '=', 'orders.order_id')->orderByDesc('order_payments.id')
            ->select(['order_payments.id as transaction_id', 'orders.order_id', 'orders.store_id', 'orders.store_name', 'orders.shopper_name',
                'orders.status', 'orders.payment_status', 'orders.payment_method', 'orders.refund_status', 'orders.claim_status',
                'orders.subtotal_centavos', 'orders.service_fee_centavos', 'orders.total_centavos', 'order_payments.amount_centavos',
                'order_payments.confirmed_at', 'order_handovers.handed_over_at']);
    }
}
