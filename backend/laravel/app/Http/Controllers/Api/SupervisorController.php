<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SuperAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class SupervisorController extends Controller
{
    private function authorizeSupervisor(Request $request): SuperAdmin
    {
        $user = $request->user();
        abort_unless($user instanceof SuperAdmin && $user->role_type === 'Supervisor', 403, 'Supervisor access required.');
        return $user;
    }

    public function dashboard(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        return response()->json(['data' => [
            'total_orders' => DB::table('orders')->count(),
            'pending_orders' => DB::table('orders')->where('order_status', 'Pending')->count(),
            'preparing_orders' => DB::table('orders')->where('order_status', 'Preparing')->count(),
            'completed_orders' => DB::table('orders')->where('order_status', 'Completed')->count(),
            'workers' => DB::table('workers')->count(),
            'pending_returns' => DB::table('return_requests')->where('request_status', 'Pending')->count(),
            'revenue' => DB::table('transactions')->sum('amount_paid'),
        ]]);
    }

    public function orders(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        return response()->json(['data' => DB::table('orders')->orderByDesc('created_at')->limit(200)->get()]);
    }

    public function updateOrder(Request $request, int $order): JsonResponse
    {
        $this->authorizeSupervisor($request);
        $data = $request->validate(['order_status' => ['required', Rule::in(['Pending', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'])]]);
        $current = DB::table('orders')->where('order_id', $order)->first();
        abort_unless($current, 404, 'Order not found.');
        $allowed = [
            'Pending' => ['Preparing', 'Cancelled'],
            'Preparing' => ['Ready for Pickup', 'Cancelled'],
            'Ready for Pickup' => ['Completed'],
            'Completed' => [],
            'Cancelled' => [],
        ];
        abort_unless(in_array($data['order_status'], $allowed[$current->order_status] ?? [], true), 409, 'Invalid order status transition.');
        DB::table('orders')->where('order_id', $order)->update(['order_status' => $data['order_status'], 'time_completion' => $data['order_status'] === 'Completed' ? now() : $current->time_completion, 'updated_at' => now()]);
        return response()->json(['message' => 'Order updated.', 'data' => DB::table('orders')->where('order_id', $order)->first()]);
    }

    public function workers(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        return response()->json(['data' => DB::table('workers')->join('profiles', 'workers.profile_id', '=', 'profiles.profile_id')->select('workers.worker_id', 'workers.order_handled', 'workers.worker_incentives', 'profiles.first_name', 'profiles.last_name', 'profiles.email')->get()]);
    }

    public function assignWorker(Request $request, int $order): JsonResponse
    {
        $supervisor = $this->authorizeSupervisor($request);
        $data = $request->validate(['worker_id' => ['required', 'integer', 'exists:workers,worker_id']]);
        abort_unless(DB::table('orders')->where('order_id', $order)->exists(), 404, 'Order not found.');
        abort_if(DB::table('orders')->where('order_id', $order)->whereIn('order_status', ['Completed', 'Cancelled'])->exists(), 409, 'Order is closed.');
        $assignment = DB::transaction(function () use ($order, $data, $supervisor) {
            $existing = DB::table('worker_assignments')->where('order_id', $order)->whereNull('completed_at')->lockForUpdate()->first();
            abort_if($existing, 409, 'Order already has an active worker assignment.');
            $id = DB::table('worker_assignments')->insertGetId(['order_id' => $order, 'worker_id' => $data['worker_id'], 'admin_id' => $supervisor->admin_id, 'assigned_at' => now(), 'created_at' => now(), 'updated_at' => now()], 'assignment_id');
            return DB::table('worker_assignments')->where('assignment_id', $id)->first();
        });
        return response()->json(['message' => 'Worker assigned.', 'data' => $assignment], 201);
    }

    public function payments(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        return response()->json(['data' => DB::table('transactions')->orderByDesc('settled_at')->limit(200)->get()]);
    }

    public function returns(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        return response()->json(['data' => DB::table('return_requests')->orderByDesc('created_at')->limit(200)->get()]);
    }

    public function updateReturn(Request $request, int $returnRequest): JsonResponse
    {
        $this->authorizeSupervisor($request);
        $data = $request->validate(['request_status' => ['required', Rule::in(['Approved', 'Rejected', 'Resolved'])]]);
        $row = DB::table('return_requests')->where('return_id', $returnRequest)->first();
        abort_unless($row, 404, 'Return request not found.');
        abort_unless(($row->request_status === 'Pending' && in_array($data['request_status'], ['Approved', 'Rejected'], true)) || ($row->request_status === 'Approved' && $data['request_status'] === 'Resolved'), 409, 'Invalid return status transition.');
        DB::table('return_requests')->where('return_id', $returnRequest)->update(['request_status' => $data['request_status'], 'updated_at' => now()]);
        return response()->json(['message' => 'Return request updated.', 'data' => DB::table('return_requests')->where('return_id', $returnRequest)->first()]);
    }

    public function inventory(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        return response()->json(['data' => DB::table('store_inventory')->join('products', 'products.product_id', '=', 'store_inventory.product_id')->select('store_inventory.*', 'products.product_name', 'products.category')->limit(200)->get()]);
    }

    public function sales(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        $data = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $query = DB::table('transactions');
        if (!empty($data['from'])) $query->whereDate('settled_at', '>=', $data['from']);
        if (!empty($data['to'])) $query->whereDate('settled_at', '<=', $data['to']);
        return response()->json(['data' => ['transactions' => (clone $query)->count(), 'total_sales' => (clone $query)->sum('amount_paid'), 'by_payment_mode' => $query->select('payment_mode')->selectRaw('COUNT(*) as count, SUM(amount_paid) as total')->groupBy('payment_mode')->get()]]);
    }

    public function profile(Request $request): JsonResponse
    {
        $supervisor = $this->authorizeSupervisor($request);
        return response()->json(['data' => $supervisor->profile]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $supervisor = $this->authorizeSupervisor($request);
        $data = $request->validate(['first_name' => ['sometimes', 'required', 'string', 'max:100'], 'last_name' => ['sometimes', 'required', 'string', 'max:100'], 'phone_number' => ['sometimes', 'required', 'string', 'max:20']]);
        $supervisor->profile->update($data);
        return response()->json(['message' => 'Profile updated.', 'data' => $supervisor->profile->fresh()]);
    }

    public function stockRequests(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);
        return response()->json(['data' => DB::table('supervisor_stock_requests')->orderByDesc('created_at')->limit(200)->get()]);
    }

    public function updateStockRequest(Request $request, int $stockRequest): JsonResponse
    {
        $this->authorizeSupervisor($request);
        $data = $request->validate(['status' => ['required', Rule::in(['Approved', 'Rejected', 'Needs Review'])]]);
        $row = DB::table('supervisor_stock_requests')->where('id', $stockRequest)->first();
        abort_unless($row, 404, 'Stock request not found.');
        abort_unless(in_array($row->status, ['Pending', 'Needs Review'], true), 409, 'Stock request already decided.');
        DB::table('supervisor_stock_requests')->where('id', $stockRequest)->update(['status' => $data['status'], 'updated_at' => now()]);
        return response()->json(['message' => 'Stock request reviewed.', 'data' => DB::table('supervisor_stock_requests')->where('id', $stockRequest)->first()]);
    }
}
