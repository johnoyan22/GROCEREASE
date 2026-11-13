<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StoreStaffAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StockAlertController extends Controller
{
    public function index(Request $request, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            abort_unless(Schema::hasTable('stock_alerts'), 503, 'Automatic stock alerts await reviewed database setup. Manual low-stock reporting remains available.');
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name']), 'alerts' => DB::table('stock_alerts')
                ->leftJoin('stock_alert_acknowledgements as ack', fn ($q) => $q->on('ack.alert_id', '=', 'stock_alerts.id')->where('ack.user_id', $context['user']->id))
                ->where('stock_alerts.store_id', $context['store']->store_id)->orderByDesc('stock_alerts.id')->get(['stock_alerts.*', 'ack.read_at'])]);
        });
    }

    public function read(Request $request, int $alert, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $alert, $access) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            abort_unless(Schema::hasTable('stock_alerts'), 503, 'Automatic stock alerts await reviewed database setup.');
            abort_unless(DB::table('stock_alerts')->where('id', $alert)->where('store_id', $context['store']->store_id)->exists(), 404);
            DB::table('stock_alert_acknowledgements')->insertOrIgnore(['alert_id' => $alert, 'user_id' => $context['user']->id, 'read_at' => now()]);
            return response()->json(['message' => 'Stock alert acknowledged.']);
        });
    }
}
