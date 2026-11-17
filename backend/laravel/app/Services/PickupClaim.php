<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\PickupCredential;
use App\Models\Store;
use App\Models\StoreInventory;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

// All callers hold the current staff/store/order locks in a transaction.
class PickupClaim
{
    public function credential(Order $record, Store $store, string $method, string $secret): PickupCredential
    {
        app(PickupPolicy::class)->requireClaimable($record, $store);
        $credential = $this->current($record);
        $valid = $method === 'pin'
            ? preg_match('/^[0-9]{8}$/D', $secret) && Hash::check($secret, $credential->pin_hash)
            : $method === 'qr' && preg_match('/^[a-f0-9]{64}$/D', $secret) && hash_equals($credential->token_hash, hash('sha256', $secret));
        abort_unless($valid, 422, 'The pickup credential is invalid or unavailable.');
        return $credential;
    }

    public function current(Order $record): PickupCredential
    {
        $credential = PickupCredential::where('order_id', $record->order_id)->latest('id')->lockForUpdate()->first();
        abort_unless($credential && !$credential->consumed_at && !$credential->revoked_at && $credential->expires_at->isFuture(), 409,
            'The pickup credential is unavailable, expired, or already used. Contact the store for reconciliation.');
        return $credential;
    }

    public function verify(Order $record, PickupCredential $credential, int $actorId, array $input, bool $reuse = false): void
    {
        $existing = DB::table('pickup_verifications')->where('order_id', $record->order_id)->lockForUpdate()->first();
        if ($existing) {
            abort_unless($reuse && (int) $existing->pickup_credential_id === $credential->id, 409, 'Pickup verification requires reconciliation.');
            return; // Preserve the original claimant, actor, method and audit.
        }
        DB::table('pickup_verifications')->insert([
            'order_id' => $record->order_id, 'pickup_credential_id' => $credential->id,
            'verified_by_user_id' => $actorId, 'method' => $input['method'],
            'claimant_name' => trim($input['claimant_name']),
            'claimant_check_note' => !empty($input['claimant_check_note']) ? Crypt::encryptString($input['claimant_check_note']) : null,
            'verified_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function handover(Order $record, Store $store, int $actorId): void
    {
        app(PickupPolicy::class)->requireClaimable($record, $store);
        $payment = DB::table('order_payments')->where('order_id', $record->order_id)->lockForUpdate()->first();
        abort_unless(app(PaymentEvidence::class)->valid($record, $payment), 409, 'Verified payment is required before final release.');
        $verified = DB::table('pickup_verifications')->where('order_id', $record->order_id)->lockForUpdate()->first();
        $credential = $this->current($record);
        abort_unless($verified && (int) $verified->pickup_credential_id === $credential->id, 409, 'Pickup verification requires reconciliation.');
        foreach ($record->items()->orderBy('store_inventory_id')->get() as $item) {
            $inventory = StoreInventory::forStore($record->store_id)->whereKey($item->store_inventory_id)->lockForUpdate()->firstOrFail();
            abort_if($inventory->soft_stock_qty < $item->quantity || $inventory->hard_stock_qty < $item->quantity, 409, 'Reserved stock requires reconciliation.');
            app(\App\Services\BatchStock::class)->handover($inventory, $item);
            $inventory->hard_stock_qty -= $item->quantity;
            $inventory->soft_stock_qty -= $item->quantity;
            $inventory->stock_version += 1;
            $inventory->save();
            app(\App\Services\LowStockMonitor::class)->evaluate($inventory, $store, 'physical_handover');
        }
        DB::table('order_handovers')->insert([
            'order_id' => $record->order_id, 'order_payment_id' => $payment->id,
            'pickup_verification_id' => $verified->id, 'handed_over_by_user_id' => $actorId,
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
            'order_id' => $record->order_id, 'changed_by_user_id' => $actorId,
            'previous_status' => 'ready_for_pickup', 'new_status' => 'completed',
        ]);
    }
}
