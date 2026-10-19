<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\PickupCredential;
use App\Models\StoreInventory;
use App\Services\OrderData;
use App\Services\PickupPolicy;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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
            $policy->requireClaimable($record, $context['store']);
            abort_if(DB::table('pickup_verifications')->where('order_id', $record->order_id)->lockForUpdate()->first(), 409, 'This pickup has already been verified.');
            $credential = PickupCredential::where('order_id', $record->order_id)->whereNull('revoked_at')->latest('id')->lockForUpdate()->first();
            $this->requireUsable($credential);
            $valid = false;
            if ($validated['method'] === 'pin' && preg_match('/^[0-9]{8}$/D', $validated['credential'])) {
                $valid = Hash::check($validated['credential'], $credential->pin_hash);
            }
            if ($validated['method'] === 'qr' && preg_match('/^[a-f0-9]{64}$/D', $validated['credential'])) {
                $valid = hash_equals($credential->token_hash, hash('sha256', $validated['credential']));
            }
            abort_unless($valid, 422, 'The pickup credential is invalid.');
            DB::table('pickup_verifications')->insert([
                'order_id' => $record->order_id, 'pickup_credential_id' => $credential->id,
                'verified_by_user_id' => $context['user']->id,
                'method' => $validated['method'], 'claimant_name' => trim($validated['claimant_name']),
                'claimant_check_note' => isset($validated['claimant_check_note']) ? Crypt::encryptString($validated['claimant_check_note']) : null,
                'verified_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
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
            $policy->requireClaimable($record, $context['store']);
            $payment = DB::table('order_payments')->where('order_id', $record->order_id)->lockForUpdate()->first();
            abort_unless(app(\App\Services\PaymentEvidence::class)->valid($record, $payment), 409, 'Verified payment is required before final release.');
            $verified = DB::table('pickup_verifications')->where('order_id', $record->order_id)->lockForUpdate()->first();
            abort_unless($verified, 409, 'Credential and claimant verification is required before final release.');
            $credential = PickupCredential::where('order_id', $record->order_id)->whereNull('revoked_at')->latest('id')->lockForUpdate()->first();
            $this->requireUsable($credential);
            abort_unless((int) $verified->pickup_credential_id === $credential->id, 409, 'Pickup verification requires reconciliation.');
            foreach ($record->items()->orderBy('store_inventory_id')->get() as $item) {
                $inventory = StoreInventory::forStore($record->store_id)->whereKey($item->store_inventory_id)->lockForUpdate()->firstOrFail();
                abort_if($inventory->soft_stock_qty < $item->quantity || $inventory->hard_stock_qty < $item->quantity, 409, 'Reserved stock requires reconciliation.');
                $inventory->hard_stock_qty -= $item->quantity;
                $inventory->soft_stock_qty -= $item->quantity;
                $inventory->stock_version += 1;
                $inventory->save();
            }
            DB::table('order_handovers')->insert([
                'order_id' => $record->order_id, 'order_payment_id' => $payment->id,
                'pickup_verification_id' => $verified->id, 'handed_over_by_user_id' => $context['user']->id,
                'handed_over_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $credential->consumed_at = now();
            $credential->save();
            $record->status = 'completed';
            $record->claim_status = 'completed';
            $record->reservation_status = 'fulfilled';
            $record->completed_at = now();
            $record->save();
            OrderStatusHistory::create([
                'order_id' => $record->order_id, 'changed_by_user_id' => $context['user']->id,
                'previous_status' => 'ready_for_pickup', 'new_status' => 'completed',
            ]);
            return response()->json(['message' => 'Paid order handed over and completed.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    private function requireUsable(?PickupCredential $credential): void
    {
        abort_unless($credential && !$credential->consumed_at && !$credential->revoked_at && $credential->expires_at->isFuture(), 409, 'The pickup credential is unavailable, expired, or already used. Contact the store for reconciliation.');
    }
}
