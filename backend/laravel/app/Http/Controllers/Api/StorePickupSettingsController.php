<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Services\PickupScheduling;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StorePickupSettingsController extends Controller
{
    public function show(int $store, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        $record = Store::findOrFail($store);
        return response()->json(['store_id' => $record->store_id, 'operating_hours' => $record->operating_hours,
            'paid_order_holding_hours' => $record->paid_order_holding_hours, 'timezone' => PickupScheduling::TIMEZONE,
            'closures' => DB::table('store_pickup_exceptions')->where('store_id', $record->store_id)->orderByDesc('date')->get()]);
    }

    public function update(Request $request, int $store, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        $validated = $request->validate([
            'operating_hours' => ['required', 'array:1,2,3,4,5,6,7', 'size:7'],
            'operating_hours.*' => ['nullable', 'array:opens_at,closes_at'],
            'operating_hours.*.opens_at' => ['required_with:operating_hours.*.closes_at', 'date_format:H:i'],
            'operating_hours.*.closes_at' => ['required_with:operating_hours.*.opens_at', 'date_format:H:i'],
            'paid_order_holding_hours' => ['present', 'nullable', 'integer', Rule::in([24, 48])],
            'store_id' => ['prohibited'], 'changed_by_user_id' => ['prohibited'],
        ]);
        foreach (range(1, 7) as $day) {
            if (!array_key_exists($day, $validated['operating_hours'])) throw ValidationException::withMessages(['operating_hours' => 'Configure all seven weekdays; use closed for non-operating days.']);
            $period = $validated['operating_hours'][$day];
            if ($period !== null && (!isset($period['opens_at'], $period['closes_at']) || $period['opens_at'] >= $period['closes_at'])) {
                throw ValidationException::withMessages(['operating_hours' => 'Each open day needs an opening time earlier than its closing time.']);
            }
        }
        return DB::transaction(function () use ($request, $store, $validated) {
            $record = Store::whereKey($store)->lockForUpdate()->firstOrFail();
            $previous = $record->only(['operating_hours', 'paid_order_holding_hours']);
            $record->forceFill($validated);
            if ($record->isDirty()) {
                $record->save();
                DB::table('store_schedule_logs')->insert(['store_id' => $record->store_id, 'changed_by_user_id' => $request->user()->id,
                    'previous_settings' => json_encode($previous), 'new_settings' => json_encode($record->only(['operating_hours', 'paid_order_holding_hours'])), 'created_at' => now(), 'updated_at' => now()]);
            }
            return response()->json(['message' => 'Store pickup hours and holding policy saved.']);
        }, 3);
    }

    public function closeDate(Request $request, int $store, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        $validated = $request->validate(['date' => ['required', 'date_format:Y-m-d'], 'reason' => ['required', 'string', 'max:500', 'regex:/\S/u'], 'recorded_by_user_id' => ['prohibited'], 'store_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $store, $validated) {
            Store::whereKey($store)->lockForUpdate()->firstOrFail();
            abort_if(DB::table('store_pickup_exceptions')->where('store_id', $store)->where('date', $validated['date'])->lockForUpdate()->first(), 409, 'Pickup suspension is already recorded for this date.');
            DB::table('store_pickup_exceptions')->insert(['store_id' => $store, 'date' => $validated['date'], 'reason' => trim($validated['reason']), 'recorded_by_user_id' => $request->user()->id, 'created_at' => now(), 'updated_at' => now()]);
            return response()->json(['message' => 'Pickup suspended for this date. Automatic COP strikes are suppressed for affected orders.']);
        }, 3);
    }

    public function available(Request $request, int $store, PickupScheduling $scheduling): JsonResponse
    {
        $validated = $request->validate(['date' => ['required', 'date_format:Y-m-d']]);
        $record = Store::active()->findOrFail($store);
        return response()->json(['store_id' => $record->store_id, 'hours' => $scheduling->hours($record, $validated['date'])]);
    }
}
