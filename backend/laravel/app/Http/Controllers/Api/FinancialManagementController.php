<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Services\FinancialLedger;
use App\Services\FinancialPolicy;
use App\Services\PayMongoGateway;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FinancialManagementController extends Controller
{
    private function only(Request $request, array $rules): array
    {
        $allowed = array_filter(array_keys($rules), fn ($key) => !str_contains($key, '.'));
        abort_if(array_diff(array_keys($request->all()), $allowed), 422, 'Unexpected financial fields.');
        return $request->validate($rules);
    }

    private function response(array $data)
    {
        return response()->json($data)->header('Cache-Control', 'private, no-store');
    }

    public function options(Request $request)
    {
        return DB::transaction(function () use ($request) {
            app(FinancialLedger::class)->admin($request->user()->id);
            $this->only($request, []);
            return $this->response(['stores' => Store::orderBy('store_name')->get(['store_id', 'store_name', 'status']),
                'today' => now('Asia/Manila')->format('Y-m-d')]);
        });
    }

    public function index(Request $request, int $store)
    {
        return DB::transaction(function () use ($request, $store) {
            app(FinancialLedger::class)->admin($request->user()->id);
            Store::whereKey($store)->lockForUpdate()->firstOrFail();
            $in = $this->only($request, ['mode' => ['required', Rule::in(['actual', 'test'])],
                'section' => ['required', Rule::in(['subscriptions', 'funding', 'settings', 'history'])],
                'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
                'status' => ['sometimes', Rule::in(['all', 'pending', 'paid', 'overdue', 'voided'])],
                'from' => ['sometimes', 'date_format:Y-m-d'], 'until' => ['sometimes', 'date_format:Y-m-d']]);
            abort_if(isset($in['from'], $in['until']) && $in['until'] < $in['from'], 422, 'Due until must be on or after Due from.');
            abort_if($in['section'] !== 'subscriptions' && array_intersect(['status', 'from', 'until'], array_keys($in)), 422, 'Billing filters apply only to subscriptions.');
            $mode = $in['mode'];
            $scope = ['store_id' => $store, 'mode' => $mode];
            $result = ['mode' => $mode];
            if ($in['section'] === 'subscriptions') {
                $result['agreement'] = DB::table('subscription_agreements')->where($scope)->first();
                $today = now('Asia/Manila')->format('Y-m-d');
                $query = DB::table('subscription_bills as b')->where(['b.store_id' => $store, 'b.mode' => $mode])
                    ->leftJoin('subscription_payments as p', 'p.active_bill_key', '=', 'b.id')
                    ->leftJoin('subscription_payment_verifications as v', 'v.payment_id', '=', 'p.id')
                    ->select('b.id', 'b.amount_centavos', 'b.period', 'b.agreement_version', 'b.coverage_from', 'b.coverage_until', 'b.due_on', 'b.created_at',
                        'p.id as payment_id', 'p.version as payment_version', 'p.amount_centavos as payment_amount_centavos', 'p.paid_on', 'p.method', 'v.created_at as verified_at')
                    ->selectRaw("CASE WHEN b.active_period_key IS NULL THEN 'voided' WHEN v.id IS NOT NULL THEN 'paid' WHEN b.due_on < ? THEN 'overdue' ELSE 'pending' END AS status", [$today]);
                $query = DB::query()->fromSub($query, 'bills')->when(($in['status'] ?? 'all') !== 'all', fn ($q) => $q->where('status', $in['status']))
                    ->when(isset($in['from']), fn ($q) => $q->where('due_on', '>=', $in['from']))
                    ->when(isset($in['until']), fn ($q) => $q->where('due_on', '<=', $in['until']));
                $result['records'] = $query->orderByDesc('id')->paginate(20);
            } elseif ($in['section'] === 'funding') {
                $budget = DB::table('incentive_budgets')->where($scope)->first();
                $result['budget'] = ['available_centavos' => (int) ($budget?->available_centavos ?? 0),
                    'reserved_centavos' => (int) ($budget?->reserved_centavos ?? 0)];
                $result['budget']['net_funded_centavos'] = array_sum($result['budget']);
                $query = DB::table('incentive_movements as m')->join('incentive_budgets as b', 'b.id', '=', 'm.budget_id')
                    ->join('users as u', 'u.id', '=', 'm.actor_id')->where(['b.store_id' => $store, 'b.mode' => $mode])
                    ->select('m.*', 'u.email as actor');
                $query->selectSub(DB::table('incentive_movements as r')->select('r.id')->whereColumn('r.related_id', 'm.id')->where('r.kind', 'contribution_return')->limit(1), 'returned_by');
                $result['records'] = $query->orderByDesc('m.id')->paginate(20);
            } elseif ($in['section'] === 'history') {
                $result['records'] = DB::table('financial_audits as a')->join('users as u', 'u.id', '=', 'a.actor_id')
                    ->where(['a.store_id' => $store, 'a.mode' => $mode])->select('a.id', 'a.action', 'a.entity', 'a.reason', 'a.created_at', 'u.email as actor')->orderByDesc('a.id')->paginate(20);
            } else {
                $policy = app(FinancialPolicy::class)->current($store);
                $version = $policy['version'] ? DB::table('store_financial_policy_versions')->find($policy['version']) : null;
                $result['policy'] = $policy + ['approval_note' => $version?->approval_note];
                try { $result['merchant_methods'] = app(PayMongoGateway::class)->merchant($store)['methods']; }
                catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) { $result['merchant_methods'] = []; }
                $result['gateway'] = app(PayMongoGateway::class)->options($store);
            }
            return $this->response($result);
        });
    }

    public function billDetails(Request $request, int $store, int $bill)
    {
        return DB::transaction(function () use ($request, $store, $bill) {
            app(FinancialLedger::class)->admin($request->user()->id);
            Store::whereKey($store)->lockForUpdate()->firstOrFail();
            $in = $this->only($request, ['mode' => ['required', Rule::in(['actual', 'test'])], 'page' => ['sometimes', 'integer', 'min:1', 'max:100000']]);
            $record = DB::table('subscription_bills')->where(['id' => $bill, 'store_id' => $store, 'mode' => $in['mode']])->first() ?? abort(404);
            $payments = DB::table('subscription_payments as p')->leftJoin('subscription_payment_verifications as v', 'v.payment_id', '=', 'p.id')
                ->leftJoin('subscription_payment_reversals as r', 'r.payment_id', '=', 'p.id')->join('users as u', 'u.id', '=', 'p.actor_id')
                ->where('p.bill_id', $bill)->select('p.*', 'u.email as actor', 'v.created_at as verified_at', 'v.reason as verification_reason',
                    'r.created_at as reversed_at', 'r.reason as reversal_reason')->orderByDesc('p.id')->paginate(10);
            $payments->getCollection()->transform(function ($p) {
                $p->unallocated_centavos = $p->verified_at && !$p->reversed_at ? app(FinancialLedger::class)->unallocated($p) : 0;
                $p->evidence = Crypt::decryptString($p->evidence);
                unset($p->evidence_hash, $p->active_evidence_key, $p->active_bill_key);
                return $p;
            });
            return $this->response(['bill' => $record, 'payments' => $payments,
                'void' => DB::table('subscription_bill_voids')->where('bill_id', $bill)->first()]);
        });
    }

    public function write(Request $request, int $store, string $action)
    {
        // Explicit active Admin check also runs inside the posting transaction after waiting for the actor lock.
        $actor = \App\Models\User::with('role')->findOrFail($request->user()->id);
        abort_unless($actor->account_status === 'active' && $actor->role?->slug === 'admin', 403);
        $raw = json_decode($request->getContent(), true);
        foreach (['amount', 'cap'] as $moneyField) {
            if (isset($raw[$moneyField]) && is_string($raw[$moneyField])) abort_if(trim($raw[$moneyField]) !== $raw[$moneyField], 422, 'Money inputs cannot contain surrounding whitespace.');
        }
        $date = ['required', 'date_format:Y-m-d', 'after_or_equal:1900-01-01', 'before_or_equal:9998-12-31'];
        $version = ['required', 'integer', 'min:0', 'max:4294967294'];
        $id = ['required', 'integer', 'min:1'];
        $fields = match ($action) {
            'agreement' => ['amount' => ['required', 'string'], 'period' => ['required', Rule::in(['monthly', 'annual'])],
                'starts_on' => $date, 'status' => ['required', Rule::in(['active', 'inactive'])], 'expected_version' => $version],
            'bill' => ['coverage_from' => $date, 'due_on' => $date, 'expected_version' => $version],
            'void_bill', 'return_contribution' => ['id' => $id],
            'payment' => ['id' => $id, 'amount' => ['required', 'string'], 'paid_on' => [...$date, 'before_or_equal:'.now('Asia/Manila')->format('Y-m-d')],
                'method' => ['required', Rule::in(['cash', 'bank_transfer', 'other'])], 'evidence' => ['required', 'string', 'min:3', 'max:300']],
            'verify', 'reverse_payment' => ['id' => $id, 'expected_version' => $version],
            'contribute' => ['id' => $id, 'amount' => ['required', 'string']],
            'policy' => ['expected_version' => $version, 'fee_enabled' => ['required', 'boolean'], 'rate_bps' => ['required', 'integer', 'between:0,10000'],
                'cap' => ['nullable', 'string'], 'approval_note' => ['nullable', 'string', 'max:500'], 'digital_enabled' => ['required', 'boolean'],
                'digital_methods' => ['nullable', 'array', 'max:6'], 'digital_methods.*' => ['required', 'string', 'distinct', Rule::in(['card', 'gcash', 'paymaya', 'grab_pay', 'qrph', 'shopee_pay'])]],
            default => abort(404), // reserve/release deliberately absent
        };
        $in = $this->only($request, $fields + ['mode' => ['required', Rule::in(['actual', 'test'])], 'idempotency_key' => ['required', 'uuid'], 'reason' => ['required', 'string', 'min:3', 'max:500']]);
        $mode = $in['mode']; $key = $in['idempotency_key']; unset($in['mode'], $in['idempotency_key']);
        try { $result = app(FinancialLedger::class)->execute($request->user()->id, $store, $mode, $action, $key, $in); }
        catch (\Illuminate\Database\QueryException $e) {
            if (in_array((string) $e->getCode(), ['23000', '23505'], true)) abort(409, 'A conflicting financial record already exists. Refresh and review before retrying.');
            throw $e;
        }
        return $this->response(['result' => $result]);
    }
}
