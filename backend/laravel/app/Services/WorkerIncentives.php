<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Store;
use App\Models\Worker;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class WorkerIncentives
{
    public function requireSchema(): void
    {
        abort_unless(Schema::hasTable('worker_incentive_earnings'), 503, 'Worker Tip Incentives is awaiting database setup.');
    }

    private function plan(int $id, int $store, string $mode): object
    {
        return DB::table('worker_incentive_plans')->where(['id' => $id, 'store_id' => $store, 'mode' => $mode])->lockForUpdate()->first() ?? abort(404);
    }

    public function execute(int $actor, int $store, string $mode, string $action, string $key, array $in): array
    {
        $this->requireSchema();
        abort_unless(in_array($mode, ['actual', 'test'], true) && Str::isUuid($key), 422);
        $key = strtolower($key); $in['reason'] = trim($in['reason'] ?? '');
        abort_unless(mb_strlen($in['reason']) >= 3 && mb_strlen($in['reason']) <= 500, 422, 'A reason of 3 to 500 characters is required.');
        ksort($in); $hash = hash('sha256', json_encode([$actor, $store, $mode, $action, $in], JSON_THROW_ON_ERROR));
        return DB::transaction(function () use ($actor, $store, $mode, $action, $key, $in, $hash) {
            app(FinancialLedger::class)->admin($actor);
            $record = Store::whereKey($store)->lockForUpdate()->firstOrFail();
            $previous = DB::table('worker_incentive_operations')->where('id', $key)->lockForUpdate()->first();
            if ($previous) {
                abort_unless(hash_equals($previous->payload_hash, $hash), 409, 'This request key was already used for different details.');
                return json_decode($previous->result, true, 512, JSON_THROW_ON_ERROR);
            }
            DB::table('worker_incentive_operations')->insert(['id' => $key, 'store_id' => $store, 'mode' => $mode, 'kind' => $action,
                'actor_id' => $actor, 'payload_hash' => $hash, 'created_at' => now()]);
            $result = match ($action) {
                'plan', 'rules' => $this->rules($actor, $record, $mode, $action, $in),
                'allocate', 'return_unused' => $this->allocation($actor, $store, $mode, $action, $key, $in),
                'payment' => $this->payment($actor, $store, $mode, $in),
                'correct_payment' => $this->correctPayment($actor, $store, $mode, $in),
                default => abort(404),
            };
            DB::table('worker_incentive_operations')->where('id', $key)->update(['result' => json_encode($result, JSON_THROW_ON_ERROR)]);
            DB::table('financial_audits')->insert(['store_id' => $store, 'mode' => $mode, 'action' => 'worker_'.$action,
                'entity' => 'worker_'.$action.':'.$result['id'], 'actor_id' => $actor, 'reason' => $in['reason'], 'after' => json_encode($result), 'created_at' => now()]);
            return $result;
        }, 3);
    }

    private function rules(int $actor, Store $store, string $mode, string $action, array $in): array
    {
        $rate = FinancialMoney::parse($in['rate'], 'rate');
        if ($action === 'plan') {
            abort_unless($store->status === 'active', 409, 'Create plans only for an active store.');
            $id = DB::table('worker_incentive_plans')->insertGetId(['store_id' => $store->store_id, 'mode' => $mode,
                'name' => trim($in['name']), 'status' => 'inactive', 'created_by_user_id' => $actor, 'created_at' => now(), 'updated_at' => now()]);
            $version = 1; $status = 'inactive';
        } else {
            $plan = $this->plan($in['id'], $store->store_id, $mode); $id = $plan->id;
            abort_unless((int) $plan->version === $in['expected_version'], 409, 'The plan changed. Refresh before saving.');
            abort_if($plan->status === 'closed', 409, 'A closed plan preserves history and cannot be reopened.');
            $version = (int) $plan->version + 1; $status = $in['status'];
            if ($status === 'active') {
                abort_unless($store->status === 'active', 409, 'The store must be active.');
                abort_if(DB::table('worker_incentive_plans')->where(['store_id' => $store->store_id, 'mode' => $mode, 'status' => 'active'])->where('id', '!=', $id)->lockForUpdate()->first(), 409, 'Another plan is already active in this store and mode.');
                if ($plan->status !== 'active') abort_unless($this->capacity($id) >= $rate, 409, 'Allocate approved funding for at least one full order reward before activation.');
            }
            DB::table('worker_incentive_plans')->where('id', $id)->update(['status' => $status, 'version' => $version,
                'active_scope' => $status === 'active' ? hash('sha256', $store->store_id.':'.$mode) : null, 'updated_at' => now()]);
        }
        DB::table('worker_incentive_rules')->insert(['plan_id' => $id, 'version' => $version, 'rate_centavos' => $rate,
            'effective_on' => $in['effective_on'], 'status' => $status, 'actor_id' => $actor, 'reason' => $in['reason'], 'created_at' => now()]);
        return ['id' => $id, 'version' => $version, 'status' => $status];
    }

    public function capacity(int $plan): int
    {
        $allocated = (int) DB::table('worker_incentive_allocations')->where('plan_id', $plan)->orderBy('id')->lockForUpdate()->get(['amount_centavos'])->sum('amount_centavos');
        $returned = (int) DB::table('incentive_reservation_entries as e')->join('worker_incentive_allocations as a', 'a.reservation_id', '=', 'e.reservation_id')
            ->where('a.plan_id', $plan)->where('e.kind', 'plan_release')->orderBy('e.id')->lockForUpdate()->get(['e.amount_centavos'])->sum('amount_centavos');
        $promised = (int) DB::table('worker_incentive_commitments')->where('plan_id', $plan)->whereIn('status', ['committed', 'earned'])->orderBy('id')->lockForUpdate()->get(['amount_centavos'])->sum('amount_centavos');
        abort_if($allocated - $returned - $promised < 0, 409, 'The incentive plan requires accounting review.');
        return $allocated - $returned - $promised;
    }

    private function allocation(int $actor, int $store, string $mode, string $action, string $key, array $in): array
    {
        $plan = $this->plan($in['id'], $store, $mode);
        abort_unless((int) $plan->version === $in['expected_version'], 409, 'The plan changed. Refresh before allocating.');
        $amount = FinancialMoney::parse($in['amount']); $ledger = app(FinancialLedger::class);
        if ($action === 'allocate') {
            abort_if($plan->status === 'closed', 409, 'A closed plan cannot receive new funding.');
            $reservation = $ledger->reserve($actor, $store, $mode, $in['amount'], $key, $in['reason']);
            $id = DB::table('worker_incentive_allocations')->insertGetId(['plan_id' => $plan->id, 'reservation_id' => $reservation['id'],
                'amount_centavos' => $amount, 'approved_by_user_id' => $actor, 'reason' => $in['reason'], 'created_at' => now()]);
        } else {
            abort_if($amount > $this->capacity($plan->id), 409, 'Only uncommitted plan capacity may be returned. Promised and earned amounts are protected.');
            $this->consumeAllocations($actor, $store, $mode, $plan->id, $amount, 'plan_release', $in['reason']); $id = $plan->id;
        }
        DB::table('worker_incentive_plans')->where('id', $plan->id)->increment('version');
        return ['id' => $id, 'plan_id' => $plan->id, 'amount_centavos' => $amount, 'capacity_centavos' => $this->capacity($plan->id), 'version' => (int) $plan->version + 1];
    }

    private function consumeAllocations(int $actor, int $store, string $mode, int $plan, int $amount, string $kind, string $reason, ?int $payment = null): void
    {
        $ledger = app(FinancialLedger::class);
        foreach (DB::table('worker_incentive_allocations')->where('plan_id', $plan)->orderBy('id')->lockForUpdate()->get() as $allocation) {
            if (!$amount) break;
            $reservation = DB::table('incentive_movements')->where('id', $allocation->reservation_id)->lockForUpdate()->firstOrFail();
            $take = min($amount, $ledger->reservationRemaining($reservation)); if (!$take) continue;
            $entry = $ledger->postReservation($actor, $store, $mode, $kind, $reservation->id, $take, (string) Str::uuid(), $reason);
            if ($payment !== null) DB::table('worker_incentive_payment_allocations')->insert(['payment_id' => $payment, 'allocation_id' => $allocation->id, 'settlement_entry_id' => $entry['id'], 'amount_centavos' => $take]);
            $amount -= $take;
        }
        abort_unless($amount === 0, 409, 'The funded reservation needs review; no payment was recorded.');
    }

    // Trusted fulfillment path: the caller already authenticated the actual staff member and
    // holds store/order locks. The approved allocation, not a forged Admin actor, authorizes this earmark.
    public function commitLocked(Order $order, int $actor): void
    {
        if (!Schema::hasTable('worker_incentive_commitments') || DB::table('worker_incentive_commitments')->where('order_id', $order->order_id)->lockForUpdate()->first()) return;
        $mode = $order->payment_method === 'cash_on_pickup' ? 'actual' : null; $reason = 'No active funded plan';
        $legacy = DB::table('worker_assignments')->where('order_id', $order->order_id)->where('role_schema_version', 0)->lockForUpdate()->first() !== null;
        if ($order->payment_method === 'digital') {
            $payment = DB::table('order_payments')->where('order_id', $order->order_id)->first();
            if (app(PaymentEvidence::class)->valid($order, $payment)) $mode = app(PaymentEvidence::class)->mode($payment);
        }
        $plan = $mode ? DB::table('worker_incentive_plans')->where(['store_id' => $order->store_id, 'mode' => $mode, 'status' => 'active'])->lockForUpdate()->first() : null;
        $rule = $plan ? DB::table('worker_incentive_rules')->where('plan_id', $plan->id)->where('effective_on', '<=', now('Asia/Manila')->format('Y-m-d'))->orderByDesc('effective_on')->orderByDesc('id')->lockForUpdate()->first() : null;
        $included = !$legacy && $mode !== null && $rule && $this->capacity($plan->id) >= (int) $rule->rate_centavos;
        if ($legacy) $reason = 'Legacy preparation already started; no retroactive enrollment';
        elseif (!$mode) $reason = 'Verified payment provenance is unavailable';
        elseif ($plan && !$rule) $reason = 'The plan effective date has not started';
        elseif ($rule && !$included) $reason = 'The plan has no capacity for a full order reward';
        $id = DB::table('worker_incentive_commitments')->insertGetId(['order_id' => $order->order_id, 'store_id' => $order->store_id, 'mode' => $mode,
            'plan_id' => $included ? $plan->id : null, 'rule_id' => $included ? $rule->id : null, 'amount_centavos' => $included ? $rule->rate_centavos : 0,
            'rule_snapshot' => $included ? json_encode(['rule_id' => $rule->id, 'version' => $rule->version, 'rate_centavos' => (int) $rule->rate_centavos,
                'mode' => $mode, 'contribution_rule' => $rule->contribution_rule, 'approved_by_user_id' => $rule->actor_id]) : null,
            'status' => $included ? 'committed' : 'not_included', 'reason' => $included ? 'One full order reward funded at preparation assignment' : $reason,
            'initiated_by_user_id' => $actor, 'created_at' => now()]);
        $this->event($id, $included ? 'committed' : 'not_included', $actor, $included ? 'Funded order commitment; not yet earned' : $reason);
    }

    private function event(int $commitment, string $event, ?int $actor, string $reason): void
    {
        DB::table('worker_incentive_commitment_events')->insertOrIgnore(['commitment_id' => $commitment, 'event' => $event, 'actor_id' => $actor, 'reason' => $reason, 'created_at' => now()]);
    }

    public function releaseLocked(Order $order, ?int $actor = null): void
    {
        if (!Schema::hasTable('worker_incentive_commitments')) return;
        if ($order->status !== 'canceled' && !in_array($order->claim_status, ['no_show', 'unclaimed_pending_resolution'], true)) return;
        $c = DB::table('worker_incentive_commitments')->where('order_id', $order->order_id)->lockForUpdate()->first();
        if (!$c || $c->status !== 'committed') return;
        DB::table('worker_incentive_commitments')->where('id', $c->id)->update(['status' => 'released', 'released_at' => now()]);
        $this->event($c->id, 'released', $actor, 'Unearned commitment released after order state '.$order->status.'/'.$order->claim_status);
    }

    public function handoverLocked(Order $order, int $handover): void
    {
        if (!Schema::hasTable('worker_incentive_commitments')) return;
        $c = DB::table('worker_incentive_commitments')->where('order_id', $order->order_id)->lockForUpdate()->first();
        if (!$c || $c->status !== 'committed') return;
        DB::table('worker_incentive_outbox')->insertOrIgnore(['commitment_id' => $c->id, 'handover_id' => $handover, 'created_at' => now()]);
        $event = DB::table('worker_incentive_outbox')->where('commitment_id', $c->id)->lockForUpdate()->first();
        DB::afterCommit(function () use ($event) {
            try { $this->process($event->id); } catch (\Throwable) { /* Durable pending work is retried by the bounded reconciliation command. */ }
        });
    }

    public function process(int $id): void
    {
        $lookup = DB::table('worker_incentive_outbox as e')->join('worker_incentive_commitments as c', 'c.id', '=', 'e.commitment_id')->where('e.id', $id)->select('c.store_id', 'c.order_id')->firstOrFail();
        try {
            DB::transaction(function () use ($id, $lookup) {
                Store::whereKey($lookup->store_id)->lockForUpdate()->firstOrFail();
                $o = Order::whereKey($lookup->order_id)->lockForUpdate()->firstOrFail();
                $e = DB::table('worker_incentive_outbox')->where('id', $id)->lockForUpdate()->firstOrFail();
                if ($e->status === 'processed') return;
                $c = DB::table('worker_incentive_commitments')->where('id', $e->commitment_id)->lockForUpdate()->firstOrFail();
                abort_unless(in_array($c->status, ['committed', 'earned'], true) && $c->rule_id && $c->amount_centavos > 0, 409);
                $handover = DB::table('order_handovers')->where(['id' => $e->handover_id, 'order_id' => $o->order_id])->first();
                $payment = DB::table('order_payments')->where('order_id', $o->order_id)->first();
                abort_unless($o->status === 'completed' && $o->claim_status === 'completed' && $o->reservation_status === 'fulfilled' && $handover
                    && $payment && (int) $handover->order_payment_id === (int) $payment->id && app(PaymentEvidence::class)->valid($o, $payment)
                    && app(PaymentEvidence::class)->mode($payment) === $c->mode && (int) $c->store_id === $o->store_id, 409, 'A completed handover and matching verified payment are required.');
                $roles = DB::table('worker_role_contributions')->where('order_id', $o->order_id)->orderBy('role')->lockForUpdate()->get()->keyBy('role');
                abort_unless($roles->count() === 2 && isset($roles['picking'], $roles['packing']), 409, 'Both verified worker roles are required.');
                foreach (['picking', 'packing'] as $role) {
                    $contribution = $roles[$role];
                    $assignment = DB::table('worker_assignments')->where('assignment_id', $contribution->assignment_id)->first();
                    abort_unless($assignment && (int) $assignment->order_id === $o->order_id && (int) $assignment->store_id === $o->store_id
                        && (int) $assignment->worker_id === (int) $contribution->worker_id && in_array($assignment->task_type, [$role, 'picking_packing'], true)
                        && $contribution->verified_at <= $handover->handed_over_at, 409, 'Contribution attribution requires review.');
                    $amount = $role === 'picking' ? intdiv((int) $c->amount_centavos + 1, 2) : intdiv((int) $c->amount_centavos, 2);
                    DB::table('worker_incentive_earnings')->insertOrIgnore(['commitment_id' => $c->id, 'contribution_id' => $contribution->id,
                        'order_id' => $o->order_id, 'worker_id' => $contribution->worker_id, 'store_id' => $o->store_id, 'mode' => $c->mode,
                        'role' => $role, 'credit_units' => 500, 'amount_centavos' => $amount, 'handover_id' => $handover->id, 'earned_at' => $handover->handed_over_at]);
                    $posted = DB::table('worker_incentive_earnings')->where(['order_id' => $o->order_id, 'role' => $role])->firstOrFail();
                    abort_unless((int) $posted->commitment_id === (int) $c->id && (int) $posted->worker_id === (int) $contribution->worker_id
                        && (int) $posted->amount_centavos === $amount && (int) $posted->credit_units === 500, 409, 'Posted earning conflicts with its funded commitment.');
                }
                DB::table('worker_incentive_commitments')->where('id', $c->id)->update(['status' => 'earned', 'earned_at' => $handover->handed_over_at]);
                $this->event($c->id, 'earned', $handover->handed_over_by_user_id, 'Verified paid physical handover; one full order credit');
                DB::table('worker_incentive_outbox')->where('id', $id)->update(['status' => 'processed', 'last_error' => null, 'processed_at' => now(), 'attempted_at' => now(), 'attempts' => $e->attempts + 1]);
            }, 3);
        } catch (\Throwable $failure) {
            DB::table('worker_incentive_outbox')->where('id', $id)->where('status', 'pending')->update(['last_error' => 'eligibility_verification_retry_required', 'attempted_at' => now(), 'attempts' => DB::raw('attempts + 1')]);
            throw $failure;
        }
    }

    public function reconcile(int $limit = 25): array
    {
        $this->requireSchema(); $limit = max(1, min(100, $limit)); $result = ['processed' => 0, 'pending' => 0, 'released' => 0];
        $candidates = DB::table('worker_incentive_commitments as c')->join('orders as o', 'o.order_id', '=', 'c.order_id')->where('c.status', 'committed')
            ->where(fn ($q) => $q->whereIn('o.status', ['completed', 'canceled'])->orWhereIn('o.claim_status', ['no_show', 'unclaimed_pending_resolution']))
            ->orderBy('c.id')->limit($limit)->get(['c.order_id', 'c.store_id']);
        foreach ($candidates as $candidate) DB::transaction(function () use ($candidate, &$result) {
            Store::whereKey($candidate->store_id)->lockForUpdate()->firstOrFail(); $order = Order::whereKey($candidate->order_id)->lockForUpdate()->firstOrFail();
            if ($order->status === 'completed') {
                $h = DB::table('order_handovers')->where('order_id', $order->order_id)->first(); if ($h) $this->handoverLocked($order, $h->id);
            } else { $this->releaseLocked($order); $result['released']++; }
        }, 3);
        foreach (DB::table('worker_incentive_outbox')->where('status', 'pending')->orderBy('attempted_at')->orderBy('id')->limit($limit)->pluck('id') as $id) {
            try { $this->process($id); $result['processed']++; } catch (\Throwable) { $result['pending']++; }
        }
        return $result;
    }

    private function payment(int $actor, int $store, string $mode, array $in): array
    {
        Worker::where(['worker_id' => $in['worker_id'], 'store_id' => $store])->lockForUpdate()->firstOrFail(); // Historical inactive workers remain payable.
        $ids = $in['earning_ids']; sort($ids);
        $entries = DB::table('worker_incentive_earnings')->where(['worker_id' => $in['worker_id'], 'store_id' => $store, 'mode' => $mode])->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
        abort_unless($entries->count() === count($ids), 422, 'Select earnings belonging to this worker, store and mode.');
        abort_if(DB::table('worker_incentive_payment_items')->whereIn('active_earning_id', $ids)->lockForUpdate()->first(), 409, 'An earning is already paid. Refresh the unpaid entries.');
        $amount = (int) $entries->sum('amount_centavos');
        abort_unless($amount > 0 && $amount <= FinancialMoney::MAX, 422, 'Select positive unpaid earnings within the supported payment amount.');
        abort_unless($in['already_paid'] === true, 422, 'Confirm that this payment was already made outside GrocerEase.');
        $reference = trim($in['reference']); $hash = hash('sha256', $mode.':'.mb_strtolower(preg_replace('/\s+/u', ' ', $reference)));
        abort_if(DB::table('worker_incentive_payments')->where('evidence_key', $hash)->lockForUpdate()->first(), 409, 'This payment reference is already recorded.');
        $id = DB::table('worker_incentive_payments')->insertGetId(['store_id' => $store, 'mode' => $mode, 'worker_id' => $in['worker_id'], 'amount_centavos' => $amount,
            'paid_on' => $in['paid_on'], 'method' => $in['method'], 'evidence' => Crypt::encryptString($reference), 'evidence_key' => $hash, 'actor_id' => $actor, 'reason' => $in['reason'], 'created_at' => now()]);
        $byPlan = [];
        foreach ($entries->groupBy('commitment_id') as $commitmentId => $group) {
            $c = DB::table('worker_incentive_commitments')->where('id', $commitmentId)->lockForUpdate()->firstOrFail();
            $this->plan($c->plan_id, $store, $mode);
            abort_unless($c->status === 'earned' && (int) $c->store_id === $store && $c->mode === $mode, 409, 'Earnings must retain their completed funded commitment.');
            $byPlan[$c->plan_id] = ($byPlan[$c->plan_id] ?? 0) + (int) $group->sum('amount_centavos');
        }
        ksort($byPlan);
        foreach ($byPlan as $planId => $sum) if ($sum) $this->consumeAllocations($actor, $store, $mode, $planId, $sum, 'worker_settlement', $in['reason'], $id);
        foreach ($entries as $entry) DB::table('worker_incentive_payment_items')->insert(['payment_id' => $id, 'earning_id' => $entry->id, 'active_earning_id' => $entry->id, 'amount_centavos' => $entry->amount_centavos]);
        return ['id' => $id, 'amount_centavos' => $amount, 'earning_count' => $entries->count(), 'status' => 'recorded_offline'];
    }

    private function correctPayment(int $actor, int $store, string $mode, array $in): array
    {
        $p = DB::table('worker_incentive_payments')->where(['id' => $in['id'], 'store_id' => $store, 'mode' => $mode])->lockForUpdate()->first() ?? abort(404);
        abort_if(DB::table('worker_incentive_payment_corrections')->where('payment_id', $p->id)->exists(), 409, 'This payment already has a correction/review record.');
        if ($in['kind'] === 'record_error_no_payment') {
            abort_unless(($in['confirm_no_payment_made'] ?? false) === true, 422, 'Confirm that no external payment was made. This is not recovery of money already paid.');
            foreach (DB::table('worker_incentive_payment_allocations')->where('payment_id', $p->id)->orderBy('id')->lockForUpdate()->get() as $line) {
                app(FinancialLedger::class)->postReservation($actor, $store, $mode, 'worker_settlement_correction', $line->settlement_entry_id, $line->amount_centavos, (string) Str::uuid(), $in['reason']);
            }
            DB::table('worker_incentive_payment_items')->where('payment_id', $p->id)->update(['active_earning_id' => null]);
        }
        $id = DB::table('worker_incentive_payment_corrections')->insertGetId(['payment_id' => $p->id, 'kind' => $in['kind'], 'actor_id' => $actor, 'reason' => $in['reason'], 'created_at' => now()]);
        return ['id' => $id, 'payment_id' => $p->id, 'kind' => $in['kind'], 'status' => $in['kind'] === 'record_error_no_payment' ? 'mistaken_record_corrected' : 'external_payment_review_required'];
    }
}
