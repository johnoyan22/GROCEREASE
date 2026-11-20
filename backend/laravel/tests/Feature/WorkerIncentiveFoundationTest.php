<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Store;
use App\Services\FinancialLedger;
use App\Services\WorkerIncentives;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Support\TransactionTestCase;

// Service-boundary tests for the pre-implementation checkpoint. Production fulfillment
// hooks, API validation/authorization and the workspace are deliberately not wired yet.
class WorkerIncentiveFoundationTest extends TransactionTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    private function operation(string $action, array $in, string $mode = 'actual', ?string $key = null): array
    {
        return app(WorkerIncentives::class)->execute($this->admin->id, $this->store->store_id, $mode, $action, $key ?? (string) Str::uuid(), $in + ['reason' => 'Isolated service boundary test']);
    }

    private function fund(string $mode = 'actual'): void
    {
        $ledger = app(FinancialLedger::class); $base = ['reason' => 'Isolated approved source'];
        $post = fn ($action, $in) => $ledger->execute($this->admin->id, $this->store->store_id, $mode, $action, (string) Str::uuid(), $in + $base);
        $post('agreement', ['amount' => '100.00', 'period' => 'monthly', 'starts_on' => '2026-10-01', 'status' => 'active', 'expected_version' => 0]);
        $bill = $post('bill', ['coverage_from' => '2026-10-01', 'due_on' => '2026-10-18', 'expected_version' => 1]);
        $receipt = $post('payment', ['id' => $bill['id'], 'amount' => '100.00', 'paid_on' => '2026-10-18', 'method' => 'cash', 'evidence' => 'Fixture-only receipt '.$mode]);
        $post('verify', ['id' => $receipt['id'], 'expected_version' => 1]);
        $post('contribute', ['id' => $receipt['id'], 'amount' => '100.00']);
    }

    private function plan(string $rate = '10.01', string $allocation = '100.00', string $mode = 'actual'): int
    {
        $this->fund($mode);
        $p = $this->operation('plan', ['name' => 'Explicit isolated plan', 'rate' => $rate, 'effective_on' => '2026-10-19'], $mode);
        $this->assertSame('inactive', $p['status']);
        $this->operation('allocate', ['id' => $p['id'], 'expected_version' => 1, 'amount' => $allocation], $mode);
        $this->operation('rules', ['id' => $p['id'], 'expected_version' => 2, 'status' => 'active', 'rate' => $rate, 'effective_on' => '2026-10-19'], $mode);
        return $p['id'];
    }

    private function enroll(int $order): object
    {
        DB::transaction(function () use ($order) {
            Store::whereKey($this->store->store_id)->lockForUpdate()->firstOrFail();
            app(WorkerIncentives::class)->commitLocked(Order::whereKey($order)->lockForUpdate()->firstOrFail(), $this->supervisor->id);
        });
        return DB::table('worker_incentive_commitments')->where('order_id', $order)->firstOrFail();
    }

    private function fails(int $status, callable $call): void
    {
        try { $call(); $this->fail('Expected rejection'); }
        catch (HttpException $e) { $this->assertSame($status, $e->getStatusCode()); }
    }

    public function test_inactive_default_and_unfunded_activation_cannot_promise_rewards(): void
    {
        $p = $this->operation('plan', ['name' => 'Inactive only', 'rate' => '10.00', 'effective_on' => '2026-10-19']);
        $this->fails(409, fn () => $this->operation('rules', ['id' => $p['id'], 'expected_version' => 1, 'status' => 'active', 'rate' => '10.00', 'effective_on' => '2026-10-19']));
        $this->assertSame('not_included', $this->enroll($this->orderId)->status);
        $this->assertDatabaseCount('incentive_budgets', 0);
        $this->assertDatabaseCount('worker_incentive_earnings', 0);
        Http::assertNothingSent();
    }

    public function test_commitments_keep_rate_snapshots_and_pause_does_not_return_promised_funds(): void
    {
        $plan = $this->plan(); $c = $this->enroll($this->orderId);
        $this->assertSame('committed', $c->status); $this->assertSame(1001, (int) $c->amount_centavos);
        $this->operation('rules', ['id' => $plan, 'expected_version' => 3, 'status' => 'inactive', 'rate' => '2.00', 'effective_on' => '2026-10-19']);
        $again = $this->enroll($this->orderId);
        $this->assertSame($c->id, $again->id); $this->assertSame($c->rule_snapshot, $again->rule_snapshot);
        $this->assertSame(8999, app(WorkerIncentives::class)->capacity($plan));
        $this->fails(409, fn () => $this->operation('return_unused', ['id' => $plan, 'expected_version' => 4, 'amount' => '100.00']));
        $this->assertDatabaseCount('worker_incentive_commitments', 1);
    }

    public function test_exhausted_capacity_never_blocks_orders_or_retroactively_enrolls_them(): void
    {
        $plan = $this->plan('10.01', '10.01'); $this->enroll($this->orderId);
        $other = $this->placeOrder(); $this->assertSame('not_included', $this->enroll($other)->status);
        $this->operation('allocate', ['id' => $plan, 'expected_version' => 3, 'amount' => '10.01']);
        $this->assertSame('not_included', $this->enroll($other)->status);
        DB::transaction(function () {
            Store::whereKey($this->store->store_id)->lockForUpdate()->firstOrFail();
            $o = Order::whereKey($this->orderId)->lockForUpdate()->firstOrFail();
            app(WorkerIncentives::class)->releaseLocked($o);
            $this->assertSame('committed', DB::table('worker_incentive_commitments')->where('order_id', $o->order_id)->value('status'));
            $o->status = 'canceled'; $o->save();
            app(WorkerIncentives::class)->releaseLocked($o, $this->supervisor->id);
            app(WorkerIncentives::class)->releaseLocked($o, $this->supervisor->id);
        });
        $this->assertSame(2002, app(WorkerIncentives::class)->capacity($plan));
        $this->assertSame(1, DB::table('worker_incentive_commitment_events')->where('event', 'released')->count());
    }

    public function test_test_funding_cannot_fund_actual_cop_and_admin_authority_is_required(): void
    {
        $this->plan('10.01', '100.00', 'test');
        $c = $this->enroll($this->orderId);
        $this->assertSame('actual', $c->mode); $this->assertSame('not_included', $c->status);
        $this->fails(403, fn () => app(WorkerIncentives::class)->execute($this->supervisor->id, $this->store->store_id, 'test', 'plan', (string) Str::uuid(), ['name' => 'Forbidden', 'rate' => '1.00', 'effective_on' => '2026-10-19', 'reason' => 'Must be Admin']));
        $this->admin->forceFill(['account_status' => 'inactive'])->save();
        $this->fails(403, fn () => $this->operation('plan', ['name' => 'Forbidden', 'rate' => '1.00', 'effective_on' => '2026-10-19']));
        Http::assertNothingSent();
    }

    public function test_partial_release_and_consumption_have_distinct_conserved_balances(): void
    {
        $this->fund(); $ledger = app(FinancialLedger::class); $actor = $this->admin->id; $store = $this->store->store_id;
        $r = $ledger->reserve($actor, $store, 'actual', '100.00', (string) Str::uuid(), 'Fixture reservation');
        $ledger->postReservation($actor, $store, 'actual', 'plan_release', $r['id'], 2000, (string) Str::uuid(), 'Return unused capacity');
        $s = $ledger->postReservation($actor, $store, 'actual', 'worker_settlement', $r['id'], 3000, (string) Str::uuid(), 'Fixture offline settlement');
        $b = DB::table('incentive_budgets')->where(['store_id' => $store, 'mode' => 'actual'])->first();
        $this->assertSame([2000, 5000, 3000], [(int) $b->available_centavos, (int) $b->reserved_centavos, (int) $b->disbursed_centavos]);
        $this->fails(409, fn () => $ledger->release($actor, $store, 'actual', $r['id'], (string) Str::uuid(), 'Cannot reinterpret as full release'));
        $ledger->postReservation($actor, $store, 'actual', 'worker_settlement_correction', $s['id'], 3000, (string) Str::uuid(), 'Mistaken record; no payment made');
        $this->fails(409, fn () => $ledger->postReservation($actor, $store, 'actual', 'worker_settlement_correction', $s['id'], 3000, (string) Str::uuid(), 'Duplicate correction'));
        $b = DB::table('incentive_budgets')->find($b->id);
        $this->assertSame([2000, 8000, 0], [(int) $b->available_centavos, (int) $b->reserved_centavos, (int) $b->disbursed_centavos]);
        $this->assertDatabaseCount('incentive_reservation_entries', 3);
    }
}
