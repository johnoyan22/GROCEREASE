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
        abort_unless(Schema::hasColumn('stores', 'pickup_service_hours') && Schema::hasColumn('orders', 'pickup_schedule_review_required'), 503, 'Pickup scheduling is awaiting database setup.');
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
        $period = $hours[$day->isoWeekday()] ?? null;
        // Existing stores retain their original pickup hours until a Supervisor saves separate hours.
        $pickupHours = $store->pickup_service_hours ?? $hours;
        $pickup = $pickupHours[$day->isoWeekday()] ?? null;
        if ($closed || !$period || !$pickup) {
            throw ValidationException::withMessages(['pickup_date' => 'This store is closed or has suspended pickup on that date.']);
        }
        return ['date' => $date, 'opens_at' => $pickup['opens_at'], 'closes_at' => $pickup['closes_at'],
            'store_opens_at' => $period['opens_at'], 'store_closes_at' => $period['closes_at'], 'timezone' => self::TIMEZONE];
    }

    public function availability(Store $store, string $date): array
    {
        $hours = $this->hours($store, $date);
        $now = CarbonImmutable::now(self::TIMEZONE);
        $earliest = $hours['opens_at'];
        if ($date < $now->format('Y-m-d')) {
            throw ValidationException::withMessages(['pickup_date' => 'Select a future pickup date and time.']);
        }
        if ($date === $now->format('Y-m-d')) {
            $nextMinute = $now->startOfMinute()->addMinute()->format('H:i');
            if ($nextMinute > $earliest) $earliest = $nextMinute;
        }
        if ($earliest >= $hours['closes_at'] || ($date === $now->format('Y-m-d') && $now->addMinute()->format('Y-m-d') !== $date)) {
            throw ValidationException::withMessages(['pickup_date' => 'No future pickup window is available on this date.']);
        }
        $hours['earliest_start_at'] = $earliest;
        return $hours;
    }

    public function resolve(Store $store, array $selection): array
    {
        $hours = $this->hours($store, $selection['pickup_date']);
        $date = $selection['pickup_date'];
        $start = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$selection['pickup_start'], self::TIMEZONE);
        $end = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$selection['pickup_end'], self::TIMEZONE);
        $opening = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$hours['opens_at'], self::TIMEZONE);
        $pickupClosing = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$hours['closes_at'], self::TIMEZONE);
        $storeOpening = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$hours['store_opens_at'], self::TIMEZONE);
        $closing = CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$hours['store_closes_at'], self::TIMEZONE);
        if ($start->lessThanOrEqualTo(CarbonImmutable::now()) || $end->lessThanOrEqualTo($start)
            || $start->lessThan($opening) || $end->greaterThan($pickupClosing) || $start->lessThan($storeOpening) || $end->greaterThan($closing)) {
            throw ValidationException::withMessages(['pickup_start' => 'Select a future window within both store operating hours and pickup-service hours.']);
        }
        return ['pickup_window_start_at' => $start->utc(), 'pickup_window_end_at' => $end->utc(), 'scheduled_store_closes_at' => $closing->utc()];
    }

    public function requireOpen(Store $store): void
    {
        $local = CarbonImmutable::now(self::TIMEZONE);
        $hours = $this->hours($store, $local->format('Y-m-d'));
        $time = $local->format('H:i');
        abort_unless($time >= $hours['opens_at'] && $time < $hours['closes_at']
            && $time >= $hours['store_opens_at'] && $time < $hours['store_closes_at'], 409, 'The store is outside pickup operating hours.');
    }

    public function selectionRules(): array
    {
        return ['pickup_date' => ['required', 'date_format:Y-m-d'], 'pickup_start' => ['required', 'date_format:H:i'], 'pickup_end' => ['required', 'date_format:H:i']];
    }
}
