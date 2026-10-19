<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Carbon\CarbonImmutable;

class CopRestrictions
{
    // Caller locks the Shopper user row before creating/correcting strikes or checking out.
    public function status(int $userId): array
    {
        $strikes = DB::table('cop_strikes')->where('shopper_user_id', $userId)->whereNull('voided_at')->orderBy('issued_at')->orderBy('id')->lockForUpdate()->get();
        $count = $strikes->count();
        $until = $count === 2 ? CarbonImmutable::parse($strikes[1]->issued_at, 'UTC')->addDays(30) : null;
        return ['strike_count' => $count, 'permanently_disabled' => $count >= 3,
            'disabled_until' => $until?->toIso8601String(),
            'allowed' => $count < 3 && (!$until || $until->lessThanOrEqualTo(now()))];
    }

    public function requireAllowed(int $userId): void
    {
        $status = $this->status($userId);
        if (!$status['allowed']) throw ValidationException::withMessages(['payment_method' => $status['permanently_disabled']
            ? 'Cash on Pickup is permanently disabled after three valid No-Shows. Your account can still use supported prepaid methods.'
            : 'Cash on Pickup is disabled until '.$status['disabled_until'].'.']);
    }
}
