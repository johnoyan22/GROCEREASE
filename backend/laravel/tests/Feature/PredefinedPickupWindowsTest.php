<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PickupCredential;
use App\Services\CheckoutPricing;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\TransactionTestCase;

class PredefinedPickupWindowsTest extends TransactionTestCase
{
    private function configure(int $preparation = 60, int $length = 60, string $pickupOpen = '08:00', string $pickupClose = '18:00', string $storeOpen = '08:00', string $storeClose = '18:00'): void
    {
        $this->store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => $storeOpen, 'closes_at' => $storeClose]),
            'pickup_service_hours' => array_fill(1, 7, ['opens_at' => $pickupOpen, 'closes_at' => $pickupClose]),
            'pickup_preparation_minutes' => $preparation, 'pickup_window_minutes' => $length])->save();
    }
    private function availability(string $date = '2026-10-20')
    {
        return $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/pickup-hours?date='.$date);
    }
    private function settings(array $overrides = []): array
    {
        $store = $this->store->fresh();
        return array_replace(['operating_hours' => $store->operating_hours, 'pickup_service_hours' => $store->pickup_service_hours ?? $store->operating_hours,
            'paid_order_holding_hours' => $store->paid_order_holding_hours, 'pickup_preparation_minutes' => $store->pickup_preparation_minutes, 'pickup_window_minutes' => $store->pickup_window_minutes], $overrides);
    }
    // An authenticated test-only token isolates new-placement scheduling validation
    // from cart authentication, including schedules a real quote endpoint rejects.
    private function placement(array $cart, ?string $key = null): array
    {
        return [...$cart, 'idempotency_key' => $key ?? (string) Str::uuid(), 'quote_token' => Crypt::encryptString(json_encode([
            'shopper_user_id' => $this->shopper->id, 'cart_hash' => app(CheckoutPricing::class)->cartHash(app(CheckoutPricing::class)->validatedCart(\Illuminate\Http\Request::create('/', 'POST', array_intersect_key($cart, array_flip(['store_id', 'items', 'pickup_date', 'pickup_start', 'pickup_end', 'payment_method', 'payment_channel']))))),
            'price_hash' => str_repeat('a', 64), 'expires_at' => now()->addMinutes(5)->timestamp,
        ]))];
    }

    public static function timing(): array
    {
        return [['07:00:00', '09:00'], ['09:00:00', '10:00'], ['09:00:01', '11:00'], ['10:15:00', '12:00'],
            ['16:00:00', '17:00'], ['16:00:01', null], ['18:00:01', null], ['23:59:59', null]];
    }
    #[DataProvider('timing')]
    public function test_exact_time_boundaries_use_full_manila_instants(string $time, ?string $first): void
    {
        $this->configure();
        $this->travelTo(CarbonImmutable::parse('2026-10-20 '.$time, 'Asia/Manila'));
        $response = $this->availability()->assertOk()->assertJsonPath('hours.today', '2026-10-20');
        $response->assertJsonPath('hours.earliest_start_at', $first);
        $windows = $response->json('hours.windows');
        if ($first === null) $this->assertSame([], $windows);
        else $this->assertSame(['pickup_start' => '17:00', 'pickup_end' => '18:00'], end($windows));
    }

    public function test_future_day_preparation_uses_store_opening_not_closed_overnight_time(): void
    {
        $this->configure();
        $this->availability()->assertOk()->assertJsonPath('hours.windows.0.pickup_start', '09:00');
        $this->configure(pickupOpen: '10:00');
        $this->availability()->assertOk()->assertJsonPath('hours.windows.0.pickup_start', '10:00');
        $this->store->forceFill(['pickup_service_hours' => null])->save();
        $this->availability()->assertOk()->assertJsonPath('hours.windows.0.pickup_start', '09:00');
    }

    public function test_two_hour_grid_and_non_hour_opening_have_exact_lengths_without_truncated_tail(): void
    {
        $this->configure(length: 120);
        $this->assertSame([
            ['pickup_start' => '10:00', 'pickup_end' => '12:00'], ['pickup_start' => '12:00', 'pickup_end' => '14:00'],
            ['pickup_start' => '14:00', 'pickup_end' => '16:00'], ['pickup_start' => '16:00', 'pickup_end' => '18:00'],
        ], $this->availability()->assertOk()->json('hours.windows'));
        $this->configure(pickupOpen: '08:30');
        $windows = $this->availability()->assertOk()->json('hours.windows');
        $this->assertSame(['pickup_start' => '09:30', 'pickup_end' => '10:30'], $windows[0]);
        $this->assertSame(['pickup_start' => '16:30', 'pickup_end' => '17:30'], end($windows));
        $this->configure(30, 60, '08:30', '18:30', '08:00', '19:00');
        $this->availability()->assertOk()->assertJsonPath('hours.windows.0.pickup_start', '08:30')->assertJsonPath('hours.windows.9.pickup_end', '18:30');
    }

    public static function preparations(): array { return [[30, '09:00'], [60, '09:00'], [90, '10:00'], [120, '10:00'], [180, '11:00']]; }
    #[DataProvider('preparations')]
    public function test_each_supported_preparation_value_persists_and_controls_new_windows(int $minutes, string $first): void
    {
        $this->configure();
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings(['pickup_preparation_minutes' => $minutes]))->assertOk()->assertJsonPath('pickup_preparation_minutes', $minutes);
        $this->availability()->assertOk()->assertJsonPath('hours.windows.0.pickup_start', $first);
    }

    public function test_unconfigured_invalid_closed_suspended_inactive_and_past_dates_have_no_bookable_windows(): void
    {
        $this->configure();
        $this->availability('2026-10-18')->assertUnprocessable();
        $this->availability('2026-02-30')->assertUnprocessable();
        $hours = $this->store->operating_hours; $hours[2] = null;
        $this->store->forceFill(['operating_hours' => $hours])->save();
        $this->availability()->assertUnprocessable();
        $this->configure();
        $this->signIn($this->supervisor)->postJson('/api/supervisor/pickup-closures', ['date' => '2026-10-20', 'reason' => 'Temporary closure'])->assertOk();
        $this->availability()->assertUnprocessable();
        $this->availability('2026-10-21')->assertOk();
        $this->store->update(['status' => 'inactive']); $this->availability('2026-10-21')->assertNotFound();
        $this->store->update(['status' => 'active']);
        $this->store->forceFill(['operating_hours' => null])->save(); $this->availability('2026-10-21')->assertUnprocessable();
        $this->store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => [], 'closes_at' => '18:00'])])->save();
        $this->availability('2026-10-21')->assertUnprocessable();
        $this->configure(); $this->store->forceFill(['pickup_preparation_minutes' => 0])->save(); $this->availability('2026-10-21')->assertStatus(503);
        Schema::table('stores', fn ($table) => $table->dropColumn('pickup_window_minutes'));
        $this->availability('2026-10-21')->assertStatus(503);
    }

    public function test_server_default_date_and_midnight_do_not_use_utc_calendar_day(): void
    {
        $this->configure();
        $this->travelTo(CarbonImmutable::parse('2026-10-19 16:00:01', 'UTC'));
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/pickup-hours')->assertOk()
            ->assertJsonPath('hours.date', '2026-10-20')->assertJsonPath('hours.today', '2026-10-20')->assertJsonPath('hours.windows.0.pickup_start', '09:00');
        $this->availability('2026-10-19')->assertUnprocessable();
    }

    public static function invalidWindows(): array { return [['10:00', '18:00'], ['10:15', '11:15'], ['09:00', '10:00'], ['17:00', '18:01']]; }
    #[DataProvider('invalidWindows')]
    public function test_quote_and_new_placement_reject_forged_off_grid_and_too_soon_pairs_without_side_effects(string $start, string $end): void
    {
        $this->configure(); $this->travelTo(CarbonImmutable::parse('2026-10-20 09:00:01', 'Asia/Manila'));
        $cart = $this->cart(['pickup_date' => '2026-10-20', 'pickup_start' => $start, 'pickup_end' => $end]);
        $before = $this->inventory->fresh()->getAttributes();
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertUnprocessable()->assertJsonValidationErrors('pickup_start');
        $this->postJson('/api/shopper/orders', $this->placement($cart))->assertUnprocessable()->assertJsonValidationErrors('pickup_start');
        $this->assertDatabaseCount('orders', 1); $this->assertDatabaseCount('payment_checkout_attempts', 0);
        $this->assertSame($before, $this->inventory->fresh()->getAttributes());
    }

    public function test_client_cannot_supply_policy_or_choose_the_supervisor_validation_context(): void
    {
        foreach (['pickup_preparation_minutes' => 0, 'pickup_window_minutes' => 480, 'validation_context' => 'supervisor', 'context' => 'legacy', 'window_duration' => 480] as $field => $value) {
            $cart = [...$this->cart(), $field => $value];
            $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->postJson('/api/shopper/orders', $this->placement($cart))->assertUnprocessable()->assertJsonValidationErrors($field);
        }
    }

    public static function staleCauses(): array { return [['time'], ['preparation'], ['length'], ['suspension']]; }
    #[DataProvider('staleCauses')]
    public function test_new_placement_rechecks_after_quote_when_selection_becomes_stale(string $cause): void
    {
        $this->configure(); $this->travelTo(CarbonImmutable::parse('2026-10-20 09:00:00', 'Asia/Manila'));
        $cart = $this->cart(['pickup_date' => '2026-10-20']);
        $token = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        $before = $this->inventory->fresh()->getAttributes();
        if ($cause === 'time') $this->travel(1)->seconds();
        elseif ($cause === 'suspension') $this->signIn($this->supervisor)->postJson('/api/supervisor/pickup-closures', ['date' => '2026-10-20', 'reason' => 'Unexpected outage'])->assertOk();
        else $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings($cause === 'length' ? ['pickup_window_minutes' => 120] : ['pickup_preparation_minutes' => 120]))->assertOk();
        $this->signIn($this->shopper)->postJson('/api/shopper/orders', [...$cart, 'quote_token' => $token, 'idempotency_key' => (string) Str::uuid()])->assertUnprocessable();
        $this->assertSame($before, $this->inventory->fresh()->getAttributes()); $this->assertDatabaseCount('orders', 1);
    }

    public function test_identical_placed_attempt_recovers_before_current_slot_rules_or_quote_expiry(): void
    {
        $cart = $this->cart(); $key = (string) Str::uuid();
        $token = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        $payload = [...$cart, 'quote_token' => $token, 'idempotency_key' => $key];
        $id = $this->postJson('/api/shopper/orders', $payload)->assertCreated()->json('order.order_id');
        $reserved = $this->inventory->fresh()->soft_stock_qty;
        $this->travel(3)->days(); $this->store->forceFill(['pickup_window_minutes' => 120, 'pickup_preparation_minutes' => 180])->save();
        $this->postJson('/api/shopper/orders', $payload)->assertOk()->assertJsonPath('order.order_id', $id);
        $this->postJson('/api/shopper/orders', [...$payload, 'pickup_start' => '12:00', 'pickup_end' => '13:00'])->assertConflict();
        $this->assertSame($reserved, $this->inventory->fresh()->soft_stock_qty); $this->assertDatabaseCount('orders', 2);
    }

    public function test_settings_validate_atomically_audit_deduplicate_and_preserve_existing_order_and_credentials(): void
    {
        $this->ready(); $orderBefore = Order::findOrFail($this->orderId)->getAttributes();
        $credentialsBefore = PickupCredential::firstOrFail()->getAttributes();
        $initial = $this->store->fresh()->getAttributes(); $this->assertSame(60, $this->store->fresh()->pickup_preparation_minutes);
        $valid = $this->settings(['pickup_preparation_minutes' => 90, 'pickup_window_minutes' => 120]);
        $this->signIn($this->supervisor);
        foreach ([0, -1, 1.5, 59, 'wrong', null] as $bad) {
            foreach (['pickup_preparation_minutes', 'pickup_window_minutes'] as $field) $this->putJson('/api/supervisor/pickup-settings', [...$valid, $field => $bad])->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $partial = $valid; unset($partial['pickup_preparation_minutes']);
        $this->putJson('/api/supervisor/pickup-settings', $partial)->assertUnprocessable();
        $this->assertSame($initial, $this->store->fresh()->getAttributes()); $this->assertDatabaseCount('store_schedule_logs', 0);
        $this->putJson('/api/supervisor/pickup-settings', $valid)->assertOk()->assertJsonCount(0, 'newly_affected_order_ids');
        $this->putJson('/api/supervisor/pickup-settings', $valid)->assertOk(); $this->assertDatabaseCount('store_schedule_logs', 1);
        $this->getJson('/api/supervisor/pickup-settings')->assertOk()->assertJsonPath('pickup_preparation_minutes', 90)->assertJsonPath('pickup_window_minutes', 120)
            ->assertJsonPath('schedule_history.0.previous_settings.pickup_window_minutes', 60)->assertJsonPath('schedule_history.0.new_settings.pickup_window_minutes', 120);
        $this->assertSame($orderBefore, Order::findOrFail($this->orderId)->getAttributes());
        $this->assertSame($credentialsBefore, PickupCredential::firstOrFail()->getAttributes());
        $this->assertDatabaseHas('store_schedule_logs', ['changed_by_user_id' => $this->supervisor->id]);
        $this->signIn($this->admin)->getJson('/api/admin/stores/'.$this->store->store_id.'/pickup-settings')->assertOk()->assertJsonPath('pickup_preparation_minutes', 90);
    }

    public function test_authorized_supervisor_can_review_a_legacy_window_outside_new_checkout_grid_and_lead(): void
    {
        $this->ready();
        $this->signIn($this->supervisor)->putJson('/api/supervisor/pickup-settings', $this->settings([
            'operating_hours' => array_fill(1, 7, ['opens_at' => '08:00', 'closes_at' => '18:00']),
            'pickup_service_hours' => array_fill(1, 7, ['opens_at' => '08:00', 'closes_at' => '18:00']),
            'pickup_preparation_minutes' => 180, 'pickup_window_minutes' => 120,
        ]))->assertOk();
        $selection = ['pickup_date' => '2026-10-19', 'pickup_start' => '16:15', 'pickup_end' => '16:45'];
        $this->putJson($this->path('pickup-schedule'), [...$selection, 'reason' => 'Authorized legacy-window review with Shopper'])->assertOk()->assertJsonPath('order.pickup_schedule_review_required', false);
        $this->assertDatabaseCount('pickup_credentials', 2); $this->assertNotNull(PickupCredential::oldest('id')->first()->revoked_at);
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart($selection))->assertUnprocessable();
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->travelTo(CarbonImmutable::parse('2026-10-19 16:46:00', 'Asia/Manila'));
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 0); $this->assertSame('active', Order::findOrFail($this->orderId)->reservation_status);
    }

    public function test_invalid_digital_windows_are_rejected_before_payment_or_reservation_side_effects(): void
    {
        $this->configure();
        $cart = [...$this->cart(['pickup_start' => '10:15', 'pickup_end' => '11:15']), 'payment_method' => 'digital', 'payment_channel' => 'wallet'];
        $before = $this->inventory->fresh()->getAttributes();
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertUnprocessable()->assertJsonValidationErrors('pickup_start');
        $this->postJson('/api/shopper/orders', $this->placement($cart))->assertUnprocessable()->assertJsonValidationErrors('pickup_start');
        $this->assertDatabaseCount('payment_checkout_attempts', 0); $this->assertDatabaseCount('orders', 1);
        $this->assertSame($before, $this->inventory->fresh()->getAttributes());
    }

    public function test_new_order_accepts_the_last_full_two_hour_window_and_keeps_store_closing_separate(): void
    {
        $this->configure(60, 120, '08:00', '18:00', '08:00', '21:00');
        $cart = $this->cart(['pickup_start' => '16:00', 'pickup_end' => '18:00']);
        $token = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        $id = $this->postJson('/api/shopper/orders', [...$cart, 'quote_token' => $token, 'idempotency_key' => (string) Str::uuid()])->assertCreated()->json('order.order_id');
        $order = Order::findOrFail($id);
        $this->assertSame('2026-10-20 08:00:00', $order->pickup_window_start_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-10-20 10:00:00', $order->pickup_window_end_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-10-20 13:00:00', $order->scheduled_store_closes_at->format('Y-m-d H:i:s'));
        $this->assertSame(4, $this->inventory->fresh()->soft_stock_qty); $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_additive_migration_defaults_preserve_business_rows_and_historical_settings_logs(): void
    {
        // Only this guarded in-memory fixture is used for migration compatibility.
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->ready();
        $settings = $this->settings(); unset($settings['pickup_preparation_minutes'], $settings['pickup_window_minutes']);
        DB::table('store_schedule_logs')->insert(['store_id' => $this->store->store_id, 'changed_by_user_id' => $this->supervisor->id,
            'previous_settings' => '{}', 'new_settings' => json_encode($settings), 'created_at' => now(), 'updated_at' => now()]);
        Schema::table('stores', fn ($table) => $table->dropColumn(['pickup_preparation_minutes', 'pickup_window_minutes']));
        $tables = ['stores', 'orders', 'order_items', 'pickup_credentials', 'store_schedule_logs', 'store_inventory'];
        $before = [];
        foreach ($tables as $table) $before[$table] = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
        $migration = require database_path('migrations/2026_11_17_000004_add_predefined_pickup_window_settings.php');
        $migration->up();
        foreach ($tables as $table) {
            $after = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
            if ($table === 'stores') foreach ($after as &$row) { $this->assertSame(60, $row['pickup_preparation_minutes']); $this->assertSame(60, $row['pickup_window_minutes']); unset($row['pickup_preparation_minutes'], $row['pickup_window_minutes']); } unset($row);
            $this->assertSame($before[$table], $after, $table.' retained its existing values');
        }
    }
}
