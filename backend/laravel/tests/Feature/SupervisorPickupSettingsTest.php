<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PickupCredential;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class SupervisorPickupSettingsTest extends TransactionTestCase
{
    private function settings(array $changes = []): array
    {
        return array_merge([
            'operating_hours' => array_fill(1, 7, ['opens_at' => '09:00', 'closes_at' => '21:00']),
            'pickup_service_hours' => array_fill(1, 7, ['opens_at' => '10:00', 'closes_at' => '18:00']),
            'paid_order_holding_hours' => 24,
        ], $changes);
    }

    public function test_assigned_supervisor_saves_own_hours_and_holding_with_persistent_actor_audit(): void
    {
        $otherBefore = $this->otherStore->fresh()->getAttributes();
        $settings = $this->settings();
        $settings['operating_hours'][7] = null;
        $settings['pickup_service_hours'][7] = null;
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $settings)->assertOk()
            ->assertJsonPath('store_id', $this->store->store_id);
        $this->getJson('/api/supervisor/pickup-settings')->assertOk()
            ->assertJsonPath('operating_hours.1.opens_at', '09:00')
            ->assertJsonPath('pickup_service_hours.1.closes_at', '18:00')
            ->assertJsonPath('pickup_service_hours.7', null)
            ->assertJsonPath('paid_order_holding_hours', 24)
            ->assertJsonPath('timezone', 'Asia/Manila')
            ->assertJsonPath('schedule_history.0.changed_by_user_id', $this->supervisor->id);
        $this->assertSame($otherBefore, $this->otherStore->fresh()->getAttributes());
        $this->putJson('/api/supervisor/pickup-settings', $settings)->assertOk();
        $this->assertDatabaseCount('store_schedule_logs', 1);
    }

    public function test_store_and_actor_overrides_are_rejected_and_foreign_supervisor_only_sees_own_store(): void
    {
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings(['store_id' => $this->otherStore->store_id]))->assertUnprocessable();
        $this->putJson('/api/supervisor/pickup-settings', $this->settings(['changed_by_user_id' => $this->admin->id]))->assertUnprocessable();
        $this->getJson('/api/supervisor/pickup-settings?store_id='.$this->otherStore->store_id)->assertUnprocessable();
        $this->signIn($this->foreign)->putJson('/api/supervisor/pickup-settings', $this->settings())->assertOk()
            ->assertJsonPath('store_id', $this->otherStore->store_id);
        $this->getJson('/api/supervisor/pickup-settings')->assertOk()->assertJsonCount(0, 'affected_orders');
        $this->assertNull($this->store->fresh()->pickup_service_hours);
        $this->assertDatabaseHas('store_schedule_logs', ['store_id' => $this->otherStore->store_id, 'changed_by_user_id' => $this->foreign->id]);
        $this->assertDatabaseMissing('store_schedule_logs', ['store_id' => $this->store->store_id]);
    }

    public function test_guests_inventory_workers_shoppers_and_admin_cannot_write_supervisor_settings(): void
    {
        $this->app['auth']->forgetGuards();
        auth('web')->logout();
        $this->getJson('/api/supervisor/pickup-settings')->assertUnauthorized();
        $this->putJson('/api/supervisor/pickup-settings', $this->settings())->assertUnauthorized();
        $this->postJson('/api/supervisor/pickup-closures', ['date' => '2026-10-20', 'reason' => 'Closed'])->assertUnauthorized();
        foreach ([$this->inventoryWorker, $this->shopper, $this->admin] as $user) {
            $this->signIn($user)->getJson('/api/supervisor/pickup-settings')->assertForbidden();
            $this->putJson('/api/supervisor/pickup-settings', $this->settings())->assertForbidden();
            $this->postJson('/api/supervisor/pickup-closures', ['date' => '2026-10-20', 'reason' => 'Closed'])->assertForbidden();
        }
        $this->assertDatabaseCount('store_schedule_logs', 0);
    }

    public function test_current_approval_assignment_active_store_and_role_are_required(): void
    {
        $this->supervisor->forceFill(['staff_approved_at' => null, 'staff_approved_by_user_id' => null])->save();
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings())->assertForbidden();
        $this->supervisor->forceFill(['staff_approved_at' => now(), 'staff_approved_by_user_id' => $this->admin->id])->save();
        $this->store->update(['status' => Store::STATUS_INACTIVE]);
        $this->getJson('/api/supervisor/pickup-settings')->assertForbidden();
        $this->store->update(['status' => Store::STATUS_ACTIVE]);
        StaffStoreAssignment::where('user_id', $this->supervisor->id)->delete();
        $this->getJson('/api/supervisor/pickup-settings')->assertForbidden();
        $this->postJson('/api/supervisor/pickup-closures', ['date' => '2026-10-20', 'reason' => 'Closed'])->assertForbidden();
        $this->assertDatabaseCount('store_schedule_logs', 0);
    }

    public function test_admin_has_read_only_settings_and_audit_oversight_for_each_store(): void
    {
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings())->assertOk();
        $path = '/api/admin/stores/'.$this->store->store_id.'/pickup-settings';
        $this->signIn($this->admin)->getJson($path)->assertOk()
            ->assertJsonPath('pickup_service_hours.2.opens_at', '10:00')
            ->assertJsonPath('schedule_history.0.previous_settings.pickup_service_hours', null)
            ->assertJsonPath('schedule_history.0.new_settings.pickup_service_hours.2.closes_at', '18:00');
        $this->getJson('/api/admin/stores/'.$this->otherStore->store_id.'/pickup-settings')->assertOk()->assertJsonCount(0, 'schedule_history');
        $this->putJson($path, $this->settings())->assertStatus(405);
        $this->postJson('/api/admin/stores/'.$this->store->store_id.'/pickup-closures', ['date' => '2026-10-20', 'reason' => 'Closed'])->assertNotFound();
        $this->signIn($this->supervisor)->getJson($path)->assertForbidden();
        $this->assertDatabaseCount('store_schedule_logs', 1);
    }

    public function test_invalid_pickup_intervals_and_policies_do_not_partially_save(): void
    {
        $before = $this->store->fresh()->getAttributes();
        $cases = [];
        $bad = $this->settings(); $bad['pickup_service_hours'][1]['opens_at'] = '08:00'; $cases[] = $bad;
        $bad = $this->settings(); $bad['pickup_service_hours'][1]['closes_at'] = '22:00'; $cases[] = $bad;
        $bad = $this->settings(); $bad['pickup_service_hours'][1]['closes_at'] = '09:00'; $cases[] = $bad;
        $bad = $this->settings(); $bad['operating_hours'][1] = null; $cases[] = $bad;
        $bad = $this->settings(); unset($bad['pickup_service_hours'][7]); $cases[] = $bad;
        $bad = $this->settings(); $bad['operating_hours'][1] = ['opens_at' => '09:00']; $cases[] = $bad;
        $cases[] = $this->settings(['paid_order_holding_hours' => 36]);
        $this->signIn($this->supervisor);
        foreach ($cases as $settings) $this->putJson('/api/supervisor/pickup-settings', $settings)->assertUnprocessable();
        $this->assertSame($before, $this->store->fresh()->getAttributes());
        $this->assertDatabaseCount('store_schedule_logs', 0);
        $this->assertFalse(Order::findOrFail($this->orderId)->pickup_schedule_review_required);
    }

    public function test_shopper_availability_and_checkout_use_both_hour_ranges_but_cop_deadline_is_store_closing(): void
    {
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings())->assertOk();
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/pickup-hours?date=2026-10-20')
            ->assertOk()->assertJsonPath('hours.opens_at', '10:00')->assertJsonPath('hours.closes_at', '18:00')
            ->assertJsonPath('hours.store_closes_at', '21:00')->assertJsonPath('hours.earliest_start_at', '10:00');
        $this->postJson('/api/shopper/checkout/quote', $this->cart(['pickup_start' => '09:00']))->assertUnprocessable();
        $this->postJson('/api/shopper/checkout/quote', $this->cart(['pickup_end' => '18:01']))->assertUnprocessable();
        $id = $this->placeOrder();
        $order = Order::findOrFail($id);
        $this->assertSame('2026-10-20 13:00:00', $order->scheduled_store_closes_at->format('Y-m-d H:i:s'));
        $this->assertFalse($order->pickup_schedule_review_required);
    }

    public function test_availability_hides_past_dates_elapsed_hours_and_past_times_today(): void
    {
        $this->store->forceFill(['pickup_service_hours' => array_fill(1, 7, ['opens_at' => '10:00', 'closes_at' => '18:00'])])->save();
        $this->signIn($this->shopper);
        $path = '/api/shopper/stores/'.$this->store->store_id.'/pickup-hours?date=';
        $this->getJson($path.'2026-10-18')->assertUnprocessable();
        $this->getJson($path.'2026-10-19')->assertOk()->assertJsonPath('hours.earliest_start_at', '16:01');
        $this->travel(2)->hours();
        $this->getJson($path.'2026-10-19')->assertUnprocessable();
        $this->getJson($path.'2026-10-20')->assertOk()->assertJsonPath('hours.earliest_start_at', '10:00');
    }

    public function test_supervisor_availability_resolves_own_store_and_rejects_store_overrides_and_other_roles(): void
    {
        $path = '/api/supervisor/pickup-hours?date=2026-10-20';
        $this->signIn($this->supervisor)->getJson($path)->assertOk()->assertJsonPath('store_id', $this->store->store_id);
        $this->getJson($path.'&store_id='.$this->otherStore->store_id)->assertUnprocessable();
        $this->signIn($this->foreign)->getJson($path)->assertOk()->assertJsonPath('store_id', $this->otherStore->store_id);
        foreach ([$this->shopper, $this->inventoryWorker, $this->admin] as $user) $this->signIn($user)->getJson($path)->assertForbidden();
    }

    public function test_suspensions_require_reason_preserve_audit_and_block_scheduling_without_changing_other_stores(): void
    {
        $path = '/api/supervisor/pickup-closures';
        $this->signIn($this->supervisor)->postJson($path, ['date' => '2026-10-20', 'reason' => ' '])->assertUnprocessable();
        $this->postJson($path, ['date' => '2026-10-20', 'reason' => 'Outage', 'store_id' => $this->otherStore->store_id])->assertUnprocessable();
        $this->postJson($path, ['date' => '2026-10-20', 'reason' => 'Power outage'])->assertOk()->assertJsonCount(1, 'affected_orders');
        $this->postJson($path, ['date' => '2026-10-20', 'reason' => 'Duplicate'])->assertConflict();
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnprocessable();
        $this->getJson('/api/shopper/stores/'.$this->store->store_id.'/pickup-hours?date=2026-10-20')->assertUnprocessable();
        $this->assertDatabaseCount('store_pickup_exceptions', 1);
        $this->assertDatabaseHas('store_pickup_exceptions', ['store_id' => $this->store->store_id, 'recorded_by_user_id' => $this->supervisor->id]);
        $this->signIn($this->admin)->getJson('/api/admin/stores/'.$this->store->store_id.'/pickup-settings')->assertOk()
            ->assertJsonPath('schedule_history.0.new_settings.reason', 'Power outage');
    }

    public function test_late_cop_pickup_after_selected_window_is_allowed_inside_pickup_operations(): void
    {
        $this->store->forceFill(['pickup_service_hours' => array_fill(1, 7, ['opens_at' => '10:00', 'closes_at' => '18:00'])])->save();
        $credential = $this->ready();
        $order = Order::findOrFail($this->orderId);
        $this->travelTo($order->pickup_window_end_at->copy()->addHour());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->cash();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk()->assertJsonPath('order.status', 'completed');
    }

    public function test_end_of_pickup_service_blocks_claiming_but_does_not_advance_cop_no_show_cutoff(): void
    {
        $this->store->forceFill([
            'operating_hours' => $this->settings()['operating_hours'],
            'pickup_service_hours' => $this->settings()['pickup_service_hours'],
        ])->save();
        $this->orderId = $this->placeOrder();
        $credential = $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->pickup_window_start_at->copy()->setTime(10, 0)); // 18:00 Philippine time
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertConflict();
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->travel(3)->hours();
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 1);
        $this->assertSame('no_show', Order::findOrFail($this->orderId)->claim_status);
    }

    public function test_changed_hours_preserve_existing_order_values_block_release_and_suppress_unjustified_strikes(): void
    {
        $credential = $this->ready();
        $order = Order::findOrFail($this->orderId);
        $saved = $order->only(['pickup_window_start_at', 'pickup_window_end_at', 'scheduled_store_closes_at', 'claim_expires_at']);
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings())->assertOk()
            ->assertJsonPath('affected_orders.0.order_id', $this->orderId);
        $this->assertEquals($saved, $order->fresh()->only(array_keys($saved)));
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertConflict();
        $this->signIn($this->shopper)->getJson($this->shopperPath('pickup'))->assertOk()->assertJsonPath('credential', null);
        $this->travelTo($order->claim_expires_at->copy()->addMinute());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->assertTrue($order->fresh()->pickup_schedule_review_required);
    }

    public function test_existing_review_uses_reschedule_reason_replaces_credentials_and_notifies_shopper(): void
    {
        $credential = $this->ready();
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings())->assertOk();
        $selection = ['pickup_date' => '2026-10-20', 'pickup_start' => '10:00', 'pickup_end' => '11:00'];
        $this->putJson($this->path('pickup-schedule'), $selection)->assertUnprocessable();
        $this->putJson($this->path('pickup-schedule'), array_merge($selection, ['reason' => 'Reviewed with Shopper after store hours changed']))->assertOk()
            ->assertJsonPath('order.pickup_schedule_review_required', false);
        $this->assertDatabaseCount('pickup_credentials', 2);
        $this->assertNotNull(PickupCredential::oldest('id')->first()->revoked_at);
        $this->assertDatabaseHas('order_resolution_logs', ['order_id' => $this->orderId, 'reason' => 'Reviewed with Shopper after store hours changed']);
        $this->signIn($this->shopper)->getJson('/api/shopper/order-notifications')->assertOk();
        $this->assertSame(1, DB::table('order_notifications')->where('type', 'like', 'rescheduled_%')->count());
        $this->travelTo(Order::findOrFail($this->orderId)->pickup_window_start_at->copy()->addHour());
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertUnprocessable();
        $this->getJson('/api/supervisor/pickup-settings')->assertOk()->assertJsonCount(0, 'affected_orders');
    }

    public function test_expired_or_struck_orders_cannot_be_revived_by_normal_rescheduling(): void
    {
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->copy()->addMinute());
        $new = ['pickup_date' => '2026-10-21', 'pickup_start' => '10:00', 'pickup_end' => '11:00', 'reason' => 'Cannot bypass expiry'];
        $this->signIn($this->supervisor)->putJson($this->path('pickup-schedule'), $new)->assertConflict();
        $this->assertDatabaseCount('pickup_credentials', 1);
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->putJson($this->path('pickup-schedule'), $new)->assertConflict();
        $this->assertDatabaseCount('cop_strikes', 1);
        $this->assertDatabaseCount('order_resolution_logs', 0);
    }

    public function test_paid_holding_deadline_survives_settings_changes_and_expiry_keeps_payment_and_reservations(): void
    {
        $this->store->forceFill(['paid_order_holding_hours' => 48])->save();
        $this->recordProviderPayment();
        $this->ready();
        $order = Order::findOrFail($this->orderId);
        $deadline = $order->claim_expires_at->copy();
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings(['paid_order_holding_hours' => 24]))->assertOk();
        $this->assertTrue($order->fresh()->claim_expires_at->equalTo($deadline));
        $this->travelTo($deadline->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertSame('unclaimed_pending_resolution', $order->fresh()->claim_status);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame('pending_decision', $order->fresh()->refund_status);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->assertDatabaseCount('order_payments', 1);
    }

    public function test_unrelated_weekday_change_does_not_flag_an_order_for_review(): void
    {
        $hours = $this->store->operating_hours;
        $pickup = $hours;
        $hours[7] = ['opens_at' => '09:00', 'closes_at' => '20:00'];
        $pickup[7] = ['opens_at' => '10:00', 'closes_at' => '18:00'];
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', [
            'operating_hours' => $hours, 'pickup_service_hours' => $pickup, 'paid_order_holding_hours' => null,
        ])->assertOk()->assertJsonCount(0, 'affected_orders');
        $this->assertFalse(Order::findOrFail($this->orderId)->pickup_schedule_review_required);
    }
}
