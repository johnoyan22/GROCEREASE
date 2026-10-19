<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PickupCredential;
use App\Services\CopRestrictions;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class PickupSchedulingCopTest extends TransactionTestCase
{
    public function test_checkout_requires_future_open_store_window_and_persists_utc_schedule(): void
    {
        $this->signIn($this->shopper);
        $this->postJson('/api/shopper/checkout/quote', $this->cart(['pickup_date' => '2026-10-18']))->assertUnprocessable();
        $this->postJson('/api/shopper/checkout/quote', $this->cart(['pickup_start' => '12:00', 'pickup_end' => '11:00']))->assertUnprocessable();
        $hours = array_fill(1, 7, ['opens_at' => '09:00', 'closes_at' => '18:00']);
        $this->store->forceFill(['operating_hours' => $hours])->save();
        $this->postJson('/api/shopper/checkout/quote', $this->cart(['pickup_start' => '08:00']))->assertUnprocessable();
        $this->postJson('/api/shopper/checkout/quote', $this->cart(['pickup_end' => '19:00']))->assertUnprocessable();
        $this->getJson('/api/shopper/orders/'.$this->orderId)->assertOk()
            ->assertJsonPath('order.pickup_window_start_at', '2026-10-20T02:00:00+00:00')
            ->assertJsonPath('order.pickup_window_end_at', '2026-10-20T03:00:00+00:00');
    }

    public function test_supervisor_configures_actual_hours_and_explicit_24_or_48_hour_policy(): void
    {
        $hours = array_fill(1, 7, ['opens_at' => '09:00', 'closes_at' => '21:00']);
        $path = '/api/supervisor/pickup-settings';
        $this->signIn($this->admin)->putJson($path, ['operating_hours' => $hours, 'pickup_service_hours' => $hours, 'paid_order_holding_hours' => 24])->assertForbidden();
        $this->signIn($this->supervisor)->putJson($path, ['operating_hours' => $hours, 'pickup_service_hours' => $hours, 'paid_order_holding_hours' => 36])->assertUnprocessable();
        $this->putJson($path, ['operating_hours' => $hours, 'pickup_service_hours' => $hours, 'paid_order_holding_hours' => 48])->assertOk();
        $this->getJson($path)->assertOk()->assertJsonPath('paid_order_holding_hours', 48)->assertJsonPath('operating_hours.1.closes_at', '21:00');
        $this->assertDatabaseCount('store_schedule_logs', 1);
        $this->putJson($path, ['operating_hours' => $hours, 'pickup_service_hours' => $hours, 'paid_order_holding_hours' => 48])->assertOk();
        $this->assertDatabaseCount('store_schedule_logs', 1);
        $hours[2] = null;
        $this->putJson($path, ['operating_hours' => $hours, 'pickup_service_hours' => $hours, 'paid_order_holding_hours' => null])->assertOk();
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnprocessable();
    }

    private function expireCop(): void
    {
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
    }

    public function test_eligible_first_no_show_warns_once_and_keeps_stock_pending_disposition(): void
    {
        $this->expireCop();
        $this->assertDatabaseHas('orders', ['order_id' => $this->orderId, 'claim_status' => 'no_show', 'reservation_status' => 'active']);
        $this->assertDatabaseCount('cop_strikes', 1);
        $this->assertDatabaseHas('order_notifications', ['order_id' => $this->orderId, 'type' => 'cop_no_show']);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertTrue(app(CopRestrictions::class)->status($this->shopper->id)['allowed']);
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 1);
        $this->assertNotNull(PickupCredential::first()->revoked_at);
    }

    public function test_second_no_show_bans_cop_for_30_days_then_third_permanently_disables_only_cop(): void
    {
        $this->expireCop();
        $this->orderId = $this->placeOrder();
        $this->expireCop();
        $status = app(CopRestrictions::class)->status($this->shopper->id);
        $this->assertSame(2, $status['strike_count']);
        $this->assertFalse($status['allowed']);
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnprocessable()->assertJsonValidationErrors('payment_method');
        $this->travel(30)->days();
        $this->assertTrue(app(CopRestrictions::class)->status($this->shopper->id)['allowed']);
        $this->orderId = $this->placeOrder();
        $this->expireCop();
        $this->assertTrue(app(CopRestrictions::class)->status($this->shopper->id)['permanently_disabled']);
        $this->assertDatabaseCount('cop_strikes', 3);
        $this->signIn($this->shopper)->getJson('/api/shopper/orders')->assertOk();
        $this->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnprocessable();
    }

    public function test_dry_run_and_unprepared_or_canceled_orders_never_create_strikes(): void
    {
        $this->travel(3)->days();
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->signIn($this->shopper)->putJson($this->shopperPath('cancellation'), ['reason' => 'Cancel before preparation'])->assertOk();
        $this->assertSame(0, $this->inventory->fresh()->soft_stock_qty);
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->orderId = $this->placeOrder();
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines', ['--dry-run' => true])->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->assertSame('claimable', Order::findOrFail($this->orderId)->claim_status);
    }

    public function test_unexpected_closure_and_missing_hours_suppress_automatic_strikes(): void
    {
        $this->ready();
        $order = Order::findOrFail($this->orderId);
        $date = $order->pickup_window_start_at->format('Y-m-d');
        $this->signIn($this->supervisor)->postJson('/api/supervisor/pickup-closures', ['date' => $date, 'reason' => 'Unexpected power outage'])->assertOk();
        $this->travelTo($order->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->store->forceFill(['operating_hours' => null])->save();
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
    }

    public function test_late_preparation_after_selected_window_never_automatically_strikes(): void
    {
        $order = Order::findOrFail($this->orderId);
        $this->travelTo($order->pickup_window_end_at->addHour());
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
    }

    public function test_paid_holding_uses_later_of_window_end_and_ready_and_never_creates_cop_strikes(): void
    {
        $this->store->forceFill(['paid_order_holding_hours' => 48])->save();
        $order = Order::findOrFail($this->orderId);
        // Trusted-provider fixture only. No endpoint accepts a frontend-paid claim or simulates a gateway.
        $this->recordProviderPayment();
        $this->travelTo($order->pickup_window_end_at->copy()->addHour());
        $this->ready();
        $order->refresh();
        $this->assertTrue($order->claim_expires_at->equalTo($order->ready_at->copy()->addHours(48)));
        $this->travelTo($order->claim_expires_at->copy()->subMinute());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertSame('claimable', $order->fresh()->claim_status);
        $this->travel(2)->minutes();
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertSame('unclaimed_pending_resolution', $order->fresh()->claim_status);
        $this->assertSame('pending_decision', $order->fresh()->refund_status);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('cop_strikes', 0);
    }

    public function test_paid_holding_has_no_silent_default(): void
    {
        $order = Order::findOrFail($this->orderId);
        $this->recordProviderPayment();
        $this->prepare();
        $this->signIn($this->supervisor)->putJson($this->path('status'), ['status' => 'ready_for_pickup'])->assertConflict();
        $this->assertDatabaseCount('pickup_credentials', 0);
    }

    public function test_in_person_claimant_check_prevents_an_automatic_absence_strike(): void
    {
        $credential = $this->ready();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
    }
}
