<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\SuperAdmin;
use Illuminate\Validation\Rule;

class SupervisorStockApprovalsController extends Controller
{
    private function authorizeSupervisor(Request $request): void
    {
        $user = $request->user();
        abort_unless($user, 401, 'Unauthenticated.');
        abort_unless($user instanceof SuperAdmin && $user->role_type === 'Supervisor', 403, 'Supervisor access required.');
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        $requests = DB::table('supervisor_stock_requests as r')
            ->join('store_inventory as i', 'i.store_inventory_id', '=', 'r.store_inventory_id')
            ->join('products as p', 'p.product_id', '=', 'i.product_id')
            ->select('r.id', 'r.store_inventory_id', 'r.worker_id', 'r.reason', 'r.requested_quantity', 'r.status', 'r.created_at',
                'p.product_name as item_name', 'p.category', 'i.hard_stock_qty as current_stock')
            ->orderByDesc('r.created_at')->limit(500)->get();

        $inventory = DB::table('store_inventory as i')
            ->join('products as p', 'p.product_id', '=', 'i.product_id')
            ->select('i.store_inventory_id as id', 'p.product_name as name', 'i.hard_stock_qty as quantity')
            ->orderBy('i.hard_stock_qty')->limit(100)->get();

        return response()->json(['data' => ['requests' => $requests, 'inventory' => $inventory]]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->authorizeSupervisor($request);
        $data = $request->validate(['status' => ['required', Rule::in(['Approved', 'Needs Review'])]]);
        $updated = DB::table('supervisor_stock_requests')
            ->where('id', $id)
            ->whereIn('status', ['Pending', 'Needs Review'])
            ->where('status', '!=', $data['status'])
            ->update(['status' => $data['status'], 'updated_at' => now()]);
        if (!$updated) {
            $row = DB::table('supervisor_stock_requests')->where('id', $id)->first();
            abort_unless($row, 404, 'Stock request not found.');
            return response()->json(['message' => 'This status transition is not allowed.'], 409);
        }
        return response()->json(['message' => 'Stock request updated.', 'data' => DB::table('supervisor_stock_requests')->where('id', $id)->first()]);
    }
}
