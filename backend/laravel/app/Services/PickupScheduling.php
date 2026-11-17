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
    public const PREPARATION_MINUTES = [30, 60, 90, 120, 180];
    public const WINDOW_MINUTES = [60, 120];

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
        if ($store->status !== Store::STATUS_ACTIVE || $closed || !$period || !$pickup) {
            throw ValidationException::withMessages(['pickup_date' => 'This store is closed or has suspended pickup on that date.']);
        }
        foreach ([$period, $pickup] as $interval) {
            if (!is_array($interval) || !is_string($interval['opens_at'] ?? null) || !is_string($interval['closes_at'] ?? null)
                || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $interval['opens_at'])
                || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $interval['closes_at'] ?? '') || $interval['opens_at'] >= $interval['closes_at']) {
                throw ValidationException::withMessages(['pickup_date' => 'This store must configure valid operating and pickup-service hours.']);
            }
        }
        if ($pickup['opens_at'] < $period['opens_at'] || $pickup['closes_at'] > $period['closes_at']) {
            throw ValidationException::withMessages(['pickup_date' => 'Pickup-service hours must fit the configured store operating hours.']);
        }
        return ['date' => $date, 'opens_at' => $pickup['opens_at'], 'closes_at' => $pickup['closes_at'],
            'store_opens_at' => $period['opens_at'], 'store_closes_at' => $period['closes_at'], 'timezone' => self::TIMEZONE];
    }

    public function requireWindowSchema(): void
    {
        $this->requireSchema();
        abort_unless(Schema::hasColumn('stores', 'pickup_preparation_minutes') && Schema::hasColumn('stores', 'pickup_window_minutes'),
            503, 'Pickup windows are awaiting database setup.');
    }

    // New checkout only. Supervisor review continues to use availability()/resolve().
    public function checkoutAvailability(Store $store, string $date, ?CarbonImmutable $now = null): array
    {
        $this->requireWindowSchema();
        $now = ($now ?? CarbonImmutable::now(self::TIMEZONE))->setTimezone(self::TIMEZONE);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date) || !CarbonImmutable::canBeCreatedFromFormat($date, '!Y-m-d') || $date < $now->format('Y-m-d')) {
            throw ValidationException::withMessages(['pickup_date' => 'Select a valid current or future pickup date.']);
        }
        $hours = $this->hours($store, $date);
        abort_unless(in_array($store->pickup_preparation_minutes, self::PREPARATION_MINUTES, true)
            && in_array($store->pickup_window_minutes, self::WINDOW_MINUTES, true), 503, 'The Supervisor must configure valid pickup-window settings.');
        $at = fn (string $time) => CarbonImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$time, self::TIMEZONE);
        $storeOpening = $at($hours['store_opens_at']);
        $ready = ($now->greaterThan($storeOpening) ? $now : $storeOpening)->addMinutes($store->pickup_preparation_minutes);
        $closing = $at($hours['closes_at']);
        $windows = [];
        for ($start = $at($hours['opens_at']); ($end = $start->addMinutes($store->pickup_window_minutes))->lessThanOrEqualTo($closing); $start = $end) {
            if ($start->greaterThanOrEqualTo($ready)) $windows[] = ['pickup_start' => $start->format('H:i'), 'pickup_end' => $end->format('H:i')];
        }
        return [...$hours, 'windows' => $windows, 'earliest_start_at' => $windows[0]['pickup_start'] ?? null,
            'today' => $now->format('Y-m-d'), 'server_now' => $now->toIso8601String()];
    }

    public function resolveCheckout(Store $store, array $selection): array
    {
        $hours = $this->checkoutAvailability($store, $selection['pickup_date']);
        $match = collect($hours['windows'])->contains(fn ($window) => $window['pickup_start'] === $selection['pickup_start'] && $window['pickup_end'] === $selection['pickup_end']);
        if (!$match) throw ValidationException::withMessages(['pickup_start' => 'This pickup window is no longer available. Refresh availability, select a window and review again.']);
        $at = fn (string $time) => CarbonImmutable::createFromFormat('!Y-m-d H:i', $selection['pickup_date'].' '.$time, self::TIMEZONE)->utc();
        return ['pickup_window_start_at' => $at($selection['pickup_start']), 'pickup_window_end_at' => $at($selection['pickup_end']), 'scheduled_store_closes_at' => $at($hours['store_closes_at'])];
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
