<?php

namespace App\Services;

use App\Models\Store;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FinancialLedger
{
    public function admin(int $id): User
    {
        $user = User::with('role')->whereKey($id)->lockForUpdate()->firstOrFail();
        abort_unless($user->account_status === 'active' && $user->role?->slug === 'admin', 403);
        return $user;
    }

    // One lock order: actor -> store -> operation -> source bill/payment -> budget -> movements.
    // All financial writers, including the internal reservation API, go through this boundary.
    public function execute(int $actor, int $store, string $mode, string $kind, string $key, array $input): array
    {
        abort_unless(in_array($mode, ['actual', 'test'], true) && Str::isUuid($key), 422, 'A valid mode and idempotency UUID are required.');
        $key = strtolower($key);
        abort_unless(is_string($input['reason'] ?? null) && strlen(trim($input['reason'])) >= 3 && mb_strlen($input['reason']) <= 500, 422, 'A reason of 3 to 500 characters is required.');
        $input['reason'] = trim($input['reason']);
        ksort($input);
        $hash = hash('sha256', json_encode([$actor, $store, $mode, $kind, $input], JSON_THROW_ON_ERROR));
        return DB::transaction(function () use ($actor, $store, $mode, $kind, $key, $input, $hash) {
            $this->admin($actor);
            Store::whereKey($store)->lockForUpdate()->firstOrFail(); // inactive-store history remains actionable
            $previous = DB::table('financial_operations')->where('id', $key)->lockForUpdate()->first();
            if ($previous) {
                abort_unless(hash_equals($previous->payload_hash, $hash), 409, 'This idempotency key was already used for different details.');
                return json_decode($previous->result, true, 512, JSON_THROW_ON_ERROR);
            }
            DB::table('financial_operations')->insert(['id' => $key, 'store_id' => $store, 'mode' => $mode, 'kind' => $kind,
                'actor_id' => $actor, 'payload_hash' => $hash, 'created_at' => now()]);
            $result = match ($kind) {
                'agreement' => $this->agreement($store, $mode, $input),
                'bill' => $this->bill($actor, $store, $mode, $input),
                'void_bill' => $this->voidBill($actor, $store, $mode, $input),
                'payment' => $this->payment($actor, $store, $mode, $input),
                'verify', 'reverse_payment' => $this->paymentAction($actor, $store, $mode, $kind, $key, $input),
                'contribute' => $this->contribute($actor, $store, $mode, $key, $input),
                'return_contribution', 'reserve', 'release' => $this->fundAction($actor, $store, $mode, $kind, $key, $input),
                'policy' => $this->policy($actor, $store, $input),
                default => abort(422, 'Unsupported financial operation.'),
            };
            DB::table('financial_operations')->where('id', $key)->update(['result' => json_encode($result, JSON_THROW_ON_ERROR)]);
            DB::table('financial_audits')->insert(['store_id' => $store, 'mode' => $mode, 'action' => $kind,
                'entity' => $kind.':'.($result['id'] ?? $result['version'] ?? ''), 'actor_id' => $actor, 'reason' => $input['reason'],
                'before' => isset($result['before']) ? json_encode($result['before'], JSON_THROW_ON_ERROR) : null,
                'after' => json_encode($result, JSON_THROW_ON_ERROR), 'created_at' => now()]);
            return $result;
        }, 3);
    }

    private function stale(int $expected, int $current): void
    {
        abort_unless($expected === $current, 409, 'This record changed. Refresh and review the latest version.');
    }

    private function agreement(int $store, string $mode, array $in): array
    {
        $row = DB::table('subscription_agreements')->where(['store_id' => $store, 'mode' => $mode])->lockForUpdate()->first();
        $this->stale((int) $in['expected_version'], (int) ($row?->version ?? 0));
        $values = ['amount_centavos' => FinancialMoney::parse($in['amount']), 'period' => $in['period'],
            'starts_on' => $in['starts_on'], 'status' => $in['status'], 'version' => ($row?->version ?? 0) + 1, 'updated_at' => now()];
        $id = $row?->id ?? DB::table('subscription_agreements')->insertGetId($values + ['store_id' => $store, 'mode' => $mode, 'created_at' => now()]);
        if ($row) DB::table('subscription_agreements')->where('id', $id)->update($values);
        return ['id' => $id, 'version' => $values['version'], 'before' => $row ? (array) $row : null, 'agreement' => $values];
    }

    private function bill(int $actor, int $store, string $mode, array $in): array
    {
        $agreement = DB::table('subscription_agreements')->where(['store_id' => $store, 'mode' => $mode])->lockForUpdate()->first();
        abort_unless($agreement && $agreement->status === 'active', 422, 'An active subscription agreement is required.');
        $this->stale((int) $in['expected_version'], (int) $agreement->version);
        abort_if($in['coverage_from'] < $agreement->starts_on, 422, 'Coverage cannot precede the agreement start date.');
        $start = CarbonImmutable::parse($in['coverage_from'], 'Asia/Manila');
        $end = ($agreement->period === 'monthly' ? $start->addMonthNoOverflow() : $start->addYearNoOverflow())->subDay()->format('Y-m-d');
        abort_if($end > '9999-12-31', 422, 'Coverage exceeds the supported date range.');
        $overlap = DB::table('subscription_bills')->where('agreement_id', $agreement->id)->whereNotNull('active_period_key')
            ->where('coverage_from', '<=', $end)->where('coverage_until', '>=', $in['coverage_from'])->lockForUpdate()->first();
        abort_if($overlap, 409, 'An active billing record already covers some or all of this period.');
        $id = DB::table('subscription_bills')->insertGetId(['agreement_id' => $agreement->id, 'store_id' => $store, 'mode' => $mode,
            'amount_centavos' => $agreement->amount_centavos, 'period' => $agreement->period, 'agreement_version' => $agreement->version,
            'coverage_from' => $in['coverage_from'], 'coverage_until' => $end, 'due_on' => $in['due_on'],
            'active_period_key' => hash('sha256', $agreement->id.':'.$in['coverage_from'].':'.$end), 'actor_id' => $actor, 'created_at' => now()]);
        return ['id' => $id, 'coverage_until' => $end, 'amount_centavos' => (int) $agreement->amount_centavos];
    }

    private function source(string $table, int $id, int $store, string $mode): object
    {
        return DB::table($table)->where(['id' => $id, 'store_id' => $store, 'mode' => $mode])->lockForUpdate()->first() ?? abort(404);
    }

    private function voidBill(int $actor, int $store, string $mode, array $in): array
    {
        $bill = $this->source('subscription_bills', $in['id'], $store, $mode);
        abort_if(!$bill->active_period_key, 409, 'This bill is already voided.');
        abort_if(DB::table('subscription_payments')->where('bill_id', $bill->id)->whereNotNull('active_bill_key')->lockForUpdate()->first(), 409, 'Reverse the linked payment before voiding this bill.');
        DB::table('subscription_bill_voids')->insert(['bill_id' => $bill->id, 'actor_id' => $actor, 'reason' => $in['reason'], 'created_at' => now()]);
        DB::table('subscription_bills')->where('id', $bill->id)->update(['active_period_key' => null]);
        return ['id' => $bill->id, 'status' => 'voided'];
    }

    private function payment(int $actor, int $store, string $mode, array $in): array
    {
        $bill = $this->source('subscription_bills', $in['id'], $store, $mode);
        abort_unless($bill->active_period_key, 422, 'A voided bill cannot receive payment.');
        $amount = FinancialMoney::parse($in['amount']);
        abort_unless($amount === (int) $bill->amount_centavos, 422, 'Only full settlement of this bill is supported. Partial and excess payments are not accepted.');
        abort_if(DB::table('subscription_payments')->where('active_bill_key', $bill->id)->lockForUpdate()->first(), 409, 'This bill already has an unreversed payment entry.');
        $evidence = trim($in['evidence']);
        $hash = hash('sha256', mb_strtolower(preg_replace('/\s+/u', ' ', $evidence)));
        $activeKey = hash('sha256', $mode.':'.$hash);
        abort_if(DB::table('subscription_payments')->where('active_evidence_key', $activeKey)->lockForUpdate()->first(), 409, 'This payment evidence is already recorded in this mode.');
        $id = DB::table('subscription_payments')->insertGetId(['bill_id' => $bill->id, 'store_id' => $store, 'mode' => $mode,
            'amount_centavos' => $amount, 'paid_on' => $in['paid_on'], 'method' => $in['method'], 'evidence' => Crypt::encryptString($evidence),
            'evidence_hash' => $hash, 'active_evidence_key' => $activeKey, 'active_bill_key' => $bill->id, 'actor_id' => $actor, 'created_at' => now()]);
        return ['id' => $id, 'version' => 1, 'status' => 'unverified'];
    }

    private function lockedPayment(int $id, int $store, string $mode): object
    {
        // Nonlocking lookup reveals only the immutable bill ID; locked reads establish authority.
        $lookup = DB::table('subscription_payments')->where(['id' => $id, 'store_id' => $store, 'mode' => $mode])->first() ?? abort(404);
        $this->source('subscription_bills', $lookup->bill_id, $store, $mode);
        return $this->source('subscription_payments', $id, $store, $mode);
    }

    private function paymentAction(int $actor, int $store, string $mode, string $kind, string $key, array $in): array
    {
        $payment = $this->lockedPayment($in['id'], $store, $mode);
        $this->stale((int) $in['expected_version'], (int) $payment->version);
        abort_unless($payment->active_bill_key, 409, 'This payment has already been reversed.');
        if ($kind === 'verify') {
            abort_if(DB::table('subscription_payment_verifications')->where('payment_id', $payment->id)->lockForUpdate()->first(), 409, 'This payment is already verified.');
        } else {
            $budget = $this->budget($store, $mode);
            $contributions = DB::table('incentive_movements as m')->where('m.payment_id', $payment->id)->where('m.kind', 'contribution')
                ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('incentive_movements as r')->whereColumn('r.related_id', 'm.id')->where('r.kind', 'contribution_return'))
                ->orderBy('m.id')->lockForUpdate()->get();
            abort_if($contributions->sum('amount_centavos') > $budget->available_centavos, 409,
                'This receipt supports reserved funding. Release the supporting reservation before reversing the payment.');
            foreach ($contributions as $movement) $this->returnContribution($actor, $budget, $movement, $key, $in['reason']);
            DB::table('subscription_payments')->where('id', $payment->id)->update(['active_bill_key' => null, 'active_evidence_key' => null]);
        }
        DB::table($kind === 'verify' ? 'subscription_payment_verifications' : 'subscription_payment_reversals')
            ->insert(['payment_id' => $payment->id, 'actor_id' => $actor, 'reason' => $in['reason'], 'created_at' => now()]);
        DB::table('subscription_payments')->where('id', $payment->id)->increment('version');
        return ['id' => $payment->id, 'version' => (int) $payment->version + 1, 'status' => $kind === 'verify' ? 'verified' : 'reversed'];
    }

    public function unallocated(object $payment): int
    {
        $posted = (int) DB::table('incentive_movements')->where('payment_id', $payment->id)->where('kind', 'contribution')->lockForUpdate()->get(['amount_centavos'])->sum('amount_centavos');
        $returned = (int) DB::table('incentive_movements')->where('payment_id', $payment->id)->where('kind', 'contribution_return')->lockForUpdate()->get(['amount_centavos'])->sum('amount_centavos');
        return (int) $payment->amount_centavos - $posted + $returned;
    }

    private function budget(int $store, string $mode): object
    {
        $query = DB::table('incentive_budgets')->where(['store_id' => $store, 'mode' => $mode]);
        $budget = $query->lockForUpdate()->first();
        if (!$budget) {
            DB::table('incentive_budgets')->insert(['store_id' => $store, 'mode' => $mode]);
            $budget = $query->lockForUpdate()->first();
        }
        return $budget;
    }

    private function move(int $actor, object $budget, string $kind, int $amount, ?int $payment, ?int $related, string $key, string $reason): int
    {
        abort_unless($amount > 0 && $amount <= FinancialMoney::MAX, 422, 'Movement exceeds the supported amount range.');
        return DB::table('incentive_movements')->insertGetId(['budget_id' => $budget->id, 'payment_id' => $payment, 'related_id' => $related,
            'kind' => $kind, 'amount_centavos' => $amount, 'operation_id' => $key, 'actor_id' => $actor, 'reason' => $reason, 'created_at' => now()]);
    }

    private function balance(object $budget, int $availableChange, int $reservedChange): void
    {
        $available = (int) $budget->available_centavos + $availableChange;
        $reserved = (int) $budget->reserved_centavos + $reservedChange;
        abort_if(min($available, $reserved) < 0 || $available + $reserved > FinancialMoney::MAX_BUDGET, 409, 'Insufficient available funding or the supported budget limit would be exceeded.');
        DB::table('incentive_budgets')->where('id', $budget->id)->update(['available_centavos' => $available, 'reserved_centavos' => $reserved, 'version' => $budget->version + 1]);
        $budget->available_centavos = $available; $budget->reserved_centavos = $reserved; $budget->version++;
    }

    private function contribute(int $actor, int $store, string $mode, string $key, array $in): array
    {
        $payment = $this->lockedPayment($in['id'], $store, $mode);
        abort_unless($payment->active_bill_key && DB::table('subscription_payment_verifications')->where('payment_id', $payment->id)->lockForUpdate()->first(), 422, 'Only a verified, unreversed subscription payment in this store and mode may fund this budget.');
        $amount = FinancialMoney::parse($in['amount']);
        $budget = $this->budget($store, $mode);
        abort_if($amount > $this->unallocated($payment), 409, 'The contribution exceeds the unallocated amount of this receipt.');
        $this->balance($budget, $amount, 0);
        return ['id' => $this->move($actor, $budget, 'contribution', $amount, $payment->id, null, $key, $in['reason']),
            'amount_centavos' => $amount, 'available_centavos' => $budget->available_centavos];
    }

    private function returnContribution(int $actor, object $budget, object $movement, string $key, string $reason): int
    {
        abort_if(DB::table('incentive_movements')->where(['kind' => 'contribution_return', 'related_id' => $movement->id])->lockForUpdate()->first(), 409, 'This contribution was already returned.');
        $this->balance($budget, -(int) $movement->amount_centavos, 0);
        return $this->move($actor, $budget, 'contribution_return', (int) $movement->amount_centavos, $movement->payment_id, $movement->id, $key, $reason);
    }

    private function fundAction(int $actor, int $store, string $mode, string $kind, string $key, array $in): array
    {
        // For a return, lock its immutable source before the budget, as for contribution/payment reversal.
        if ($kind === 'return_contribution') {
            $lookup = DB::table('incentive_movements as m')->join('incentive_budgets as b', 'b.id', '=', 'm.budget_id')
                ->where(['m.id' => $in['id'], 'b.store_id' => $store, 'b.mode' => $mode, 'm.kind' => 'contribution'])->select('m.*')->first() ?? abort(404);
            $this->lockedPayment($lookup->payment_id, $store, $mode);
        }
        $budget = $this->budget($store, $mode);
        if ($kind === 'reserve') {
            $amount = FinancialMoney::parse($in['amount']);
            $this->balance($budget, -$amount, $amount);
            $id = $this->move($actor, $budget, 'reservation', $amount, null, null, $key, $in['reason']);
        } else {
            $movement = DB::table('incentive_movements')->where(['id' => $in['id'], 'budget_id' => $budget->id,
                'kind' => $kind === 'release' ? 'reservation' : 'contribution'])->lockForUpdate()->first() ?? abort(404);
            if ($kind === 'return_contribution') $id = $this->returnContribution($actor, $budget, $movement, $key, $in['reason']);
            else {
                abort_if(DB::table('incentive_movements')->where(['kind' => 'release', 'related_id' => $movement->id])->lockForUpdate()->first(), 409, 'This reservation has already been released in full.');
                $this->balance($budget, (int) $movement->amount_centavos, -(int) $movement->amount_centavos);
                $id = $this->move($actor, $budget, 'release', (int) $movement->amount_centavos, null, $movement->id, $key, $in['reason']);
            }
        }
        return ['id' => $id, 'available_centavos' => $budget->available_centavos, 'reserved_centavos' => $budget->reserved_centavos];
    }

    private function policy(int $actor, int $store, array $in): array
    {
        $before = app(FinancialPolicy::class)->current($store);
        $this->stale((int) $in['expected_version'], $before['version']);
        $cap = isset($in['cap']) && $in['cap'] !== '' ? FinancialMoney::parse($in['cap'], 'cap', true) : null;
        abort_if($in['fee_enabled'] && ((int) $in['rate_bps'] === 0 || empty(trim($in['approval_note'] ?? ''))), 422, 'An enabled fee requires a positive rate and store approval/reference note.');
        $methods = $in['digital_methods'] ?? null;
        if ($methods !== null) {
            $merchant = app(PayMongoGateway::class)->merchant($store);
            abort_if(array_diff($methods, $merchant['methods']), 422, 'Only methods supported by the configured merchant can be selected.');
            sort($methods);
        }
        $id = DB::table('store_financial_policy_versions')->insertGetId(['store_id' => $store,
            'fee_enabled' => $in['fee_enabled'], 'rate_bps' => $in['rate_bps'], 'cap_centavos' => $cap, 'approval_note' => $in['approval_note'] ?? null,
            'digital_enabled' => $in['digital_enabled'], 'digital_methods' => $methods === null ? null : json_encode($methods, JSON_THROW_ON_ERROR),
            'actor_id' => $actor, 'reason' => $in['reason'], 'created_at' => now()]);
        DB::table('store_financial_policies')->updateOrInsert(['store_id' => $store], ['version_id' => $id]);
        return ['version' => $id, 'before' => $before, 'policy' => app(FinancialPolicy::class)->current($store)];
    }

    // Internal only: no public routes or order-event hooks. Future worker integration must carry an authorizing Admin.
    public function reserve(int $admin, int $store, string $mode, string $amount, string $key, string $reason): array
    {
        return $this->execute($admin, $store, $mode, 'reserve', $key, compact('amount', 'reason'));
    }

    public function release(int $admin, int $store, string $mode, int $reservation, string $key, string $reason): array
    {
        return $this->execute($admin, $store, $mode, 'release', $key, ['id' => $reservation, 'reason' => $reason]);
    }
}
