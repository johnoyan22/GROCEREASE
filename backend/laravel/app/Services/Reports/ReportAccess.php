<?php

namespace App\Services\Reports;

use App\Models\Store;
use App\Models\User;
use App\Services\StoreStaffAccess;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReportAccess
{
    public const TYPES = [
        'current_stock' => ['Current Stock Summary', false, ['inventory_worker', 'supervisor']],
        'batches' => ['Batches and Expiry', false, ['inventory_worker', 'supervisor']],
        'stock_changes' => ['Stock Requests and Changes', true, ['inventory_worker', 'supervisor']],
        'availability' => ['Availability Activity', true, ['inventory_worker', 'supervisor']],
        'payments' => ['Payments and Pickup Summary', true, ['admin', 'supervisor']],
        'order_operations' => ['Order Operations Summary', true, ['supervisor']],
        'store_operations' => ['Store Operations Summary', true, ['admin']],
        'cop' => ['COP Summary', true, ['admin']],
    ];

    // All callers run in a transaction. Re-resolve current account and placement each time.
    public function context(Request $request): array
    {
        $user = User::with(['role', 'profile'])->whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
        $role = $user->role?->slug;
        abort_unless($user->account_status === 'active' && in_array($role, ['admin', 'supervisor', 'inventory_worker'], true), 403);
        $store = $role === 'admin' ? null : app(StoreStaffAccess::class)->resolve($user, [$role])['store'];
        return ['user' => $user, 'role' => $role, 'store_id' => $store?->store_id, 'store' => $store,
            'session' => hash('sha256', app('session')->driver()->getId())];
    }

    public function options(array $context): array
    {
        $today = CarbonImmutable::now('Asia/Manila');
        $types = [];
        foreach (self::TYPES as $id => [$label, $period, $roles]) {
            if (in_array($context['role'], $roles, true)) $types[] = ['id' => $id, 'label' => $label, 'period' => $period];
        }
        return ['types' => $types, 'from' => $today->startOfMonth()->format('Y-m-d'), 'until' => $today->format('Y-m-d'),
            'store' => $context['store']?->only(['store_id', 'store_name']),
            'stores' => $context['role'] === 'admin' ? Store::orderBy('store_name')->get(['store_id', 'store_name'])->toArray() : []];
    }

    public function filters(Request $request, array $context): array
    {
        abort_if(array_diff(array_keys($request->all()), ['type', 'from', 'until', 'store_id', 'search', 'status', 'mode']), 422, 'Unexpected report filters.');
        $input = $request->validate([
            'type' => ['required', Rule::in(array_keys(self::TYPES))],
            'store_id' => $context['role'] === 'admin' ? ['nullable', 'integer', 'exists:stores,store_id'] : ['prohibited'],
            'from' => ['sometimes', 'date_format:Y-m-d'], 'until' => ['sometimes', 'date_format:Y-m-d'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'], 'status' => ['sometimes', 'string', 'max:30'],
            'mode' => ['sometimes', Rule::in(['all', 'actual', 'test', 'legacy'])],
        ]);
        [$label, $period, $roles] = self::TYPES[$input['type']];
        abort_unless(in_array($context['role'], $roles, true), 403, 'This report is not available to your role.');
        if (!$period) abort_if(isset($input['from']) || isset($input['until']), 422, 'Current snapshots do not accept historical dates.');
        $today = CarbonImmutable::now('Asia/Manila');
        $filters = ['type' => $input['type'], 'store_id' => $context['role'] === 'admin' ? ($input['store_id'] ?? null) : $context['store_id']];
        if ($period) {
            $from = CarbonImmutable::parse($input['from'] ?? $today->startOfMonth()->format('Y-m-d'), 'Asia/Manila')->startOfDay();
            $until = CarbonImmutable::parse($input['until'] ?? $today->format('Y-m-d'), 'Asia/Manila')->startOfDay();
            abort_if($until < $from, 422, 'The end date must be on or after the start date.');
            abort_if($from->diffInDays($until) >= 93, 422, 'Narrow the reporting period to 93 days or less.');
            $filters += ['from' => $from->format('Y-m-d'), 'until' => $until->format('Y-m-d')];
        }
        $inventory = in_array($input['type'], ['current_stock', 'batches', 'stock_changes', 'availability'], true);
        abort_if(isset($input['search']) && !$inventory, 422, 'Search is not applicable to this report.');
        if ($inventory) $filters['search'] = trim($input['search'] ?? '');
        abort_if(isset($input['mode']) && $input['type'] !== 'payments', 422, 'Payment mode is only available on payment reports.');
        if ($input['type'] === 'payments') $filters['mode'] = $input['mode'] ?? 'all';
        $statuses = match ($input['type']) {
            'batches' => ['all', 'active', 'expired', 'depleted', 'on_hold', 'inactive', 'expiring_30'],
            'stock_changes' => ['all', 'approved', 'pending', 'rejected'],
            default => ['all'],
        };
        abort_if(isset($input['status']) && (!in_array($input['type'], ['batches', 'stock_changes'], true) || !in_array($input['status'], $statuses, true)), 422, 'This status filter is not applicable.');
        if (count($statuses) > 1) $filters['status'] = $input['status'] ?? 'all';
        return $filters;
    }
}
