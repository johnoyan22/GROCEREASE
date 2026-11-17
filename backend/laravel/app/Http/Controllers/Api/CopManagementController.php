<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Services\CopPolicy;
use App\Services\CopRestrictions;
use App\Services\OrderNotifications;
use App\Services\OrderReference;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CopManagementController extends Controller
{
    private function admin(Request $request): int
    {
        $actor = User::with('role')->findOrFail($request->user()->id);
        abort_unless($actor->role?->slug === 'admin' && $actor->account_status === 'active', 403, 'An active Admin is required.');
        app(CopPolicy::class)->current();
        return $actor->id;
    }

    private function input(Request $request, array $allowed): void
    {
        foreach (array_diff(array_keys($request->all()), $allowed) as $key) {
            throw ValidationException::withMessages([$key => 'This field cannot be submitted.']);
        }
    }

    private function actionRules(): array
    {
        return ['expected_version' => ['required', 'integer', 'min:0', $this->strictInteger()], 'reason' => ['required', 'string', 'min:5', 'max:500', 'regex:/[\pL\pN].*[\pL\pN].*[\pL\pN]/u'], 'confirmed' => ['required', function ($key, $value, $fail) { if ($value !== true) $fail('Explicit confirmation is required.'); }]];
    }

    private function strictInteger(): \Closure
    {
        return function ($key, $value, $fail) { if (!is_int($value)) $fail('Enter a whole-number integer.'); };
    }

    private function response(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'no-store, private');
    }

    public function policy(Request $request): JsonResponse
    {
        $this->admin($request);
        $request->validate(['page' => ['sometimes', 'integer', 'min:1', 'max:100000']]);
        $versions = DB::table('cop_policy_versions')->orderByDesc('id')->paginate(10);
        $versions->getCollection()->transform(fn ($row) => ['policy' => app(CopPolicy::class)->values($row), 'actor_user_id' => $row->actor_user_id,
            'reason' => $row->reason, 'effective_at' => $row->effective_at]);
        return $this->response(['policy' => app(CopPolicy::class)->current(), 'history' => $versions,
            'stores' => DB::table('stores')->orderBy('store_name')->get(['store_id', 'store_name'])]);
    }

    public function savePolicy(Request $request): JsonResponse
    {
        $this->admin($request);
        $this->input($request, ['expected_version', 'reason', 'confirmed', 'enabled', 'maximum_php', 'temporary_threshold', 'temporary_days', 'permanent_threshold']);
        $data = $request->validate($this->actionRules() + ['enabled' => ['required', function ($key, $value, $fail) { if (!is_bool($value)) $fail('Enabled must be true or false.'); }],
            'maximum_php' => ['required', 'string'], 'temporary_threshold' => ['required', 'integer', 'between:2,100', $this->strictInteger()],
            'permanent_threshold' => ['required', 'integer', 'gt:temporary_threshold', 'max:100', $this->strictInteger()], 'temporary_days' => ['required', 'integer', 'between:1,365', $this->strictInteger()]]);
        $values = ['enabled' => $data['enabled'], 'maximum_centavos' => app(CopPolicy::class)->parseMaximum($data['maximum_php']),
            'temporary_threshold' => (int) $data['temporary_threshold'], 'temporary_days' => (int) $data['temporary_days'], 'permanent_threshold' => (int) $data['permanent_threshold']];
        return DB::transaction(function () use ($request, $data, $values) {
            $actor = $this->admin($request);
            $before = app(CopPolicy::class)->current(true);
            abort_unless($before['version'] === (int) $data['expected_version'], 409, 'COP rules changed. Reload and review the current policy.');
            if (array_intersect_key($before, $values) === $values) return $this->response(['message' => 'COP rules are unchanged.', 'policy' => $before]);
            $id = DB::table('cop_policy_versions')->insertGetId($values + ['actor_user_id' => $actor, 'reason' => trim($data['reason']), 'effective_at' => now()]);
            DB::table('cop_policy')->where('id', 1)->update(['version_id' => $id]);
            return $this->response(['message' => 'COP rules saved. Newly accepted orders use this version; existing orders retain their accepted rules.', 'policy' => app(CopPolicy::class)->current(true)]);
        }, 3);
    }

    private function shopper(int $id): User
    {
        return User::whereHas('role', fn ($q) => $q->where('slug', 'shopper'))->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    public function accounts(Request $request, CopRestrictions $cop): JsonResponse
    {
        $this->admin($request);
        $this->input($request, ['page', 'per_page', 'search', 'eligibility']);
        $data = $request->validate(['page' => ['sometimes', 'integer', 'between:1,100000'], 'per_page' => ['sometimes', 'integer', 'between:1,50'],
            'search' => ['nullable', 'string', 'max:100'], 'eligibility' => ['sometimes', Rule::in(['all', 'available', 'restricted', 'manual', 'automatic', 'account_ineligible'])]]);
        return DB::transaction(function () use ($data, $cop) {
            $asOf = CarbonImmutable::now('UTC'); $policy = app(CopPolicy::class)->current();
            $query = DB::table('users as u')->join('roles as r', 'r.role_id', '=', 'u.role_id')->leftJoin('profiles as p', 'p.user_id', '=', 'u.id')->where('r.slug', 'shopper');
            $this->search($query, $data['search'] ?? '', ['u.email', 'p.first_name', 'p.last_name']);
            $filter = $data['eligibility'] ?? 'all';
            if (in_array($filter, ['restricted', 'manual', 'automatic'])) $query->whereExists(fn ($q) => $cop->blockingQuery($q, 'u.id', $asOf, $filter === 'restricted' ? null : $filter));
            if ($filter === 'available') {
                if (!$policy['enabled']) $query->whereRaw('1 = 0');
                $query->where('u.account_status', 'active')->whereNotNull('u.email_verified_at')->whereNotExists(fn ($q) => $cop->blockingQuery($q, 'u.id', $asOf));
            }
            if ($filter === 'account_ineligible') $query->where(fn ($q) => $q->where('u.account_status', '!=', 'active')->orWhereNull('u.email_verified_at'));
            $page = $query->orderBy('u.id')->select('u.id', 'u.email', 'p.first_name', 'p.last_name')->paginate($data['per_page'] ?? 20);
            $statuses = $cop->statuses($page->getCollection()->pluck('id')->all(), $asOf, $policy);
            $page->getCollection()->transform(fn ($u) => ['user_id' => $u->id, 'name' => trim(($u->first_name ?? '').' '.($u->last_name ?? '')) ?: 'Shopper #'.$u->id, 'email' => $u->email, 'cop' => $statuses[$u->id]]);
            return $this->response(['accounts' => $page, 'as_of' => $asOf->toIso8601String(), 'platform_enabled' => $policy['enabled']]);
        }, 3);
    }

    public function accountDetails(Request $request, int $user, CopRestrictions $cop): JsonResponse
    {
        $this->admin($request);
        $request->validate(['page' => ['sometimes', 'integer', 'between:1,100000']]);
        return DB::transaction(function () use ($request, $user, $cop) {
            $shopper = $this->shopper($user); $shopper->load('profile');
            $policy = app(CopPolicy::class)->current(true);
            return $this->response(['shopper' => ['user_id' => $user, 'name' => trim(($shopper->profile?->first_name ?? '').' '.($shopper->profile?->last_name ?? '')) ?: 'Shopper #'.$user, 'email' => $shopper->email],
                'cop' => $cop->status($user, policy: $policy, lock: true), ...$this->history($user, (int) $request->input('page', 1))]);
        }, 3);
    }

    private function history(int $user, int $page): array
    {
        $events = DB::table('cop_access_events')->where('shopper_user_id', $user)->orderByDesc('id')->paginate(10, ['id', 'actor_user_id', 'action', 'reason', 'occurred_at', 'before_state', 'after_state', 'strike_id'], 'page', $page);
        $events->getCollection()->transform(function ($e) { $e->before_state = json_decode($e->before_state ?? 'null', true); $e->after_state = json_decode($e->after_state ?? 'null', true); return $e; });
        $strikes = DB::table('cop_strikes as s')->leftJoin('cop_restrictions as cr', 'cr.strike_id', '=', 's.id')->where('s.shopper_user_id', $user)->orderByDesc('s.issued_at')->orderByDesc('s.id')
            ->paginate(10, ['s.id', 's.order_id', 's.strike_number_at_issue', 's.policy_version_id', 's.cycle_id', 's.issued_at', 's.voided_at', 's.voided_by_user_id', 's.correction_reason', 'cr.effective_count', 'cr.original_kind', 'cr.original_expires_at', 'cr.effective_kind', 'cr.effective_expires_at', 'cr.ended_at'], 'page', $page);
        $restrictions = DB::table('cop_restrictions')->where('shopper_user_id', $user)->orderByDesc('id')->paginate(10, ['id', 'source', 'original_kind', 'original_expires_at', 'effective_kind', 'effective_expires_at', 'started_at', 'ended_at', 'actor_user_id', 'reason', 'cycle_id'], 'page', $page);
        return compact('events', 'strikes', 'restrictions');
    }

    public function restrict(Request $request, int $user, CopRestrictions $cop): JsonResponse
    {
        $this->admin($request);
        $this->input($request, ['expected_version', 'reason', 'confirmed', 'kind', 'until']);
        $data = $request->validate($this->actionRules() + ['kind' => ['required', Rule::in(['temporary', 'until_restored'])],
            'until' => ['required_if:kind,temporary', 'prohibited_if:kind,until_restored', 'nullable', 'date_format:Y-m-d\TH:i']]);
        $until = ($data['kind'] === 'temporary') ? CarbonImmutable::createFromFormat('!Y-m-d\TH:i', $data['until'], 'Asia/Manila')->utc() : null;
        return DB::transaction(function () use ($request, $user, $cop, $data, $until) {
            $actor = $this->admin($request); $this->shopper($user);
            $policy = app(CopPolicy::class)->current(true); $account = $cop->account($user);
            abort_unless((int) $account->version === (int) $data['expected_version'], 409, 'COP access changed. Reload this Shopper before deciding.');
            if ($until && !$until->isFuture()) throw ValidationException::withMessages(['until' => 'Select a future Manila date and time.']);
            $before = $cop->status($user, policy: $policy, lock: true);
            $active = DB::table('cop_restrictions')->where('shopper_user_id', $user)->where('source', 'manual')->whereNull('ended_at')
                ->where(fn ($q) => $q->whereNull('effective_expires_at')->orWhere('effective_expires_at', '>', now()));
            $existing = (clone $active)->first(); $reason = trim($data['reason']);
            if ($existing && $existing->effective_kind === $data['kind'] && $existing->effective_expires_at === $until?->format('Y-m-d H:i:s') && $existing->reason === $reason) {
                return $this->response(['message' => 'This manual restriction is unchanged.', 'cop' => $before]);
            }
            $active->update(['ended_at' => now()]);
            DB::table('cop_restrictions')->insert(['shopper_user_id' => $user, 'cycle_id' => $account->cycle_id, 'source' => 'manual',
                'original_kind' => $data['kind'], 'effective_kind' => $data['kind'], 'original_expires_at' => $until, 'effective_expires_at' => $until,
                'started_at' => now(), 'actor_user_id' => $actor, 'reason' => $reason]);
            DB::table('cop_accounts')->where('shopper_user_id', $user)->increment('version');
            $after = $cop->status($user, policy: $policy, lock: true); $cop->event($user, $actor, 'restricted', $reason, $before, $after);
            return $this->response(['message' => 'Manual COP restriction recorded. Existing orders and account status are unchanged.', 'cop' => $after]);
        }, 3);
    }

    public function restore(Request $request, int $user, CopRestrictions $cop): JsonResponse
    {
        $this->admin($request); $this->input($request, ['expected_version', 'reason', 'confirmed']);
        $data = $request->validate($this->actionRules());
        return DB::transaction(function () use ($request, $user, $cop, $data) {
            $actor = $this->admin($request); $this->shopper($user);
            $policy = app(CopPolicy::class)->current(true); $account = $cop->account($user);
            abort_unless((int) $account->version === (int) $data['expected_version'], 409, 'COP access changed. Reload this Shopper before deciding.');
            $before = $cop->status($user, policy: $policy, lock: true);
            abort_unless($before['individual_restricted'], 409, 'There is no active individual COP restriction to restore.');
            $oldCycle = DB::table('cop_cycles')->where('id', $account->cycle_id)->lockForUpdate()->first();
            DB::table('cop_cycles')->where('id', $account->cycle_id)->update(['closed_at' => now()]);
            DB::table('cop_restrictions')->where('shopper_user_id', $user)->whereNull('ended_at')->update(['ended_at' => now()]);
            $newCycle = DB::table('cop_cycles')->insertGetId(['shopper_user_id' => $user, 'number' => $oldCycle->number + 1, 'started_at' => now()]);
            DB::table('cop_accounts')->where('shopper_user_id', $user)->update(['cycle_id' => $newCycle, 'version' => $account->version + 1]);
            $after = $cop->status($user, policy: $policy, lock: true); $cop->event($user, $actor, 'restored', trim($data['reason']), $before, $after);
            return $this->response(['message' => 'Individual COP restrictions lifted. A new warning cycle started; valid history is preserved. Platform and account checks still apply.', 'cop' => $after]);
        }, 3);
    }

    public function correct(Request $request, int $strike, CopRestrictions $cop): JsonResponse
    {
        $this->admin($request); $this->input($request, ['expected_version', 'reason', 'confirmed']);
        $data = $request->validate($this->actionRules());
        $initial = DB::table('cop_strikes')->find($strike); abort_unless($initial, 404);
        return DB::transaction(function () use ($request, $strike, $initial, $cop, $data) {
            $actor = $this->admin($request); $this->shopper($initial->shopper_user_id);
            $policy = app(CopPolicy::class)->current(true); $account = $cop->account($initial->shopper_user_id);
            abort_unless((int) $account->version === (int) $data['expected_version'], 409, 'COP access changed. Reload the current history.');
            $record = DB::table('cop_strikes')->where('id', $strike)->lockForUpdate()->first();
            abort_if($record->voided_at, 409, 'This strike has already been corrected.');
            $before = $cop->status($record->shopper_user_id, policy: $policy, lock: true);
            DB::table('cop_strikes')->where('id', $strike)->update(['voided_at' => now(), 'voided_by_user_id' => $actor, 'correction_reason' => trim($data['reason']), 'updated_at' => now()]);
            $cop->replay($record->shopper_user_id);
            DB::table('cop_accounts')->where('shopper_user_id', $record->shopper_user_id)->increment('version');
            $after = $cop->status($record->shopper_user_id, policy: $policy, lock: true);
            $cop->event($record->shopper_user_id, $actor, 'strike_corrected', trim($data['reason']), $before, $after, $strike);
            app(OrderNotifications::class)->notify(Order::findOrFail($record->order_id), 'cop_strike_corrected', 'Admin corrected an erroneous COP strike. Valid incidents and manual restrictions remain separate.');
            return $this->response(['message' => 'Erroneous strike corrected. Original-policy outcomes were replayed without restarting restriction periods.', 'cop' => $after]);
        }, 3);
    }

    private function search($query, string $search, array $columns): void
    {
        if ($search === '') return;
        $needle = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';
        $query->where(function ($q) use ($columns, $needle, $search) {
            foreach ($columns as $column) $q->orWhereRaw($column." LIKE ? ESCAPE '!'", [$needle]);
            if (($id = OrderReference::parse($search)) !== null && in_array('o.shopper_name', $columns)) $q->orWhere('o.order_id', $id);
        });
    }

    public function failedClaims(Request $request): JsonResponse
    {
        $this->admin($request);
        $this->input($request, ['page', 'per_page', 'search', 'from', 'until', 'store_id', 'payment_method', 'classification', 'resolution', 'strike_status']);
        $data = $request->validate(['page' => ['sometimes', 'integer', 'between:1,100000'], 'per_page' => ['sometimes', 'integer', 'between:1,50'],
            'search' => ['nullable', 'string', 'max:100'], 'from' => ['nullable', 'required_with:until', 'date_format:Y-m-d'], 'until' => ['nullable', 'required_with:from', 'date_format:Y-m-d', 'after_or_equal:from'],
            'store_id' => ['nullable', 'integer', 'exists:stores,store_id'], 'payment_method' => ['nullable', Rule::in(['cash_on_pickup', 'digital'])],
            'classification' => ['nullable', Rule::in(['no_show', 'paid_unclaimed', 'requires_review'])],
            'resolution' => ['nullable', Rule::in(['pending', 'resolved'])], 'strike_status' => ['nullable', Rule::in(['recorded', 'corrected', 'not_applicable', 'requires_review'])]]);
        $query = DB::table('cop_failed_claims as f')->join('orders as o', 'o.order_id', '=', 'f.order_id')->join('users as u', 'u.id', '=', 'o.shopper_user_id')
            ->join('stores as s', 's.store_id', '=', 'o.store_id')->leftJoin('cop_strikes as c', 'c.order_id', '=', 'o.order_id')->leftJoin('order_dispositions as d', 'd.order_id', '=', 'o.order_id');
        if (!empty($data['from'])) {
            $from = CarbonImmutable::parse($data['from'], 'Asia/Manila')->startOfDay()->utc(); $end = CarbonImmutable::parse($data['until'], 'Asia/Manila')->addDay()->startOfDay()->utc();
            if ($from->diffInDays($end) > 366) throw ValidationException::withMessages(['until' => 'Choose at most 366 incident-recorded dates.']);
            $query->where('f.incident_at', '>=', $from)->where('f.incident_at', '<', $end);
        }
        foreach (['store_id' => 'o.store_id', 'payment_method' => 'f.payment_method', 'classification' => 'f.classification'] as $field => $column) if (!empty($data[$field])) $query->where($column, $data[$field]);
        $this->search($query, $data['search'] ?? '', ['o.shopper_name', 'u.email']);
        $resolved = "(d.id IS NOT NULL OR o.claim_status IN ('completed','canceled'))";
        if (!empty($data['resolution'])) $query->whereRaw(($data['resolution'] === 'pending' ? 'NOT ' : '').$resolved);
        $outcome = "CASE WHEN f.classification = 'paid_unclaimed' THEN 'not_applicable' WHEN c.voided_at IS NOT NULL THEN 'corrected' WHEN c.id IS NOT NULL THEN 'recorded' ELSE 'requires_review' END";
        if (!empty($data['strike_status'])) $query->whereRaw($outcome.' = ?', [$data['strike_status']]);
        $page = $query->orderByDesc('f.incident_at')->orderByDesc('f.id')->select('f.id', 'f.order_id', 'f.classification', 'f.payment_method', 'f.payment_state', 'f.claim_deadline_at', 'f.incident_at', 'o.shopper_user_id', 'o.shopper_name', 'u.email', 's.store_name', 'o.payment_status', 'o.claim_status', 'o.refund_status')
            ->selectRaw($outcome.' as strike_status, '.$resolved.' as resolved')->paginate($data['per_page'] ?? 20);
        $page->getCollection()->transform(function ($r) { $r->order_reference = OrderReference::format($r->order_id); $r->resolved = (bool) $r->resolved; return $r; });
        return $this->response(['incidents' => $page, 'date_basis' => 'Incident recorded in Asia/Manila; saved final claim deadline shown separately.']);
    }

    public function failedClaimDetails(Request $request, int $incident): JsonResponse
    {
        $this->admin($request);
        $request->validate(['page' => ['sometimes', 'integer', 'between:1,100000']]);
        $record = DB::table('cop_failed_claims')->find($incident); abort_unless($record, 404);
        $order = Order::findOrFail($record->order_id);
        return $this->response(['incident' => $record, 'order_reference' => OrderReference::format($order->order_id),
            'current' => $order->only(['claim_status', 'payment_status', 'reservation_status', 'refund_status', 'cop_policy_version_id']),
            'timeline' => DB::table('order_status_history')->where('order_id', $order->order_id)->orderBy('id')->paginate(10, ['previous_status', 'new_status', 'created_at'], 'page', (int) $request->input('page', 1)),
            'disposition' => DB::table('order_dispositions')->where('order_id', $order->order_id)->first(['disposition', 'reason', 'created_at']),
            'resolution_logs' => DB::table('order_resolution_logs')->where('order_id', $order->order_id)->orderByDesc('id')->paginate(10, ['action', 'reason', 'created_at'], 'page', (int) $request->input('page', 1)),
            ...$this->history($order->shopper_user_id, (int) $request->input('page', 1))]);
    }
}
