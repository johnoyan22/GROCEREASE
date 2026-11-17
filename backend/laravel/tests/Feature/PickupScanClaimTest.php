<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\PickupCredential;
use App\Services\OrderReference;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\TransactionTestCase;

class PickupScanClaimTest extends TransactionTestCase
{
    private function scan(array $secret): array { return ['method' => 'qr', 'credential' => $secret['qr_token']]; }
    private function finalInput(array $secret): array
    {
        return [...$this->scan($secret), 'claiming_as' => 'shopper', 'identity_checked' => true, 'physically_handed_over' => true];
    }
    private function preview(array $payload) { return $this->postJson('/api/supervisor/pickup/resolve', $payload); }

    public function test_preview_resolves_without_order_context_and_has_no_business_writes_or_secret_leaks(): void
    {
        $secret = $this->ready();
        $before = PickupCredential::first()->getRawOriginal();
        $response = $this->signIn($this->supervisor)->preview($this->scan($secret))->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('order.order_id', $this->orderId)
            ->assertJsonPath('order.order_reference', OrderReference::format($this->orderId));
        foreach ([$secret['pin'], $secret['qr_token'], 'pin_hash', 'token_hash', 'secret_payload'] as $hidden) $this->assertStringNotContainsString($hidden, $response->getContent());
        $this->assertSame($before, PickupCredential::first()->getRawOriginal());
        foreach (['pickup_verifications', 'order_payments', 'order_handovers'] as $table) $this->assertDatabaseCount($table, 0);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->preview($this->scan($secret))->assertOk(); // Closing a preview reserves nothing.
    }

    public static function invalidPayloads(): array
    {
        return [['bad'], ['https://example.com/pickup?pin=01234567'], ['GE-ORD-00000001'], [str_repeat('0', 64)], [str_repeat('A', 64)], [str_repeat('a', 64)."\n"]];
    }

    #[DataProvider('invalidPayloads')]
    public function test_foreign_or_malformed_qr_is_safe(string $code): void
    {
        $this->signIn($this->supervisor)->preview(['method' => 'qr', 'credential' => $code])->assertUnprocessable()->assertJsonMissingPath('order');
        $this->assertDatabaseCount('pickup_verifications', 0);
    }

    public static function unavailableStates(): array
    {
        return [['expired'], ['revoked'], ['consumed'], ['not_ready'], ['review'], ['reservation'], ['closed'], ['deadline']];
    }

    #[DataProvider('unavailableStates')]
    public function test_preview_and_final_reject_changed_claimability(string $state): void
    {
        $secret = $this->ready(); $this->cash();
        $this->preview($this->scan($secret))->assertOk();
        match ($state) {
            'expired' => PickupCredential::first()->update(['expires_at' => now()->subSecond()]),
            'revoked' => PickupCredential::first()->update(['revoked_at' => now()]),
            'consumed' => PickupCredential::first()->update(['consumed_at' => now()]),
            'not_ready' => Order::findOrFail($this->orderId)->update(['status' => 'preparing']),
            'review' => Order::findOrFail($this->orderId)->forceFill(['pickup_schedule_review_required' => true])->save(),
            'reservation' => Order::findOrFail($this->orderId)->update(['reservation_status' => 'released']),
            'deadline' => Order::findOrFail($this->orderId)->forceFill(['claim_expires_at' => now()->subSecond()])->save(),
            'closed' => $this->store->forceFill(['pickup_service_hours' => array_fill(1, 7, ['opens_at' => '00:00', 'closes_at' => '01:00'])])->save(),
        };
        $this->preview($this->scan($secret))->assertConflict();
        $this->postJson($this->path('claim'), $this->finalInput($secret))->assertConflict();
        $this->assertDatabaseCount('pickup_verifications', 0);
        $this->assertDatabaseCount('order_handovers', 0);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_pin_is_scoped_to_exact_reference_and_keeps_leading_zeroes(): void
    {
        $this->ready();
        PickupCredential::first()->update(['pin_hash' => Hash::make('00123456')]);
        $second = $this->placeOrder(); $this->ready($second);
        PickupCredential::where('order_id', $second)->first()->update(['pin_hash' => Hash::make('00123456')]);
        $this->signIn($this->supervisor);
        foreach ([$this->orderId, $second] as $id) {
            $this->preview(['method' => 'pin', 'credential' => '00123456', 'reference' => OrderReference::format($id)])->assertOk()->assertJsonPath('order.order_id', $id);
        }
        $this->preview(['method' => 'pin', 'credential' => '00123456'])->assertUnprocessable();
        $this->preview(['method' => 'pin', 'credential' => 123456, 'reference' => OrderReference::format($this->orderId)])->assertUnprocessable();
        $this->preview(['method' => 'pin', 'credential' => '00123456', 'reference' => 'GE-ORD-99999999'])->assertUnprocessable();
    }

    public function test_resolve_and_final_share_existing_pin_throttle(): void
    {
        $this->ready();
        PickupCredential::first()->update(['pin_hash' => Hash::make('00123456')]);
        $this->signIn($this->supervisor);
        for ($i = 0; $i < 5; $i++) $this->preview(['method' => 'pin', 'credential' => '11111111', 'reference' => OrderReference::format($this->orderId)])->assertUnprocessable();
        $this->preview(['method' => 'pin', 'credential' => '11111111'])->assertStatus(429);
        $this->postJson($this->path('claim'), [])->assertStatus(429);
        $this->postJson($this->path('pickup-verification'), [])->assertStatus(429);
    }

    public function test_current_store_approval_context_and_mismatch_are_enforced(): void
    {
        $secret = $this->ready();
        $this->signIn($this->foreign)->preview($this->scan($secret))->assertUnprocessable()->assertJsonMissingPath('order');
        $this->postJson($this->path('claim'), $this->finalInput($secret))->assertNotFound();
        $this->getJson('/api/supervisor/order-reference?reference='.OrderReference::format($this->orderId))->assertNotFound();
        $this->signIn($this->inventoryWorker)->preview($this->scan($secret))->assertForbidden();
        $this->signIn($this->supervisor)->preview([...$this->scan($secret), 'order_context' => $this->orderId + 1])->assertConflict()->assertJsonMissingPath('order');
        $this->preview($this->scan($secret))->assertOk();
        $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->otherStore->store_id]);
        $this->postJson($this->path('claim'), $this->finalInput($secret))->assertNotFound();
        $this->supervisor->forceFill(['staff_approved_at' => null])->save();
        $this->preview($this->scan($secret))->assertForbidden();
    }

    public function test_one_atomic_claim_uses_snapshot_name_and_consumes_stock_once(): void
    {
        $secret = $this->ready(); $this->cash();
        $this->inventory->forceFill(['low_stock_threshold' => 98])->save();
        $this->postJson($this->path('claim'), $this->finalInput($secret))->assertOk()->assertJsonPath('order.status', 'completed');
        $this->assertDatabaseHas('pickup_verifications', ['claimant_name' => Order::findOrFail($this->orderId)->shopper_name, 'verified_by_user_id' => $this->supervisor->id]);
        $this->assertSame(98, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(0, $this->inventory->fresh()->soft_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->stock_version);
        $this->assertNotNull(PickupCredential::first()->consumed_at);
        $this->assertDatabaseCount('low_stock_episodes', 1);
        $this->postJson($this->path('claim'), $this->finalInput($secret))->assertConflict();
        foreach (['pickup_verifications', 'order_handovers', 'order_payments'] as $table) $this->assertDatabaseCount($table, 1);
        $this->assertDatabaseCount('order_status_history', 4);
        $this->getJson('/api/supervisor/order-reference?reference='.OrderReference::format($this->orderId))->assertOk()->assertJsonPath('order.status', 'completed');
    }

    public function test_representative_requires_real_name_and_self_name_cannot_be_spoofed(): void
    {
        $secret = $this->ready(); $this->cash(); $input = $this->finalInput($secret);
        $this->postJson($this->path('claim'), [...$input, 'claimant_name' => 'Spoofed shopper'])->assertUnprocessable();
        $this->postJson($this->path('claim'), [...$input, 'claiming_as' => 'representative'])->assertUnprocessable();
        $this->postJson($this->path('claim'), [...$input, 'claiming_as' => 'representative', 'claimant_name' => 'Actual Representative'])->assertOk();
        $this->assertDatabaseHas('pickup_verifications', ['claimant_name' => 'Actual Representative']);
    }

    public function test_checks_overrides_and_authentic_payment_are_required(): void
    {
        $secret = $this->ready(); $input = $this->finalInput($secret); $this->signIn($this->supervisor);
        $this->postJson($this->path('claim'), [...$input, 'identity_checked' => false])->assertUnprocessable();
        $this->postJson($this->path('claim'), [...$input, 'physically_handed_over' => false])->assertUnprocessable();
        $this->postJson($this->path('claim'), [...$input, 'payment_status' => 'paid'])->assertUnprocessable();
        $this->postJson($this->path('claim'), $input)->assertConflict();
        Order::findOrFail($this->orderId)->update(['payment_status' => 'paid']);
        $this->postJson($this->path('claim'), $input)->assertConflict();
        $this->assertDatabaseCount('pickup_verifications', 0);
    }

    public function test_prepaid_uses_genuine_evidence_and_never_needs_cash_action(): void
    {
        $this->recordProviderPayment();
        $this->store->forceFill(['paid_order_holding_hours' => 24])->save();
        $secret = $this->ready(); $this->signIn($this->supervisor);
        $this->preview($this->scan($secret))->assertOk()->assertJsonPath('order.pickup.payment_valid', true);
        $this->postJson($this->path('claim'), $this->finalInput($secret))->assertOk();
        $this->assertDatabaseCount('order_payments', 1);
        $this->assertNull(DB::table('order_payments')->value('cashier_name'));
    }

    public function test_payment_revoked_after_preview_cannot_complete_digital_or_override_with_cash(): void
    {
        $this->recordProviderPayment(); $this->store->forceFill(['paid_order_holding_hours' => 24])->save();
        $secret = $this->ready(); $this->signIn($this->supervisor)->preview($this->scan($secret))->assertOk();
        DB::table('order_payments')->update(['provider_reference' => null]);
        $this->putJson($this->path('cash-payment'), ['cashier_name' => 'Cashier', 'evidence_reference' => 'Actual receipt', 'cash_collected' => true])->assertConflict();
        $this->postJson($this->path('claim'), $this->finalInput($secret))->assertConflict();
        $this->assertDatabaseCount('pickup_verifications', 0);
    }

    public function test_audit_failure_rolls_back_entire_claim_but_keeps_saved_cash(): void
    {
        $secret = $this->ready(); $this->cash();
        $this->withoutExceptionHandling();
        OrderStatusHistory::creating(fn () => throw new RuntimeException('Injected claim audit failure'));
        try { $this->postJson($this->path('claim'), $this->finalInput($secret)); $this->fail('Expected failure'); }
        catch (RuntimeException $failure) { $this->assertSame('Injected claim audit failure', $failure->getMessage()); }
        finally { OrderStatusHistory::flushEventListeners(); }
        $this->assertDatabaseCount('pickup_verifications', 0); $this->assertDatabaseCount('order_handovers', 0);
        $this->assertDatabaseCount('order_payments', 1);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertNull(PickupCredential::first()->consumed_at);
        $this->assertSame('ready_for_pickup', Order::findOrFail($this->orderId)->status);
    }

    public function test_legacy_current_verification_is_preserved(): void
    {
        $secret = $this->ready(); $this->cash();
        $this->postJson($this->path('pickup-verification'), $this->identity($secret))->assertOk();
        $before = (array) DB::table('pickup_verifications')->first();
        $this->postJson($this->path('claim'), $this->finalInput($secret))->assertOk();
        $this->assertSame($before, (array) DB::table('pickup_verifications')->first());
    }

    public function test_batch_failure_rolls_back_allocations_and_verification_but_not_cash(): void
    {
        $secret = $this->ready(); $this->cash();
        $this->mock(\App\Services\BatchStock::class, function ($mock) {
            $mock->shouldReceive('handover')->once()->andReturnUsing(function ($inventory, $item) {
                (new \App\Services\BatchStock)->handover($inventory, $item);
                throw new RuntimeException('Injected batch failure');
            });
        });
        $this->withoutExceptionHandling();
        try { $this->postJson($this->path('claim'), $this->finalInput($secret)); $this->fail('Expected batch failure'); }
        catch (RuntimeException $failure) { $this->assertSame('Injected batch failure', $failure->getMessage()); }
        $this->assertDatabaseCount('pickup_verifications', 0); $this->assertDatabaseCount('order_handovers', 0);
        $this->assertDatabaseCount('order_payments', 1);
        $this->assertSame(2, (int) DB::table('order_batch_allocations')->where('status', 'reserved')->sum('quantity'));
        $this->assertSame(100, (int) DB::table('inventory_batches')->sum('remaining_quantity'));
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertNull(PickupCredential::first()->consumed_at);
    }

    public function test_legacy_mismatched_verification_requires_reconciliation_and_old_qr_is_unusable(): void
    {
        $secret = $this->ready(); $this->cash();
        $this->postJson($this->path('pickup-verification'), $this->identity($secret))->assertOk();
        $old = PickupCredential::first(); $old->update(['revoked_at' => now()]);
        $replacement = PickupCredential::create(['order_id' => $this->orderId, 'token_hash' => hash('sha256', str_repeat('a', 64)), 'pin_hash' => Hash::make('00123456'), 'secret_payload' => ['pin' => '00123456', 'qr_token' => str_repeat('a', 64)], 'expires_at' => now()->addHour()]);
        $this->preview($this->scan($secret))->assertUnprocessable();
        $this->postJson($this->path('claim'), [...$this->finalInput($secret), 'credential' => str_repeat('a', 64)])->assertConflict();
        $this->assertDatabaseCount('order_handovers', 0); $this->assertNull($replacement->fresh()->consumed_at);
    }
}
