<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class FinancialPolicy
{
    // The caller locks the Store before this read when accepting an order or changing policy.
    public function current(int $storeId): array
    {
        $head = DB::table('store_financial_policies')->where('store_id', $storeId)->lockForUpdate()->first();
        if (!$head) return ['version' => 0, 'fee_enabled' => false, 'rate_bps' => 0, 'cap_centavos' => null,
            'digital_enabled' => true, 'digital_methods' => null];
        $row = DB::table('store_financial_policy_versions')->where('id', $head->version_id)->lockForUpdate()->first();
        return ['version' => (int) $row->id, 'fee_enabled' => (bool) $row->fee_enabled, 'rate_bps' => (int) $row->rate_bps,
            'cap_centavos' => $row->cap_centavos === null ? null : (int) $row->cap_centavos,
            'digital_enabled' => (bool) $row->digital_enabled,
            'digital_methods' => $row->digital_methods === null ? null : json_decode($row->digital_methods, true, 512, JSON_THROW_ON_ERROR)];
    }

    public function methods(array $policy, array $merchantMethods): array
    {
        return $policy['digital_enabled'] ? array_values(array_intersect($merchantMethods, $policy['digital_methods'] ?? $merchantMethods)) : [];
    }

    public function fee(array $policy, int $subtotal): int
    {
        if (!$policy['fee_enabled']) return 0;
        // Half up, exactly once, on merchandise. MAX * 10,000 is safe on PHP 64-bit.
        $fee = intdiv($subtotal * $policy['rate_bps'] + 5000, 10000);
        return $policy['cap_centavos'] === null ? $fee : min($fee, $policy['cap_centavos']);
    }
}
