<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Store;
use App\Services\PickupScheduling;
use App\Services\StoreStaffAccess;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StorePickupSettingsController extends Controller
{
    // Admin oversight is read-only. Operational writes use the Supervisor's current assignment.
    public function show(int $store, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        return DB::transaction(function () use ($store) {
            return response()->json($this->settings(Store::whereKey($store)->lockForUpdate()->firstOrFail()));
        }, 3);
    }

    public function supervisorShow(Request $request, StoreStaffAccess $access, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        $request->validate(['store_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);
            return response()->json($this->settings($context['store']));
        }, 3);
    }

    public function supervisorUpdate(Request $request, StoreStaffAccess $access, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $record = $context['store'];
            $validated = $request->validate([
                'operating_hours' => ['required', 'array:1,2,3,4,5,6,7', 'size:7'],
                'operating_hours.*' => ['nullable', 'array:opens_at,closes_at'],
                'operating_hours.*.opens_at' => ['required_with:operating_hours.*.closes_at', 'date_format:H:i'],
                'operating_hours.*.closes_at' => ['required_with:operating_hours.*.opens_at', 'date_format:H:i'],
                'pickup_service_hours' => ['required', 'array:1,2,3,4,5,6,7', 'size:7'],
                'pickup_service_hours.*' => ['nullable', 'array:opens_at,closes_at'],
                'pickup_service_hours.*.opens_at' => ['required_with:pickup_service_hours.*.closes_at', 'date_format:H:i'],
                'pickup_service_hours.*.closes_at' => ['required_with:pickup_service_hours.*.opens_at', 'date_format:H:i'],
                'paid_order_holding_hours' => ['present', 'nullable', 'integer', Rule::in([24, 48])],
                'store_id' => ['prohibited'], 'user_id' => ['prohibited'], 'changed_by_user_id' => ['prohibited'],
            ]);
            $this->validateHours($validated);
            $previous = $record->only(['operating_hours', 'pickup_service_hours', 'paid_order_holding_hours']);
            $record->forceFill($validated);
            $affected = [];
            if ($record->isDirty()) {
                $record->save();
                $current = $record->only(array_keys($previous));
                $affected = $this->flagAffectedOrders($record, $previous, $current);
                DB::table('store_schedule_logs')->insert([
                    'store_id' => $record->store_id, 'changed_by_user_id' => $context['user']->id,
                    'previous_settings' => json_encode($previous),
                    'new_settings' => json_encode(array_merge($current, ['review_order_ids' => $affected])),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            return response()->json(array_merge($this->settings($record), [
                'message' => 'Store operating hours and pickup settings saved. Existing order schedules and deadlines were preserved.',
                'newly_affected_order_ids' => $affected,
            ]));
        }, 3);
    }

    public function supervisorAvailable(Request $request, StoreStaffAccess $access, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        $validated = $request->validate(['date' => ['required', 'date_format:Y-m-d'], 'store_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $access, $scheduling, $validated) {
            $context = $access->resolve($request->user(), ['supervisor']);
            return response()->json(['store_id' => $context['store']->store_id, 'hours' => $scheduling->availability($context['store'], $validated['date'])]);
        }, 3);
    }

    public function supervisorCloseDate(Request $request, StoreStaffAccess $access, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $validated = $request->validate([
                'date' => ['required', 'date_format:Y-m-d'],
                'reason' => ['required', 'string', 'max:500', 'regex:/\S/u'],
                'recorded_by_user_id' => ['prohibited'], 'store_id' => ['prohibited'], 'user_id' => ['prohibited'],
            ]);
            $store = $context['store'];
            abort_if(DB::table('store_pickup_exceptions')->where('store_id', $store->store_id)->where('date', $validated['date'])->lockForUpdate()->first(), 409, 'Pickup suspension is already recorded for this date.');
            DB::table('store_pickup_exceptions')->insert([
                'store_id' => $store->store_id, 'date' => $validated['date'], 'reason' => trim($validated['reason']),
                'recorded_by_user_id' => $context['user']->id, 'created_at' => now(), 'updated_at' => now(),
            ]);
            $affected = $this->flagAffectedOrders($store, [], [], $validated['date']);
            DB::table('store_schedule_logs')->insert([
                'store_id' => $store->store_id, 'changed_by_user_id' => $context['user']->id,
                'previous_settings' => json_encode(['suspension' => null]),
                'new_settings' => json_encode(['suspended_date' => $validated['date'], 'reason' => trim($validated['reason']), 'review_order_ids' => $affected]),
                'created_at' => now(), 'updated_at' => now(),
            ]);
            return response()->json(array_merge($this->settings($store), [
                'message' => 'Pickup suspension recorded. Review affected orders; automatic COP strikes are suppressed.',
                'newly_affected_order_ids' => $affected,
            ]));
        }, 3);
    }

    public function available(Request $request, int $store, PickupScheduling $scheduling): JsonResponse
    {
        $validated = $request->validate(['date' => ['required', 'date_format:Y-m-d']]);
        return DB::transaction(function () use ($store, $validated, $scheduling) {
            $record = Store::active()->whereKey($store)->lockForUpdate()->firstOrFail();
            return response()->json(['store_id' => $record->store_id, 'hours' => $scheduling->availability($record, $validated['date'])]);
        }, 3);
    }

    private function validateHours(array $settings): void
    {
        foreach (range(1, 7) as $day) {
            foreach (['operating_hours', 'pickup_service_hours'] as $field) {
                if (!array_key_exists($day, $settings[$field])) {
                    throw ValidationException::withMessages([$field => 'Configure all seven weekdays; use closed for non-operating days.']);
                }
                $period = $settings[$field][$day];
                if ($period !== null && (!isset($period['opens_at'], $period['closes_at']) || $period['opens_at'] >= $period['closes_at'])) {
                    throw ValidationException::withMessages([$field => 'Each open day needs an opening time earlier than its closing time.']);
                }
            }
            $store = $settings['operating_hours'][$day];
            $pickup = $settings['pickup_service_hours'][$day];
            if ($pickup && (!$store || $pickup['opens_at'] < $store['opens_at'] || $pickup['closes_at'] > $store['closes_at'])) {
                throw ValidationException::withMessages(['pickup_service_hours' => 'Pickup-service hours must be within store operating hours. Closed stores cannot offer pickup.']);
            }
        }
    }

    private function settings(Store $store): array
    {
        $logs = DB::table('store_schedule_logs')->where('store_id', $store->store_id)->orderByDesc('id')->limit(50)->get();
        foreach ($logs as $log) {
            $log->previous_settings = json_decode($log->previous_settings, true);
            $log->new_settings = json_decode($log->new_settings, true);
            $log->created_at = CarbonImmutable::parse($log->created_at, 'UTC')->toIso8601String();
        }
        return [
            'store' => $store->only(['store_id', 'store_name', 'address', 'status']),
            'store_id' => $store->store_id, 'operating_hours' => $store->operating_hours,
            'pickup_service_hours' => $store->pickup_service_hours,
            'paid_order_holding_hours' => $store->paid_order_holding_hours, 'timezone' => PickupScheduling::TIMEZONE,
            'closures' => DB::table('store_pickup_exceptions')->where('store_id', $store->store_id)->orderByDesc('date')->get(),
            'schedule_history' => $logs,
            'affected_orders' => Order::where('store_id', $store->store_id)->where('pickup_schedule_review_required', true)
                ->where('reservation_status', 'active')->whereIn('status', ['waiting', 'preparing', 'ready_for_pickup'])
                ->orderBy('pickup_window_start_at')->lockForUpdate()->get([
                    'order_id', 'status', 'claim_status', 'pickup_window_start_at', 'pickup_window_end_at',
                    'scheduled_store_closes_at', 'claim_expires_at',
                ]),
        ];
    }

    private function flagAffectedOrders(Store $store, array $before, array $after, ?string $suspendedDate = null): array
    {
        $affected = [];
        $orders = Order::where('store_id', $store->store_id)->where('reservation_status', 'active')
            ->whereIn('status', ['waiting', 'preparing', 'ready_for_pickup'])->orderBy('order_id')->lockForUpdate()->get();
        foreach ($orders as $order) {
            if (!$order->pickup_window_start_at) continue;
            $local = $order->pickup_window_start_at->copy()->setTimezone(PickupScheduling::TIMEZONE);
            $day = $local->isoWeekday();
            if ($suspendedDate !== null) {
                $changed = $local->format('Y-m-d') === $suspendedDate;
            } else {
                $oldOperating = $before['operating_hours'][$day] ?? null;
                $newOperating = $after['operating_hours'][$day] ?? null;
                $oldPickup = ($before['pickup_service_hours'] ?? $before['operating_hours'])[$day] ?? null;
                $newPickup = ($after['pickup_service_hours'] ?? $after['operating_hours'])[$day] ?? null;
                $changed = $oldOperating !== $newOperating || $oldPickup !== $newPickup;
            }
            if (!$changed) continue;
            // Deliberately preserve approved windows, claim deadlines, credentials, stock and payment.
            $order->pickup_schedule_review_required = true;
            $order->save();
            $affected[] = $order->order_id;
        }
        return $affected;
    }
}
