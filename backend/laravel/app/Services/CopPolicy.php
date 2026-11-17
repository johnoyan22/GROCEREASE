<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class CopPolicy
{
    public function at(\Carbon\CarbonImmutable $asOf): array
    {
        abort_unless(Schema::hasTable('cop_policy_versions'), 503, 'COP management database setup is required.');
        $version = DB::table('cop_policy_versions')->where(fn ($q) => $q->whereNull('effective_at')->orWhere('effective_at', '<=', $asOf))->orderByDesc('id')->first();
        abort_unless($version, 503, 'COP policy is unavailable.');
        return $this->values($version);
    }

    public function current(bool $lock = false): array
    {
        abort_unless(Schema::hasTable('cop_policy'), 503, 'COP management database setup is required.');
        $query = DB::table('cop_policy')->where('id', 1);
        $head = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($head, 503, 'COP policy is unavailable.');
        $version = DB::table('cop_policy_versions')->where('id', $head->version_id);
        return $this->values(($lock ? $version->lockForUpdate() : $version)->first());
    }

    public function values(object $row): array
    {
        return ['version' => (int) $row->id, 'enabled' => (bool) $row->enabled, 'maximum_centavos' => (int) $row->maximum_centavos,
            'temporary_threshold' => (int) $row->temporary_threshold, 'temporary_days' => (int) $row->temporary_days,
            'permanent_threshold' => (int) $row->permanent_threshold, 'currency' => 'PHP'];
    }

    public function parseMaximum(mixed $amount): int
    {
        if (!is_string($amount) || !preg_match('/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/D', $amount, $parts)) {
            throw ValidationException::withMessages(['maximum_php' => 'Enter a PHP amount with at most two decimal places.']);
        }
        $value = (int) $parts[1] * 100 + (int) str_pad($parts[2] ?? '', 2, '0');
        if ($value < 1 || $value > 4294967295) throw ValidationException::withMessages(['maximum_php' => 'The maximum must be between PHP 0.01 and PHP 42,949,672.95.']);
        return $value;
    }
}
