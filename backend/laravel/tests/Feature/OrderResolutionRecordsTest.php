<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PickupCredential;
use App\Services\CopRestrictions;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class OrderResolutionRecordsTest extends TransactionTestCase
{
    private function finish(): void
    {
        $credential = $this->ready();
        $this->cash();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
    }

    public function test_approved_reschedule_replaces_old_code_and_preserves_schedule_audit(): void
    {
        $credential = $this->ready();
        $new = ['pickup_date' => '2026-10-21', 'pickup_start' => '13:00', 'pickup_end' => '14:00', 'reason' => 'Shopper requested an approved schedule change'];
        $this->signIn($this->foreign)->putJson($this->path('pickup-schedule'), $new)->assertNotFound();
        $this->signIn($this->supervisor)->putJson($this->path('pickup-schedule'), $new)->assertOk();
        $this->assertDatabaseCount('pickup_credentials', 2);
        $this->assertNotNull(PickupCredential::oldest('id')->first()->revoked_at);
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertUnprocessable();
        $this->assertDatabaseHas('order_resolution_logs', ['order_id' => $this->orderId, 'action' => 'rescheduled', 'recorded_by_user_id' => $this->supervisor->id]);
        $this->travelTo(\Carbon\Carbon::parse('2026-10-20 16:00:00', 'UTC'));
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->assertSame('claimable', Order::findOrFail($this->orderId)->claim_status);
    }

    public function test_no_show_resale_requires_physical_confirmation_and_releases_only_reservations_once(): void
    {
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->signIn($this->supervisor)->putJson($this->path('resale-disposition'), ['all_items_suitable_for_resale' => false, 'reason' => 'Uninspected'])->assertUnprocessable();
        $this->putJson($this->path('resale-disposition'), ['all_items_suitable_for_resale' => true, 'reason' => 'All sealed goods checked suitable for resale'])->assertOk();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(0, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('order_dispositions', 1);
        $this->putJson($this->path('resale-disposition'), ['all_items_suitable_for_resale' => true, 'reason' => 'Duplicate'])->assertConflict();
        $this->assertDatabaseCount('order_dispositions', 1);
        $this->assertDatabaseCount('cop_strikes', 1);
    }

    public function test_admin_correction_preserves_strike_record_and_recalculates_cop_eligibility(): void
    {
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $strike = DB::table('cop_strikes')->first();
        $path = '/api/admin/cop-strikes/'.$strike->id.'/correction';
        $this->signIn($this->supervisor)->putJson($path, ['reason' => 'Store power outage'])->assertForbidden();
        $this->signIn($this->admin)->getJson('/api/admin/cop-strikes')->assertOk()->assertJsonPath('accounts.0.cop.strike_count', 1);
        $this->signIn($this->admin)->putJson($path, ['reason' => 'Documented unexpected store closure'])->assertOk()->assertJsonPath('cop.strike_count', 0);
        $this->getJson('/api/admin/cop-strikes')->assertOk()->assertJsonPath('accounts.0.cop.strike_count', 0);
        $this->putJson($path, ['reason' => 'Duplicate'])->assertConflict();
        $this->assertDatabaseCount('cop_strikes', 1);
        $this->assertDatabaseHas('cop_strikes', ['id' => $strike->id, 'voided_by_user_id' => $this->admin->id]);
        $this->assertTrue(app(CopRestrictions::class)->status($this->shopper->id)['allowed']);
    }

    public function test_paid_unclaimed_review_preserves_payment_and_stock_without_executing_a_refund(): void
    {
        $this->store->forceFill(['paid_order_holding_hours' => 24])->save();
        $this->recordProviderPayment();
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->signIn($this->supervisor)->putJson($this->path('refund-review'), ['reason' => 'Customer contacted store; review refund policy and held goods'])->assertOk()
            ->assertJsonPath('order.refund_status', 'pending')->assertJsonPath('order.payment_status', 'paid');
        $this->putJson($this->path('refund-review'), ['reason' => 'Duplicate'])->assertConflict();
        $this->putJson($this->path('resale-disposition'), ['all_items_suitable_for_resale' => true, 'reason' => 'Must not release prepaid goods'])->assertConflict();
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('order_payments', 1);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->assertDatabaseCount('order_resolution_logs', 1);
    }

    public function test_final_receipt_requires_paid_completed_handover_and_uses_purchase_time_prices(): void
    {
        $this->signIn($this->shopper)->getJson($this->shopperPath('receipt'))->assertConflict();
        $this->finish();
        $this->inventory->update(['selling_price' => '99.00']);
        $this->signIn($this->shopper)->getJson($this->shopperPath('receipt'))->assertOk()
            ->assertJsonPath('receipt.amount_paid_centavos', 13400)->assertJsonPath('receipt.order.items.0.unit_price_centavos', 6700)
            ->assertJsonMissingPath('receipt.order.pickup.pin')->assertJsonCount(0, 'receipt.order.assignments');
        $this->getJson($this->shopperPath('receipt'))->assertOk();
        $this->assertDatabaseCount('order_payments', 1);
        $this->assertDatabaseCount('order_handovers', 1);
    }

    public function test_transaction_records_and_receipts_are_isolated_by_role_store_and_shopper(): void
    {
        $this->finish();
        $this->signIn($this->supervisor)->getJson('/api/supervisor/transactions')->assertOk()->assertJsonCount(1, 'transactions');
        $this->getJson($this->path('receipt'))->assertOk();
        $this->signIn($this->foreign)->getJson('/api/supervisor/transactions')->assertOk()->assertJsonCount(0, 'transactions');
        $this->getJson($this->path('receipt'))->assertNotFound();
        $this->signIn($this->other)->getJson($this->shopperPath('receipt'))->assertNotFound();
        $this->signIn($this->inventoryWorker)->getJson($this->path('receipt'))->assertForbidden();
        $this->signIn($this->admin)->getJson('/api/admin/transactions')->assertOk()->assertJsonCount(1, 'transactions')
            ->assertJsonMissingPath('transactions.0.evidence_reference');
        $this->getJson('/api/admin/orders/'.$this->orderId.'/receipt')->assertOk();
    }

    public function test_trusted_paid_order_still_needs_code_claimant_and_physical_handover(): void
    {
        $this->store->forceFill(['paid_order_holding_hours' => 24])->save();
        $this->recordProviderPayment();
        $credential = $this->ready();
        $order = Order::findOrFail($this->orderId);
        $this->assertTrue($order->claim_expires_at->equalTo($order->pickup_window_end_at->copy()->addHours(24)));
        $this->signIn($this->supervisor)->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->putJson($this->path('cash-payment'), ['cashier_name' => 'Cashier', 'evidence_reference' => 'Wrong method', 'cash_collected' => true])->assertConflict();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk()->assertJsonPath('order.status', 'completed');
        $this->assertSame(98, $this->inventory->fresh()->hard_stock_qty);
        $this->assertDatabaseCount('order_payments', 1);
    }

    public function test_notifications_are_owned_and_reminders_are_idempotent(): void
    {
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->pickup_window_start_at->addMinute());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertSame(1, DB::table('order_notifications')->where('type', 'pickup_window_open')->count());
        $entry = DB::table('order_notifications')->first();
        $this->signIn($this->other)->putJson('/api/shopper/order-notifications/'.$entry->id.'/read', [])->assertNotFound();
        $this->signIn($this->shopper)->getJson('/api/shopper/order-notifications')->assertOk();
        $this->putJson('/api/shopper/order-notifications/'.$entry->id.'/read', [])->assertOk();
        $this->assertNotNull(DB::table('order_notifications')->where('id', $entry->id)->first()->read_at);
    }
}
