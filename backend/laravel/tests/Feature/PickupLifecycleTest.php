<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\PickupCredential;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\Support\TransactionTestCase;

class PickupLifecycleTest extends TransactionTestCase
{
    public function test_missing_closing_configuration_prevents_ready(): void
    {
        $this->prepare();
        $this->store->forceFill(['operating_hours' => null])->save();
        $this->signIn($this->supervisor)->putJson($this->path('status'), ['status' => 'ready_for_pickup'])->assertUnprocessable();
        $this->assertSame('preparing', Order::findOrFail($this->orderId)->status);
        $this->assertDatabaseCount('pickup_credentials', 0);
        $this->assertDatabaseCount('order_status_history', 2);
    }

    public function test_ready_issues_encrypted_order_credential_visible_only_to_own_shopper(): void
    {
        $secret = $this->ready();
        $this->assertMatchesRegularExpression('/^[0-9]{8}$/', $secret['pin']);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $secret['qr_token']);
        $stored = DB::table('pickup_credentials')->first();
        $this->assertStringNotContainsString($secret['qr_token'], $stored->secret_payload);
        $this->assertNotSame($secret['pin'], $stored->pin_hash);
        $this->getJson($this->shopperPath('pickup'))->assertHeader('Cache-Control', 'no-store, private');
        $this->getJson('/api/shopper/orders')->assertJsonMissingPath('orders.0.pickup.pin')->assertJsonMissingPath('orders.0.pickup.qr_token');
        $this->signIn($this->other)->getJson($this->shopperPath('pickup'))->assertNotFound();
        $this->signIn($this->supervisor)->getJson($this->shopperPath('pickup'))->assertForbidden();
        $this->getJson('/api/staff/orders')->assertJsonMissingPath('orders.0.pickup.pin');
    }

    public function test_verification_does_not_prove_payment_or_deduct_stock(): void
    {
        $credential = $this->ready();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->assertSame('unpaid', Order::findOrFail($this->orderId)->payment_status);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertNull(PickupCredential::first()->consumed_at);
        $this->assertDatabaseCount('order_handovers', 0);
    }

    public function test_cash_payment_alone_does_not_complete_or_release_stock(): void
    {
        $this->ready();
        $this->cash();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->assertSame('paid', Order::findOrFail($this->orderId)->payment_status);
        $this->assertSame('ready_for_pickup', Order::findOrFail($this->orderId)->status);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertDatabaseCount('order_payments', 1);
        $this->putJson($this->path('cash-payment'), ['cashier_name' => 'Test', 'evidence_type' => 'test_receipt', 'evidence_reference' => 'Duplicate', 'cash_collected' => true])->assertConflict();
        $this->assertDatabaseCount('order_payments', 1);
    }

    public function test_paid_verified_handover_completes_and_deducts_each_quantity_exactly_once(): void
    {
        $credential = $this->ready();
        $this->cash();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk()
            ->assertJsonPath('order.status', 'completed')->assertJsonPath('order.reservation_status', 'fulfilled');
        $this->assertSame(98, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(0, $this->inventory->fresh()->soft_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->stock_version);
        $this->assertNotNull(PickupCredential::first()->consumed_at);
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertConflict();
        $this->assertDatabaseCount('order_payments', 1);
        $this->assertDatabaseCount('pickup_verifications', 1);
        $this->assertDatabaseCount('order_handovers', 1);
        $this->assertDatabaseCount('order_status_history', 4);
        $this->assertSame(98, $this->inventory->fresh()->hard_stock_qty);
        $this->signIn($this->shopper)->getJson($this->shopperPath('pickup'))->assertJsonPath('credential', null);
    }

    public function test_representative_can_present_shared_code_without_advance_registration(): void
    {
        $credential = $this->ready();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'),
            array_merge($this->identity($credential), ['claimant_name' => 'Authorized Representative']))->assertOk();
        $this->assertDatabaseHas('pickup_verifications', ['claimant_name' => 'Authorized Representative']);
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('order_collectors'));
    }

    public function test_qr_token_path_shares_the_same_identity_and_payment_guards(): void
    {
        $credential = $this->ready();
        $payload = array_merge($this->identity($credential), ['method' => 'qr', 'credential' => $credential['qr_token']]);
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $payload)->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->assertDatabaseHas('pickup_verifications', ['method' => 'qr']);
    }

    public function test_wrong_expired_and_canceled_credentials_are_rejected(): void
    {
        $credential = $this->ready();
        $wrong = $credential['pin'] === '00000000' ? '00000001' : '00000000';
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), array_merge($this->identity($credential), ['credential' => $wrong]))->assertUnprocessable();
        $this->travelTo(\Carbon\Carbon::parse($credential['expires_at'])->addMinute());
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertConflict();
        $this->travelBack();
        Order::findOrFail($this->orderId)->update(['status' => 'canceled']);
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertConflict();
        $this->assertDatabaseCount('pickup_verifications', 0);
    }

    public function test_pin_attempts_are_rate_limited(): void
    {
        $credential = $this->ready();
        $payload = array_merge($this->identity($credential), ['credential' => 'invalid']);
        $this->signIn($this->supervisor);
        for ($attempt = 0; $attempt < 5; $attempt++) $this->postJson($this->path('pickup-verification'), $payload)->assertUnprocessable();
        $this->postJson($this->path('pickup-verification'), $payload)->assertStatus(429);
        $this->assertDatabaseCount('pickup_verifications', 0);
    }

    public function test_only_current_assigned_supervisor_can_verify_cash_or_handover(): void
    {
        $credential = $this->ready();
        $this->signIn($this->foreign)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertNotFound();
        $this->putJson($this->path('cash-payment'), [])->assertNotFound();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertNotFound();
        $this->signIn($this->inventoryWorker)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertForbidden();
        $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->otherStore->store_id]);
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertNotFound();
    }

    public function test_code_alone_and_fake_paid_state_are_insufficient(): void
    {
        $credential = $this->ready();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), ['method' => 'pin', 'credential' => $credential['pin']])->assertUnprocessable();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        Order::findOrFail($this->orderId)->update(['payment_status' => 'paid']);
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->assertDatabaseCount('order_handovers', 0);
    }

    public function test_completion_audit_failure_rolls_back_stock_credential_and_handover(): void
    {
        $credential = $this->ready();
        $this->cash();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->withoutExceptionHandling();
        OrderStatusHistory::creating(function () { throw new RuntimeException('Simulated completion audit failure'); });
        try {
            $this->putJson($this->path('handover'), ['physically_handed_over' => true]);
            $this->fail('Expected audit failure.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated completion audit failure', $exception->getMessage());
        } finally { OrderStatusHistory::flushEventListeners(); }
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertNull(PickupCredential::first()->consumed_at);
        $this->assertDatabaseCount('order_handovers', 0);
        $this->assertSame('ready_for_pickup', Order::findOrFail($this->orderId)->status);
    }
}
