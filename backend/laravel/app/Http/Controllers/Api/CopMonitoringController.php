<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\CopRestrictions;
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
            $policy = app(\App\Services\CopPolicy::class)->current(true);
            return response()->json(['cop' => app(CopRestrictions::class)->status($request->user()->id, policy: $policy, lock: true),
                'history' => DB::table('cop_access_events')->where('shopper_user_id', $request->user()->id)->orderByDesc('id')->limit(10)->get(['action', 'reason', 'occurred_at'])])->header('Cache-Control', 'no-store, private');
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

}
