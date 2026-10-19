<?php

namespace App\Services;

use App\Models\Store;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class PickupScheduling
{
    public const TIMEZONE = 'Asia/Manila';

    public function requireSchema(): void
    {
        abort_unless(Schema::hasColumn('stores', 'operating_hours') && Schema::hasColumn('orders', 'claim_status'), 503, 'Pickup scheduling is awaiting database setup.');
    }

    public function hours(Store $store, string $date): array
    {
        $this->requireSchema();
        $day = CarbonImmutable::createFromFormat('!Y-m-d', $date, self::TIMEZONE);
        $hours = $store->operating_hours;
        if (!is_array($hours) || count($hours) !== 7) {
            throw ValidationException::withMessages(['pickup_date' => 'This store has not configured its operating hours.']);
        }
        $closed = DB::table('store_pickup_exceptions')->where('store_id', $store->store_id)->where('date', $date)->lockForUpdate()->first();
        $period = $hours[(string) $day->isoWeekday()] ?? null;
        if ($closed || !$period) {
            throw ValidationException::withMessages(['pickup_date' => 'This store is closed or has suspended pickup on that date.']);
        }
        return ['date' => $date, 'opens_at' => $period['opens_at'], 'closes_at' => $period['closes_at'], 'timezone' => self::TIMEZONE];
    }

    public function resolve(Store $store, array $selection): array
    {
        $hours = $this->hours($store, $selection['pickup_date']);
        $date = $selection['pickup_date'];
        $start = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$selection['pickup_start'], self::TIMEZONE);
        $end = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$selection['pickup_end'], self::TIMEZONE);
        $opening = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$hours['opens_at'], self::TIMEZONE);
        $closing = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$hours['closes_at'], self::TIMEZONE);
        if ($start->isPast() || $end->lessThanOrEqualTo($start) || $start->lessThan($opening) || $end->greaterThan($closing)) {
            throw ValidationException::withMessages(['pickup_start' => 'Select a future pickup window within this store\'s operating hours.']);
        }
        return ['pickup_window_start_at' => $start->utc(), 'pickup_window_end_at' => $end->utc(), 'scheduled_store_closes_at' => $closing->utc()];
    }

    public function requireOpen(Store $store): void
    {
        $local = CarbonImmutable::now(self::TIMEZONE);
        $hours = $this->hours($store, $local->format('Y-m-d'));
        $time = $local->format('H:i');
        abort_unless($time >= $hours['opens_at'] && $time < $hours['closes_at'], 409, 'The store is outside pickup operating hours.');
    }

    public function selectionRules(): array
    {
        return ['pickup_date' => ['required', 'date_format:Y-m-d'], 'pickup_start' => ['required', 'date_format:H:i'], 'pickup_end' => ['required', 'date_format:H:i']];
    }
}
