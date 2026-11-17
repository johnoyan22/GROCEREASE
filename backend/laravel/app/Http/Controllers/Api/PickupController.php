<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PickupCredential;
use App\Services\OrderData;
use App\Services\PickupPolicy;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PickupController extends Controller
{
    public function shopperPickup(Request $request, int $order, PickupPolicy $policy): JsonResponse
    {
        $policy->requireSchema();
        $record = Order::where('shopper_user_id', $request->user()->id)->whereKey($order)->firstOrFail();
        $credential = null;
        if ($record->status === 'ready_for_pickup' && !$record->pickup_schedule_review_required) {
            $stored = PickupCredential::where('order_id', $record->order_id)->whereNull('revoked_at')->latest('id')->first();
            if ($stored && !$stored->consumed_at && $stored->expires_at->isFuture()) {
                $credential = $stored->secret_payload;
                $credential['expires_at'] = $stored->expires_at->toIso8601String();
            }
        }
        // This is the only response containing secrets. Never include them in order lists or audit records.
        return response()->json([
            'order_id' => $record->order_id,
            'credential' => $credential,
        ])->header('Cache-Control', 'no-store, private')->header('Pragma', 'no-cache');
    }

    public function confirmCash(Request $request, int $order, StoreStaffAccess $access, PickupPolicy $policy, OrderData $data): JsonResponse
    {
        return DB::transaction(function () use ($request, $order, $access, $policy, $data) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $policy->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            $validated = $request->validate([
                'cashier_name' => ['required', 'string', 'max:150', 'regex:/\S/u'],
                'evidence_reference' => ['required', 'string', 'max:250', 'regex:/\S/u'],
                'cash_collected' => ['required', 'accepted'],
                'amount_centavos' => ['prohibited'], 'payment_status' => ['prohibited'],
                'store_id' => ['prohibited'], 'confirmed_by_user_id' => ['prohibited'],
            ]);
            $policy->requireClaimable($record, $context['store']);
            abort_unless($record->payment_method === 'cash_on_pickup' && $record->payment_status === 'unpaid', 409, 'This order does not accept another cash confirmation.');
            abort_if(DB::table('order_payments')->where('order_id', $record->order_id)->lockForUpdate()->first(), 409, 'Payment is already recorded.');
            DB::table('order_payments')->insert([
                'order_id' => $record->order_id, 'confirmed_by_user_id' => $context['user']->id,
                'method' => 'cash_on_pickup', 'amount_centavos' => $record->total_centavos,
                'cashier_name' => trim($validated['cashier_name']), 'evidence_type' => 'cashier_confirmation', 'verification_source' => 'cashier',
                'evidence_reference' => Crypt::encryptString(trim($validated['evidence_reference'])),
                'confirmed_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $record->payment_status = 'paid';
            $record->save();
            return response()->json(['message' => 'Cash payment confirmed. Verified physical handover is still required.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    public function verify(Request $request, int $order, StoreStaffAccess $access, PickupPolicy $policy): JsonResponse
    {
        return DB::transaction(function () use ($request, $order, $access, $policy) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $policy->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            $validated = $request->validate([
                'method' => ['required', Rule::in(['pin', 'qr'])],
                'credential' => ['required', 'string', 'max:64'],
                'claimant_name' => ['required', 'string', 'max:150', 'regex:/\S/u'],
                'identity_checked' => ['required', 'accepted'],
                'claimant_check_note' => ['nullable', 'string', 'max:250'],
                'store_id' => ['prohibited'], 'verified_by_user_id' => ['prohibited'],
            ]);
            $claim = app(\App\Services\PickupClaim::class);
            $credential = $claim->credential($record, $context['store'], $validated['method'], $validated['credential']);
            $claim->verify($record, $credential, $context['user']->id, $validated);
            return response()->json(['message' => 'Credential and claimant verified. Confirm payment and physical handover before release.']);
        }, 3);
    }

    public function handover(Request $request, int $order, StoreStaffAccess $access, PickupPolicy $policy, OrderData $data): JsonResponse
    {
        $request->validate(['physically_handed_over' => ['required', 'accepted'], 'payment_status' => ['prohibited'], 'store_id' => ['prohibited'], 'handed_over_by_user_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $order, $access, $policy, $data) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $policy->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            app(\App\Services\PickupClaim::class)->handover($record, $context['store'], $context['user']->id);
            return response()->json(['message' => 'Paid order handed over and completed.', 'order' => $data->present($record, true)]);
        }, 3);
    }

}
