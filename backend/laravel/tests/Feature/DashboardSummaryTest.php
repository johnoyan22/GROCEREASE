<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class DashboardSummaryTest extends TransactionTestCase
{
    private string $endpoint = '/api/dashboard/summary';

    public function test_shopper_sees_only_own_active_orders_and_all_unread_notifications(): void
    {
        for ($i = 0; $i < 55; $i++) DB::table('order_notifications')->insert([
            'user_id' => $this->shopper->id, 'order_id' => $this->orderId, 'type' => 'fixture_'.$i,
            'message' => 'Real update', 'read_at' => $i === 0 ? now() : null, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->signIn($this->shopper)->getJson($this->endpoint)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('active_orders', 1)->assertJsonPath('unread_notifications', 54)
            ->assertJsonPath('recent_active_orders.0.order_id', $this->orderId)->assertJsonPath('recent_active_orders.0.item_quantity', 2);
        $this->signIn($this->other)->getJson($this->endpoint)->assertOk()->assertJsonPath('active_orders', 0)
            ->assertJsonPath('unread_notifications', 0)->assertJsonCount(0, 'recent_active_orders');
        $this->getJson($this->endpoint.'?shopper_user_id='.$this->shopper->id)->assertUnprocessable();
    }

    public function test_cancellation_and_physical_completion_refresh_active_counts_and_verified_sales(): void
    {
        $second = $this->placeOrder();
        $this->signIn($this->shopper)->putJson('/api/shopper/orders/'.$second.'/cancellation', ['reason' => 'Changed plan'])->assertOk();
        $this->getJson($this->endpoint)->assertOk()->assertJsonPath('active_orders', 1);
        $credential = $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->pickup_window_start_at->copy()->addMinutes(5));
        $this->cash();
        $this->signIn($this->admin)->getJson($this->endpoint)->assertOk()->assertJsonPath('todays_sales_centavos', 13400);
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
        $this->signIn($this->shopper)->getJson($this->endpoint)->assertOk()->assertJsonPath('active_orders', 0);
        $this->signIn($this->admin)->getJson($this->endpoint)->assertOk()->assertJsonPath('active_orders', 0)->assertJsonPath('todays_sales_centavos', 13400);
    }

    public function test_staff_summary_is_own_store_and_counts_physical_reserved_and_available_separately(): void
    {
        $this->inventory->forceFill(['low_stock_threshold' => 99])->save();
        $this->assignWorker();
        $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-adjustments', [
            'requested_hard_stock_qty' => 105, 'expected_stock_version' => $this->inventory->fresh()->stock_version, 'reason' => 'Count',
        ])->assertCreated();
        foreach ([$this->inventoryWorker, $this->supervisor] as $user) {
            $this->signIn($user)->getJson($this->endpoint)->assertOk()->assertJsonPath('store.store_id', $this->store->store_id)
                ->assertJsonPath('physical_units', 100)->assertJsonPath('reserved_units', 2)->assertJsonPath('available_units', 98)
                ->assertJsonPath('products_managed', 1)->assertJsonPath('low_stock_products', 1)
                ->assertJsonPath('pending_stock_approvals', 1)->assertJsonPath('busy_workers', 1)->assertJsonPath('available_workers', 0);
            $this->getJson($this->endpoint.'?store_id='.$this->otherStore->store_id)->assertUnprocessable();
        }
        $this->signIn($this->foreign)->getJson($this->endpoint)->assertOk()->assertJsonPath('active_orders', 0)
            ->assertJsonPath('physical_units', 0)->assertJsonPath('busy_workers', 0)->assertJsonPath('pending_stock_approvals', 0)
            ->assertJsonCount(0, 'recent_adjustments');
    }

    public function test_staff_reads_recheck_approval_assignment_and_store_status(): void
    {
        $this->supervisor->forceFill(['staff_approved_at' => null])->save();
        $this->signIn($this->supervisor)->getJson($this->endpoint)->assertForbidden();
        $this->store->update(['status' => 'inactive']);
        $this->signIn($this->inventoryWorker)->getJson($this->endpoint)->assertForbidden();
    }

    public function test_admin_counts_registered_accounts_thresholds_current_restrictions_and_no_fake_fees(): void
    {
        $this->inventory->forceFill(['low_stock_threshold' => 98])->save();
        $ids = [$this->orderId, $this->placeOrder(), $this->placeOrder()];
        foreach ($ids as $index => $id) DB::table('cop_strikes')->insert([
            'order_id' => $id, 'shopper_user_id' => $this->shopper->id, 'store_id' => $this->store->store_id,
            'strike_number_at_issue' => $index + 1, 'issued_at' => now()->subDays(40), 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->signIn($this->admin)->getJson($this->endpoint)->assertOk()->assertJsonPath('total_users', User::count())
            ->assertJsonPath('active_orders', 3)->assertJsonPath('low_stock_products', 1)->assertJsonPath('cop_restricted_accounts', 1)
            ->assertJsonPath('todays_sales_centavos', 0)->assertJsonPath('service_charge_pool_centavos', null)
            ->assertJsonPath('subscription_revenue_centavos', null);
        DB::table('cop_strikes')->where('order_id', $ids[2])->update(['voided_at' => now()]);
        $this->getJson($this->endpoint)->assertOk()->assertJsonPath('cop_restricted_accounts', 0);
        DB::table('cop_strikes')->where('order_id', $ids[1])->update(['issued_at' => now()]);
        $this->getJson($this->endpoint)->assertOk()->assertJsonPath('cop_restricted_accounts', 1);
    }

    public function test_sales_use_manila_payment_confirmation_day_and_require_exact_evidence(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 20)->setTime(16, 30)); // Oct 21, 00:30 Manila.
        $this->recordProviderPayment();
        $this->signIn($this->admin)->getJson($this->endpoint)->assertOk()->assertJsonPath('todays_sales_centavos', 13400)
            ->assertJsonPath('reporting_period.start', '2026-10-20T16:00:00+00:00');
        DB::table('order_payments')->where('order_id', $this->orderId)->update(['amount_centavos' => 1]);
        $this->getJson($this->endpoint)->assertOk()->assertJsonPath('todays_sales_centavos', 0);
        DB::table('order_payments')->where('order_id', $this->orderId)->update(['amount_centavos' => 13400, 'confirmed_at' => now()->subHour()]);
        $this->getJson($this->endpoint)->assertOk()->assertJsonPath('todays_sales_centavos', 0);
    }

    public function test_no_show_and_released_orders_are_excluded_from_active_counts(): void
    {
        Order::findOrFail($this->orderId)->forceFill(['claim_status' => 'no_show'])->save();
        $this->signIn($this->shopper)->getJson($this->endpoint)->assertOk()->assertJsonPath('active_orders', 0);
        Order::findOrFail($this->orderId)->forceFill(['claim_status' => 'awaiting_preparation', 'reservation_status' => 'released'])->save();
        $this->getJson($this->endpoint)->assertOk()->assertJsonPath('active_orders', 0);
    }

    public function test_unverified_and_unauthenticated_access_is_denied(): void
    {
        $this->app['auth']->forgetGuards();
        auth('web')->logout();
        $this->getJson($this->endpoint)->assertUnauthorized();
        $this->shopper->forceFill(['email_verified_at' => null])->save();
        $this->signIn($this->shopper)->getJson($this->endpoint)->assertForbidden();
    }
}
