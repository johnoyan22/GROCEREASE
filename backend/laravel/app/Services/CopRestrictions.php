<?php

namespace App\Services;

use App\Models\Order;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class CopRestrictions
{
    // Writers: Shopper row -> policy head -> store -> order -> COP records.
    // Policy edits lock only the head. Access actions never lock stores/orders.
    public function account(int $userId): object
    {
        $account = DB::table('cop_accounts')->where('shopper_user_id', $userId)->lockForUpdate()->first();
        if ($account) return $account;
        $cycle = DB::table('cop_cycles')->insertGetId(['shopper_user_id' => $userId, 'number' => 1, 'started_at' => now()]);
        DB::table('cop_accounts')->insert(['shopper_user_id' => $userId, 'cycle_id' => $cycle, 'version' => 0]);
        return DB::table('cop_accounts')->where('shopper_user_id', $userId)->first();
    }

    private function outcome(int $number, array $policy, CarbonImmutable $issued): array
    {
        $kind = $number >= $policy['permanent_threshold'] ? 'permanent' : ($number >= $policy['temporary_threshold'] ? 'temporary' : 'warning');
        return [$kind, $kind === 'temporary' ? $issued->addDays($policy['temporary_days']) : null];
    }

    /** Pure evaluator: expiry needs no job or page visit. */
    public function statuses(array $userIds, CarbonImmutable $asOf, ?array $policy = null, ?int $maxRows = null, bool $lock = false, ?int &$sourceRows = null): array
    {
        $policy ??= app(CopPolicy::class)->at($asOf);
        $budget = 0;
        $fetch = function ($query) use ($maxRows, $lock, &$budget) {
            if ($lock) $query->lockForUpdate();
            $rows = ($maxRows === null ? $query : $query->limit($maxRows + 1))->get();
            $budget += $rows->count();
            abort_if($maxRows !== null && $budget > $maxRows, 422, 'Too many COP source records. Narrow the store or period; no records were truncated.');
            return $rows;
        };
        // Preserve the existing COP checkout path before the older account-status migration.
        $accountStatus = Schema::hasColumn('users', 'account_status') ? 'account_status' : DB::raw("'active' as account_status");
        $users = $fetch(DB::table('users')->whereIn('id', $userIds)->select('id', $accountStatus, 'email_verified_at'))->keyBy('id');
        $accounts = $fetch(DB::table('cop_accounts')->whereIn('shopper_user_id', $userIds))->keyBy('shopper_user_id');
        $cycles = $fetch(DB::table('cop_cycles')->whereIn('shopper_user_id', $userIds)
            ->where(fn ($q) => $q->whereNull('started_at')->orWhere('started_at', '<=', $asOf))
            ->where(fn ($q) => $q->whereNull('closed_at')->orWhere('closed_at', '>', $asOf)))->keyBy('shopper_user_id');
        $strikes = $fetch(DB::table('cop_strikes')->whereIn('shopper_user_id', $userIds)->where('issued_at', '<=', $asOf)->orderBy('issued_at')->orderBy('id'))->groupBy('shopper_user_id');
        $manual = $fetch(DB::table('cop_restrictions')->whereIn('shopper_user_id', $userIds)->where('source', 'manual')->where('started_at', '<=', $asOf))->groupBy('shopper_user_id');
        $versions = $fetch(DB::table('cop_policy_versions')->whereIn('id', $strikes->flatten(1)->pluck('policy_version_id')->filter()->push(1)->unique()))->keyBy('id');
        $result = [];
        foreach ($userIds as $id) {
            $account = $accounts->get($id);
            $current = $cycles->get($id)?->id;
            $valid = ($strikes->get($id) ?? collect())->filter(fn ($s) => !$s->voided_at || CarbonImmutable::parse($s->voided_at, 'UTC')->isAfter($asOf));
            $cycleStrikes = $valid->filter(fn ($s) => $current === null ? $s->cycle_id === null : (int) $s->cycle_id === (int) $current);
            $blocks = []; $number = 0;
            foreach ($cycleStrikes as $strike) {
                $version = $versions->get($strike->policy_version_id ?? 1);
                abort_unless($version, 503, 'An accepted COP policy is unavailable; review the historical data.');
                [$kind, $until] = $this->outcome(++$number, app(CopPolicy::class)->values($version), CarbonImmutable::parse($strike->issued_at, 'UTC'));
                if ($kind !== 'warning' && (!$until || $until->isAfter($asOf))) $blocks[] = ['source' => 'automatic', 'kind' => $kind, 'until' => $until?->toIso8601String(), 'reason' => 'Unpaid COP no-show enforcement under accepted policy #'.$version->id.'.'];
            }
            foreach ($manual->get($id) ?? [] as $block) {
                if (($block->ended_at && CarbonImmutable::parse($block->ended_at, 'UTC')->lessThanOrEqualTo($asOf)) || ($block->effective_expires_at && CarbonImmutable::parse($block->effective_expires_at, 'UTC')->lessThanOrEqualTo($asOf))) continue;
                $blocks[] = ['source' => 'manual', 'kind' => $block->effective_kind, 'until' => $block->effective_expires_at ? CarbonImmutable::parse($block->effective_expires_at, 'UTC')->toIso8601String() : null, 'reason' => $block->reason];
            }
            $indefinite = collect($blocks)->contains(fn ($b) => $b['until'] === null);
            $kind = !$blocks ? 'available' : ($indefinite ? (collect($blocks)->contains('kind', 'permanent') ? 'permanent' : 'until_restored') : 'temporary');
            $until = $blocks && !$indefinite ? collect($blocks)->max('until') : null;
            $user = $users->get($id);
            $contextAllowed = $user && $user->account_status === 'active' && $user->email_verified_at;
            $reason = !$policy['enabled'] ? 'Cash on Pickup is currently disabled platform-wide.'
                : (!$contextAllowed ? 'An active, email-verified Shopper account is required.'
                : ($blocks ? ($indefinite ? 'Cash on Pickup is restricted until an Admin restores access.' : 'Cash on Pickup is restricted until '.$until.'.') : 'Cash on Pickup is available.'));
            $result[$id] = ['allowed' => $policy['enabled'] && (bool) $contextAllowed && !$blocks, 'individual_restricted' => (bool) $blocks,
                'individual_access' => $kind, 'permanently_disabled' => $indefinite, 'disabled_until' => $until,
                'strike_count' => $cycleStrikes->count(), 'lifetime_strike_count' => $valid->count(), 'cycle_id' => $current,
                'version' => (int) ($account?->version ?? 0), 'sources' => collect($blocks)->pluck('source')->unique()->values()->all(),
                'blocks' => array_slice($blocks, -5), 'active_block_count' => count($blocks), 'reason' => $reason, 'platform_enabled' => $policy['enabled'], 'account_eligible' => (bool) $contextAllowed,
                'policy' => $policy, 'as_of' => $asOf->toIso8601String()];
        }
        $sourceRows = $budget;
        return $result;
    }

    public function status(int $userId, ?CarbonImmutable $asOf = null, ?array $policy = null, bool $lock = false): array
    {
        return $this->statuses([$userId], $asOf ?? CarbonImmutable::now('UTC'), $policy, lock: $lock)[$userId];
    }

    public function requireAllowed(int $userId, ?array $policy = null): void
    {
        $status = $this->status($userId, policy: $policy, lock: true);
        if (!$status['allowed']) throw ValidationException::withMessages(['payment_method' => $status['reason'].' Supported prepaid methods remain separate.']);
    }

    /** Replay only automatic outcomes, using each incident's saved policy and original time. */
    public function replay(int $userId): void
    {
        $strikes = DB::table('cop_strikes')->where('shopper_user_id', $userId)->orderBy('issued_at')->orderBy('id')->lockForUpdate()->get();
        $versions = DB::table('cop_policy_versions')->whereIn('id', $strikes->pluck('policy_version_id')->filter()->push(1)->unique())->lockForUpdate()->get()->keyBy('id');
        $counts = [];
        foreach ($strikes as $strike) {
            $version = app(CopPolicy::class)->values($versions->get($strike->policy_version_id ?? 1));
            $at = CarbonImmutable::parse($strike->issued_at, 'UTC');
            [$originalKind, $originalUntil] = $this->outcome((int) $strike->strike_number_at_issue, $version, $at);
            if (!$strike->voided_at) $counts[$strike->cycle_id] = ($counts[$strike->cycle_id] ?? 0) + 1;
            $count = $counts[$strike->cycle_id] ?? 0;
            [$kind, $until] = $strike->voided_at ? ['corrected', null] : $this->outcome($count, $version, $at);
            $query = DB::table('cop_restrictions')->where('strike_id', $strike->id);
            $projection = ['effective_kind' => $kind, 'effective_count' => $strike->voided_at ? null : $count, 'effective_expires_at' => $until];
            if ($query->exists()) $query->update($projection);
            else DB::table('cop_restrictions')->insert($projection + ['shopper_user_id' => $userId, 'cycle_id' => $strike->cycle_id,
                'strike_id' => $strike->id, 'source' => 'automatic', 'original_kind' => $originalKind, 'original_expires_at' => $originalUntil,
                'started_at' => $strike->issued_at, 'reason' => 'Accepted-policy unpaid COP no-show outcome.']);
        }
    }

    public function issue(Order $order): void
    {
        if (DB::table('cop_strikes')->where('order_id', $order->order_id)->exists()) return;
        $account = $this->account($order->shopper_user_id);
        $policyId = $order->cop_policy_version_id;
        abort_unless($policyId, 503, 'This accepted order needs its legacy COP policy backfill.');
        $before = $this->status($order->shopper_user_id, lock: true);
        DB::table('cop_strikes')->insert(['order_id' => $order->order_id, 'shopper_user_id' => $order->shopper_user_id,
            'store_id' => $order->store_id, 'strike_number_at_issue' => $before['strike_count'] + 1, 'policy_version_id' => $policyId,
            'cycle_id' => $account->cycle_id, 'issued_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $this->replay($order->shopper_user_id);
        DB::table('cop_accounts')->where('shopper_user_id', $order->shopper_user_id)->increment('version');
        $after = $this->status($order->shopper_user_id, lock: true);
        $message = 'COP No-Show recorded. Current-cycle valid strikes: '.$after['strike_count'].'. '.$after['reason'];
        app(OrderNotifications::class)->notify($order, 'cop_no_show', mb_substr($message, 0, 500));
    }

    public function event(int $userId, int $actorId, string $action, string $reason, array $before, array $after, ?int $strikeId = null): void
    {
        DB::table('cop_access_events')->insert(['shopper_user_id' => $userId, 'actor_user_id' => $actorId, 'strike_id' => $strikeId,
            'action' => $action, 'reason' => $reason, 'before_state' => json_encode($before), 'after_state' => json_encode($after), 'occurred_at' => now()]);
    }

    // Projection used for bounded server pagination; official writers replay under the Shopper lock.
    public function blockingQuery($query, string $userColumn, CarbonImmutable $asOf, ?string $source = null)
    {
        return $query->selectRaw('1')->from('cop_restrictions as cr')->join('cop_cycles as cc', 'cc.id', '=', 'cr.cycle_id')
            ->whereColumn('cr.shopper_user_id', $userColumn)->where('cr.started_at', '<=', $asOf)
            ->whereNull('cc.closed_at')->whereNull('cr.ended_at')->whereNotIn('cr.effective_kind', ['warning', 'corrected'])
            ->where(fn ($q) => $q->whereNull('cr.effective_expires_at')->orWhere('cr.effective_expires_at', '>', $asOf))
            ->when($source, fn ($q) => $q->where('cr.source', $source));
    }
}
