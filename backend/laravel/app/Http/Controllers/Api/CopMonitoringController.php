<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Services\CopRestrictions;
use App\Services\OrderNotifications;
use App\Services\PickupScheduling;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CopMonitoringController extends Controller
{
    public function shopperStatus(Request $request, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        return DB::transaction(function () use ($request) {
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            return response()->json(['cop' => app(CopRestrictions::class)->status($request->user()->id)]);
        }, 3);
    }

    public function notifications(Request $request, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        return response()->json(['notifications' => DB::table('order_notifications')->where('user_id', $request->user()->id)->orderByDesc('id')->limit(50)->get()]);
    }

    public function readNotification(Request $request, int $notification, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        return DB::transaction(function () use ($request, $notification) {
            $record = DB::table('order_notifications')->where('user_id', $request->user()->id)->where('id', $notification)->lockForUpdate()->first();
            abort_unless($record, 404);
            if (!$record->read_at) DB::table('order_notifications')->where('id', $record->id)->update(['read_at' => now(), 'updated_at' => now()]);
            return response()->json(['message' => 'Order notification marked read.']);
        });
    }

    public function adminIndex(PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        $strikes = DB::table('cop_strikes')->join('users', 'users.id', '=', 'cop_strikes.shopper_user_id')
            ->join('stores', 'stores.store_id', '=', 'cop_strikes.store_id')->orderByDesc('cop_strikes.id')
            ->get(['cop_strikes.*', 'users.email', 'stores.store_name']);
        $accounts = [];
        foreach ($strikes->pluck('shopper_user_id')->unique()->sort() as $userId) {
            $accounts[] = DB::transaction(function () use ($userId) {
                $user = User::whereKey($userId)->lockForUpdate()->firstOrFail();
                return ['user_id' => $user->id, 'email' => $user->email, 'cop' => app(CopRestrictions::class)->status($user->id)];
            }, 3);
        }
        return response()->json(['strikes' => $strikes, 'accounts' => $accounts]);
    }

    public function correct(Request $request, int $strike, PickupScheduling $scheduling): JsonResponse
    {
        $scheduling->requireSchema();
        $validated = $request->validate(['reason' => ['required', 'string', 'max:500', 'regex:/\S/u'], 'voided_by_user_id' => ['prohibited'], 'shopper_user_id' => ['prohibited']]);
        $initial = DB::table('cop_strikes')->where('id', $strike)->first();
        abort_unless($initial, 404);
        return DB::transaction(function () use ($request, $strike, $initial, $validated) {
            User::whereKey($initial->shopper_user_id)->lockForUpdate()->firstOrFail();
            $record = DB::table('cop_strikes')->where('id', $strike)->lockForUpdate()->first();
            abort_if($record->voided_at, 409, 'This strike has already been corrected.');
            DB::table('cop_strikes')->where('id', $strike)->update(['voided_at' => now(), 'voided_by_user_id' => $request->user()->id,
                'correction_reason' => trim($validated['reason']), 'updated_at' => now()]);
            app(OrderNotifications::class)->notify(Order::findOrFail($record->order_id), 'cop_strike_corrected', 'Admin corrected a COP strike. Your COP eligibility was recalculated; the audit history remains available.');
            return response()->json(['message' => 'Strike corrected and COP eligibility recalculated.', 'cop' => app(CopRestrictions::class)->status($initial->shopper_user_id)]);
        }, 3);
    }
}
