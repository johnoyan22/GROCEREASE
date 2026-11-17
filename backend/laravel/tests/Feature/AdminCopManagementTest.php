<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Services\CopPolicy;
use App\Services\CopRestrictions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\TransactionTestCase;

class AdminCopManagementTest extends TransactionTestCase
{
    private function copStatus(?int $id = null): array { return app(CopRestrictions::class)->status($id ?? $this->shopper->id); }
    private function decision(?int $id = null, array $extra = []): array
    {
        return $extra + ['expected_version' => $this->copStatus($id)['version'], 'reason' => 'Documented Admin case review', 'confirmed' => true];
    }
    private function rules(array $extra = []): array
    {
        $p = app(CopPolicy::class)->current();
        return $extra + ['expected_version' => $p['version'], 'enabled' => $p['enabled'], 'maximum_php' => number_format($p['maximum_centavos'] / 100, 2, '.', ''),
            'temporary_threshold' => $p['temporary_threshold'], 'temporary_days' => $p['temporary_days'], 'permanent_threshold' => $p['permanent_threshold'],
            'reason' => 'Approved global COP policy review', 'confirmed' => true];
    }
    private function saveRules(array $extra): array
    {
        return $this->signIn($this->admin)->putJson('/api/admin/cop/policy', $this->rules($extra))->assertOk()->json('policy');
    }
    // Test-only service fixture for replay semantics. Real deadline predicates are exercised separately.
    private function issue(int $orderId): void
    {
        DB::transaction(function () use ($orderId) {
            $id = Order::findOrFail($orderId)->shopper_user_id;
            User::whereKey($id)->lockForUpdate()->firstOrFail(); app(CopPolicy::class)->current(true);
            app(CopRestrictions::class)->issue(Order::findOrFail($orderId));
        });
    }
    private function accessPath(string $action, ?int $id = null): string { return '/api/admin/cop/accounts/'.($id ?? $this->shopper->id).'/'.$action; }

    public function test_policy_persistence_noop_audit_and_stale_version(): void
    {
        $p = $this->saveRules(['maximum_php' => '2000.01', 'temporary_threshold' => 3, 'temporary_days' => 14, 'permanent_threshold' => 5]);
        $this->assertSame(200001, $p['maximum_centavos']); $this->assertSame(2, $p['version']);
        $this->getJson('/api/admin/cop/policy')->assertOk()->assertJsonPath('policy.maximum_centavos', 200001)->assertJsonPath('history.total', 2)
            ->assertJsonPath('history.data.0.actor_user_id', $this->admin->id)->assertHeader('Cache-Control', 'no-store, private');
        $this->putJson('/api/admin/cop/policy', $this->rules())->assertOk(); $this->assertDatabaseCount('cop_policy_versions', 2);
        $this->putJson('/api/admin/cop/policy', $this->rules(['expected_version' => 1]))->assertConflict();
        $this->assertDatabaseCount('cop_policy_versions', 2);
    }

    public static function invalidRules(): array
    {
        return array_map(fn ($v) => [$v], [
            ['enabled' => 'true'], ['enabled' => 1], ['maximum_php' => 1500.01], ['maximum_php' => '1e3'], ['maximum_php' => '0'], ['maximum_php' => '-1'], ['maximum_php' => '1.001'], ['maximum_php' => '42949672.96'],
            ['temporary_threshold' => 1], ['temporary_threshold' => 101], ['temporary_threshold' => 2.5], ['permanent_threshold' => 2], ['permanent_threshold' => 101], ['temporary_days' => 0], ['temporary_days' => 366],
            ['reason' => '     '], ['reason' => '!!!!!'], ['reason' => str_repeat('x', 501)], ['confirmed' => false], ['confirmed' => '1'], ['actor_user_id' => 999], ['effective_at' => '2020-01-01'], ['version' => 10],
            ['temporary_days' => true], ['expected_version' => true], ['temporary_threshold' => '2'],
        ]);
    }
    #[DataProvider('invalidRules')]
    public function test_rule_validation_rejects_invalid_or_forged_inputs(array $extra): void
    {
        $this->signIn($this->admin)->putJson('/api/admin/cop/policy', $this->rules($extra))->assertUnprocessable();
        $this->assertDatabaseCount('cop_policy_versions', 1);
    }

    public function test_only_current_active_admin_can_read_or_mutate_and_monitoring_is_read_only(): void
    {
        foreach ([$this->shopper, $this->inventoryWorker, $this->supervisor] as $user) {
            $this->signIn($user);
            foreach (['policy', 'failed-claims', 'accounts', 'accounts/'.$this->shopper->id] as $path) $this->getJson('/api/admin/cop/'.$path)->assertForbidden();
            $this->putJson('/api/admin/cop/policy', $this->rules())->assertForbidden();
            $this->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'until_restored']))->assertForbidden();
            $this->putJson($this->accessPath('restoration'), $this->decision())->assertForbidden();
        }
        $this->admin->forceFill(['account_status' => 'inactive'])->save();
        $this->signIn($this->admin)->putJson('/api/admin/cop/policy', $this->rules())->assertForbidden();
        $this->assertDatabaseCount('cop_access_events', 0);
    }

    public function test_dynamic_maximum_equal_above_and_policy_change_requires_new_review_without_stock_changes(): void
    {
        $this->saveRules(['maximum_php' => '134.00']);
        $cart = $this->cart(); $key = (string) Str::uuid();
        $quote = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->assertJsonPath('quote.cop_policy.maximum_centavos', 13400)->json('quote_token');
        $stock = $this->inventory->fresh()->soft_stock_qty;
        $this->inventory->selling_price = '67.01'; $this->inventory->save();
        $this->postJson('/api/shopper/checkout/quote', $cart)->assertUnprocessable();
        $this->inventory->selling_price = '67.00'; $this->inventory->save();
        $this->saveRules(['maximum_php' => '135.00']);
        $this->signIn($this->shopper)->postJson('/api/shopper/orders', $cart + ['quote_token' => $quote, 'idempotency_key' => $key])->assertConflict();
        $this->assertSame($stock, $this->inventory->fresh()->soft_stock_qty);
        $this->inventory->selling_price = '135.01'; $this->inventory->save();
        $single = $cart; $single['items'][0]['quantity'] = 1;
        $this->postJson('/api/shopper/checkout/quote', $single)->assertUnprocessable();
        $this->inventory->selling_price = '135.00'; $this->inventory->save();
        $this->postJson('/api/shopper/checkout/quote', $single)->assertOk();
    }

    public function test_matching_retry_precedes_new_policy_access_and_quote_checks_but_changed_cart_fails(): void
    {
        $cart = $this->cart(); $key = (string) Str::uuid();
        $quote = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        $payload = $cart + ['quote_token' => $quote, 'idempotency_key' => $key];
        $id = $this->postJson('/api/shopper/orders', $payload)->assertCreated()->json('order.order_id');
        $this->saveRules(['enabled' => false, 'maximum_php' => '1.00']);
        $this->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'until_restored']))->assertOk();
        $this->signIn($this->shopper)->postJson('/api/shopper/orders', $payload)->assertOk()->assertJsonPath('order.order_id', $id);
        $payload['pickup_start'] = '11:00'; $payload['pickup_end'] = '12:00';
        $this->postJson('/api/shopper/orders', $payload)->assertConflict();
        $this->postJson('/api/shopper/checkout/quote', $cart)->assertUnprocessable();
        $this->assertSame(4, $this->inventory->fresh()->soft_stock_qty);
    }

    public function test_accepted_policy_controls_future_no_show_and_edits_do_not_retime_existing_bans(): void
    {
        $second = $this->placeOrder();
        $this->saveRules(['temporary_threshold' => 4, 'temporary_days' => 2, 'permanent_threshold' => 6, 'enabled' => false]);
        $this->issue($this->orderId); $this->travel(1)->days(); $this->issue($second);
        $before = $this->copStatus();
        $this->assertFalse($before['allowed']); $this->assertSame('temporary', $before['individual_access']);
        $this->assertSame(now()->addDays(30)->toIso8601String(), $before['disabled_until']);
        $this->saveRules(['temporary_days' => 1, 'enabled' => true]);
        $this->assertSame($before['disabled_until'], $this->copStatus()['disabled_until']);
        $this->assertSame(1, Order::findOrFail($second)->cop_policy_version_id);
        $this->assertSame(30, Order::findOrFail($second)->cop_policy_snapshot['temporary_days']);
    }

    public function test_zero_strike_manual_restriction_no_duplicate_noop_stale_change_and_logical_expiry(): void
    {
        $until = now('Asia/Manila')->addHour()->format('Y-m-d\TH:i'); $payload = $this->decision($this->other->id, ['kind' => 'temporary', 'until' => $until]);
        $this->signIn($this->admin)->putJson($this->accessPath('restriction', $this->other->id), $payload)->assertOk()->assertJsonPath('cop.allowed', false);
        $this->putJson($this->accessPath('restriction', $this->other->id), $payload)->assertConflict();
        $payload['expected_version'] = 1;
        $this->putJson($this->accessPath('restriction', $this->other->id), $payload)->assertOk();
        $this->assertDatabaseCount('cop_restrictions', 1); $this->assertDatabaseCount('cop_access_events', 1); $this->assertDatabaseCount('cop_strikes', 0);
        $this->assertSame('active', $this->other->fresh()->account_status);
        $this->travel(2)->hours(); $this->assertTrue($this->copStatus($this->other->id)['allowed']);
        $this->putJson($this->accessPath('restoration', $this->other->id), $this->decision($this->other->id))->assertConflict();
    }

    public function test_restoration_preserves_lifetime_and_starts_new_cycle_including_outstanding_old_orders(): void
    {
        $ids = [$this->orderId, $this->placeOrder(), $this->placeOrder(), $this->placeOrder(), $this->placeOrder()];
        foreach (array_slice($ids, 0, 3) as $id) $this->issue($id);
        $this->assertSame('permanent', $this->copStatus()['individual_access']);
        $this->signIn($this->admin)->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'until_restored']))->assertOk();
        $old = $this->copStatus();
        $this->putJson($this->accessPath('restoration'), $this->decision())->assertOk()->assertJsonPath('cop.strike_count', 0)->assertJsonPath('cop.lifetime_strike_count', 3)->assertJsonPath('cop.allowed', true);
        $this->assertNotSame($old['cycle_id'], $this->copStatus()['cycle_id']);
        $this->getJson('/api/admin/cop/accounts/'.$this->shopper->id)->assertOk()->assertJsonPath('cop.allowed', true)->assertJsonPath('strikes.total', 3);
        $this->issue($ids[3]); $this->assertTrue($this->copStatus()['allowed']); $this->assertSame(4, $this->copStatus()['lifetime_strike_count']);
        $this->issue($ids[4]); $this->assertSame('temporary', $this->copStatus()['individual_access']);
        $this->assertDatabaseCount('cop_strikes', 5); $this->assertSame(0, DB::table('cop_strikes')->whereNotNull('voided_at')->count());
        $this->assertSame(4, DB::table('cop_restrictions')->whereNotNull('ended_at')->count());
    }

    public function test_manual_and_automatic_overlap_and_mixed_policy_correction_replay_uses_original_clock(): void
    {
        $second = $this->placeOrder();
        $this->saveRules(['temporary_days' => 60, 'permanent_threshold' => 4]); $third = $this->placeOrder();
        $this->issue($this->orderId); $this->travel(1)->days(); $this->issue($second);
        $this->travel(1)->days(); $this->issue($third);
        $original = DB::table('cop_strikes')->where('order_id', $third)->first();
        $expiry = now()->addDays(60)->toIso8601String();
        $this->assertSame($expiry, $this->copStatus()['disabled_until']);
        $this->signIn($this->admin)->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'temporary', 'until' => now('Asia/Manila')->addHour()->format('Y-m-d\TH:i')]))->assertOk();
        $this->travel(2)->hours(); $this->assertFalse($this->copStatus()['allowed']);
        $first = DB::table('cop_strikes')->where('order_id', $this->orderId)->first();
        $this->putJson('/api/admin/cop-strikes/'.$first->id.'/correction', $this->decision())->assertOk();
        $this->assertSame($expiry, $this->copStatus()['disabled_until']);
        $row = DB::table('cop_restrictions')->where('strike_id', $original->id)->first();
        $this->assertSame(2, $row->effective_count); $this->assertSame(3, DB::table('cop_strikes')->find($original->id)->strike_number_at_issue);
        $this->assertSame(1, DB::table('cop_access_events')->where('action', 'strike_corrected')->count());
        $this->putJson('/api/admin/cop-strikes/'.$first->id.'/correction', $this->decision())->assertConflict();
    }

    public function test_old_cycle_correction_cannot_reopen_or_undo_restoration_and_manual_block_survives_correction(): void
    {
        $second = $this->placeOrder(); $third = $this->placeOrder(); $this->issue($this->orderId); $this->issue($second);
        $this->signIn($this->admin)->putJson($this->accessPath('restoration'), $this->decision())->assertOk();
        $cycle = $this->copStatus()['cycle_id']; $this->issue($third);
        $this->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'until_restored']))->assertOk();
        $first = DB::table('cop_strikes')->where('order_id', $this->orderId)->first();
        $this->putJson('/api/admin/cop-strikes/'.$first->id.'/correction', $this->decision())->assertOk()->assertJsonPath('cop.individual_access', 'until_restored');
        $this->assertSame($cycle, $this->copStatus()['cycle_id']); $this->assertSame(1, $this->copStatus()['strike_count']); $this->assertSame(2, $this->copStatus()['lifetime_strike_count']);
    }

    public function test_restoration_cannot_override_global_disable_or_reactivate_account_and_no_fake_order_notification(): void
    {
        $id = $this->other->id;
        $this->signIn($this->admin)->putJson($this->accessPath('restriction', $id), $this->decision($id, ['kind' => 'until_restored']))->assertOk();
        $this->other->forceFill(['account_status' => 'inactive'])->save(); $this->saveRules(['enabled' => false]);
        $this->putJson($this->accessPath('restoration', $id), $this->decision($id))->assertOk()->assertJsonPath('cop.allowed', false)->assertJsonPath('cop.individual_restricted', false);
        $this->assertSame('inactive', $this->other->fresh()->account_status); $this->assertDatabaseCount('order_notifications', 0);
    }

    public function test_access_validation_spoofing_target_and_stale_correction_leave_no_partial_records(): void
    {
        $this->signIn($this->admin);
        foreach (['actor_user_id' => 1, 'strike_count' => 0, 'started_at' => '2020-01-01', 'source' => 'automatic', 'account_status' => 'active', 'store_id' => 1] as $key => $value) {
            $this->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'until_restored', $key => $value]))->assertUnprocessable();
        }
        $this->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'temporary', 'until' => now('Asia/Manila')->subMinute()->format('Y-m-d\TH:i')]))->assertUnprocessable();
        $this->putJson($this->accessPath('restriction', $this->supervisor->id), $this->decision(extra: ['kind' => 'until_restored']))->assertNotFound();
        $this->assertDatabaseCount('cop_accounts', 0); $this->assertDatabaseCount('cop_access_events', 0);
    }

    public function test_transaction_rollback_preserves_access_audit_and_notifications_atomically(): void
    {
        $this->issue($this->orderId);
        $before = $this->copStatus(); $notifications = DB::table('order_notifications')->count();
        try {
            DB::transaction(function () {
                $this->saveRules(['maximum_php' => '2000.00']);
                $this->signIn($this->admin)->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'until_restored']))->assertOk();
                throw new RuntimeException('Rollback fixture');
            });
        } catch (RuntimeException $e) { $this->assertSame('Rollback fixture', $e->getMessage()); }
        $this->assertSame($before['version'], $this->copStatus()['version']); $this->assertTrue($this->copStatus()['allowed']);
        $this->assertDatabaseCount('cop_access_events', 0); $this->assertDatabaseCount('cop_restrictions', 1); $this->assertDatabaseCount('order_notifications', $notifications);
        $this->assertDatabaseCount('cop_policy_versions', 1); $this->assertSame(1, app(CopPolicy::class)->current()['version']);
    }

    public function test_real_no_show_history_survives_resale_and_details_exclude_claimant_and_payment_secrets(): void
    {
        $this->ready(); $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0); $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_failed_claims', 1);
        $id = $this->signIn($this->admin)->getJson('/api/admin/cop/failed-claims')->assertOk()->assertJsonPath('incidents.data.0.classification', 'no_show')->assertJsonPath('incidents.data.0.strike_status', 'recorded')->json('incidents.data.0.id');
        $this->signIn($this->supervisor)->putJson($this->path('resale-disposition'), ['all_items_suitable_for_resale' => true, 'reason' => 'Goods physically suitable for resale'])->assertOk();
        $this->signIn($this->admin)->getJson('/api/admin/cop/failed-claims?resolution=resolved')->assertOk()->assertJsonPath('incidents.total', 1)->assertJsonPath('incidents.data.0.claim_status', 'canceled');
        $json = $this->getJson('/api/admin/cop/failed-claims/'.$id)->assertOk()->assertJsonPath('incident.classification', 'no_show')->assertJsonPath('current.reservation_status', 'released')->getContent();
        foreach (['pin', 'qr_token', 'evidence_reference', 'claimant_check_note', 'phone_number'] as $secret) $this->assertStringNotContainsString('"'.$secret.'"', $json);
        $this->postJson('/api/admin/cop/failed-claims/'.$id, ['claim_status' => 'completed'])->assertMethodNotAllowed();
    }

    public function test_paid_digital_and_cash_unclaimed_have_no_strikes_and_cancellations_are_not_incidents(): void
    {
        $this->store->forceFill(['paid_order_holding_hours' => 24])->save(); $this->recordProviderPayment(); $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond()); $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $cashId = $this->placeOrder(); $this->ready($cashId); $this->orderId = $cashId; $this->cash();
        $this->travelTo(Order::findOrFail($cashId)->claim_expires_at->addSecond()); $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $cancel = $this->placeOrder(); $this->signIn($this->shopper)->putJson('/api/shopper/orders/'.$cancel.'/cancellation', ['reason' => 'Ordinary cancellation'])->assertOk();
        $this->assertDatabaseCount('cop_failed_claims', 2); $this->assertDatabaseCount('cop_strikes', 0);
        $this->signIn($this->admin)->getJson('/api/admin/cop/failed-claims?classification=paid_unclaimed&strike_status=not_applicable')->assertOk()->assertJsonPath('incidents.total', 2);
        $this->assertTrue($this->copStatus()['allowed']);
    }

    public function test_failed_claim_filters_manila_midnight_pagination_and_literal_search(): void
    {
        $second = $this->placeOrder();
        foreach ([[$this->orderId, '2026-10-20 15:59:59'], [$second, '2026-10-20 16:00:00']] as [$id, $at]) {
            DB::table('cop_failed_claims')->insert(['order_id' => $id, 'classification' => 'no_show', 'payment_method' => 'cash_on_pickup', 'payment_state' => 'unpaid', 'incident_at' => $at, 'evidence_source' => 'test_fixture']);
        }
        $this->signIn($this->admin)->getJson('/api/admin/cop/failed-claims?from=2026-10-21&until=2026-10-21&store_id='.$this->store->store_id.'&payment_method=cash_on_pickup&classification=no_show&strike_status=requires_review')->assertOk()->assertJsonPath('incidents.total', 1)->assertJsonPath('incidents.data.0.order_id', $second);
        $this->getJson('/api/admin/cop/failed-claims?per_page=1&page=2')->assertOk()->assertJsonPath('incidents.current_page', 2)->assertJsonCount(1, 'incidents.data');
        $this->getJson('/api/admin/cop/failed-claims?search=GE-ORD-'.str_pad((string) $second, 8, '0', STR_PAD_LEFT))->assertOk()->assertJsonPath('incidents.total', 1);
        $this->getJson('/api/admin/cop/failed-claims?search=%25')->assertOk()->assertJsonPath('incidents.total', 0);
        foreach (['per_page=51', 'from=2026-10-21', 'from=2026-10-22&until=2026-10-21', 'from=2020-01-01&until=2026-01-01', 'shopper_user_id=1'] as $query) $this->getJson('/api/admin/cop/failed-claims?'.$query)->assertUnprocessable();
    }

    public function test_real_shopper_account_search_includes_no_strikes_with_server_eligibility_filter(): void
    {
        $this->signIn($this->admin)->putJson($this->accessPath('restriction', $this->other->id), $this->decision($this->other->id, ['kind' => 'until_restored']))->assertOk();
        $this->getJson('/api/admin/cop/accounts?eligibility=manual')->assertOk()->assertJsonPath('accounts.total', 1)->assertJsonPath('accounts.data.0.user_id', $this->other->id)->assertJsonPath('accounts.data.0.cop.strike_count', 0);
        $this->getJson('/api/admin/cop/accounts?eligibility=available')->assertOk()->assertJsonPath('accounts.total', 1)->assertJsonPath('accounts.data.0.user_id', $this->shopper->id);
        $this->getJson('/api/admin/cop/accounts?search='.urlencode($this->other->email))->assertOk()->assertJsonPath('accounts.total', 1);
        $this->getJson('/api/admin/cop/accounts?per_page=1&page=2')->assertOk()->assertJsonCount(1, 'accounts.data');
    }

    public function test_existing_cash_order_still_claims_and_new_prepaid_checkout_remains_available(): void
    {
        $secret = $this->ready();
        $this->signIn($this->admin)->putJson($this->accessPath('restriction'), $this->decision(extra: ['kind' => 'until_restored']))->assertOk();
        $this->saveRules(['enabled' => false]);
        $this->cash();
        $order = Order::findOrFail($this->orderId); $this->travelTo($order->pickup_window_start_at->copy()->addMinute());
        $this->signIn($this->supervisor)->postJson($this->path('claim'), ['method' => 'pin', 'credential' => $secret['pin'], 'claiming_as' => 'shopper', 'identity_checked' => true, 'physically_handed_over' => true])->assertOk();
        $this->assertDatabaseHas('orders', ['order_id' => $this->orderId, 'claim_status' => 'completed']);
        config(['payments.mode' => 'test', 'payments.merchants' => [$this->store->store_id => ['merchant_id' => 'org_fixture', 'secret_key' => 'sk_test_fixture', 'webhook_secret' => 'whsec_fixture', 'methods' => ['gcash', 'card']]]]);
        $this->store->forceFill(['paid_order_holding_hours' => 24])->save();
        $cart = $this->cart(['payment_method' => 'digital', 'payment_channel' => 'wallet']);
        $quote = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        $this->postJson('/api/shopper/orders', $cart + ['quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()])->assertCreated()->assertJsonPath('order.payment_status', 'unpaid');
        $this->assertFalse($this->copStatus()['allowed']);
    }

    public function test_deadline_failure_rolls_back_strike_audit_cycle_and_notices(): void
    {
        $this->ready(); $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->mock(\App\Services\OrderNotifications::class)->shouldReceive('notify')->once()->andThrow(new RuntimeException('Notice failure fixture'));
        try { app(\App\Services\OrderDeadlines::class)->process(); $this->fail('Expected fixture failure.'); }
        catch (RuntimeException $e) { $this->assertSame('Notice failure fixture', $e->getMessage()); }
        foreach (['cop_strikes', 'cop_accounts', 'cop_cycles', 'cop_restrictions', 'cop_failed_claims', 'cop_access_events'] as $table) $this->assertDatabaseCount($table, 0);
        $this->assertDatabaseHas('orders', ['order_id' => $this->orderId, 'claim_status' => 'claimable', 'reservation_status' => 'active']);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
    }

    public function test_correction_notice_failure_rolls_back_void_projection_audit_and_version(): void
    {
        $this->issue($this->orderId); $before = $this->copStatus();
        $strike = DB::table('cop_strikes')->first();
        $this->mock(\App\Services\OrderNotifications::class)->shouldReceive('notify')->once()->andThrow(new RuntimeException('Correction notice failure'));
        $this->withoutExceptionHandling();
        try {
            $this->signIn($this->admin)->putJson('/api/admin/cop-strikes/'.$strike->id.'/correction', $this->decision());
            $this->fail('Expected fixture failure.');
        } catch (RuntimeException $e) { $this->assertSame('Correction notice failure', $e->getMessage()); }
        $this->assertDatabaseHas('cop_strikes', ['id' => $strike->id, 'voided_at' => null]);
        $this->assertDatabaseHas('cop_restrictions', ['strike_id' => $strike->id, 'effective_count' => 1]);
        $this->assertDatabaseCount('cop_access_events', 0); $this->assertSame($before['version'], $this->copStatus()['version']);
        $this->assertDatabaseCount('order_notifications', 1);
    }

    public function test_explicit_as_of_uses_cycle_and_expiry_at_that_instant(): void
    {
        $second = $this->placeOrder(); $this->issue($this->orderId); $this->issue($second);
        $asOf = \Carbon\CarbonImmutable::now('UTC'); $cycle = $this->copStatus()['cycle_id'];
        $this->travel(1)->days();
        $this->signIn($this->admin)->putJson($this->accessPath('restoration'), $this->decision())->assertOk();
        $this->assertTrue($this->copStatus()['allowed']);
        $historical = app(CopRestrictions::class)->status($this->shopper->id, $asOf);
        $this->assertSame($cycle, $historical['cycle_id']); $this->assertFalse($historical['allowed']);
        $availableAt = \Carbon\CarbonImmutable::now('UTC'); $this->travel(1)->days();
        $this->saveRules(['enabled' => false]);
        $this->assertFalse($this->copStatus()['allowed']);
        $this->assertTrue(app(CopRestrictions::class)->status($this->shopper->id, $availableAt)['allowed']);
    }

    public function test_cop_report_global_no_activity_manual_accounts_distinct_sources_and_historical_snapshot(): void
    {
        $this->signIn($this->admin)->putJson($this->accessPath('restriction', $this->other->id), $this->decision($this->other->id, ['kind' => 'until_restored']))->assertOk();
        $body = ['type' => 'cop', 'from' => '2026-10-19', 'until' => '2026-10-21'];
        $report = $this->postJson('/api/reports', $body)->assertCreated()->json('report');
        $this->assertSame(1, $report['sections'][1]['rows'][0]['until_restored']); $this->assertSame(1, $report['sections'][2]['rows'][0]['manual_only']);
        $this->assertSame(1, $report['sections'][3]['rows'][0]['restricted']);
        $store = $this->postJson('/api/reports', $body + ['store_id' => $this->store->store_id])->assertCreated()->json('report');
        $this->assertSame(0, $store['sections'][1]['rows'][0]['until_restored']);
        $this->putJson($this->accessPath('restoration', $this->other->id), $this->decision($this->other->id))->assertOk();
        $this->getJson('/api/reports/'.$report['id'])->assertOk()->assertJsonPath('report.sections.1.rows.0.until_restored', 1);
        $pdf = $this->get('/api/reports/'.$report['id'].'/pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf')->getContent();
        $this->assertStringStartsWith('%PDF-', $pdf);
        $fresh = $this->postJson('/api/reports', $body)->assertCreated()->json('report');
        $this->assertSame(0, $fresh['sections'][1]['rows'][0]['until_restored']); $this->assertSame(1, $fresh['sections'][3]['rows'][0]['restored']);
    }

    public function test_report_source_budget_includes_shared_evaluation_and_later_decision_rows(): void
    {
        $this->signIn($this->admin)->putJson($this->accessPath('restriction', $this->other->id), $this->decision($this->other->id, ['kind' => 'until_restored']))->assertOk();
        // Two cohort IDs, two users, one account, one cycle, one manual outcome, one policy = 8.
        // The ninth source row is the Admin decision; it must also count against the common budget.
        config(['reports.max_source_rows' => 8]);
        $this->postJson('/api/reports', ['type' => 'cop', 'from' => '2026-10-19', 'until' => '2026-10-21'])->assertUnprocessable();
    }
}
