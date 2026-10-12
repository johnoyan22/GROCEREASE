<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SuperAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SupervisorOrderTrackingController extends Controller
{
    private const TRANSITIONS = [
        'Pending' => ['Preparing', 'Cancelled'],
        'Preparing' => ['Ready for Pickup', 'Cancelled'],
        'Ready for Pickup' => ['Completed'],
        'Completed' => [],
        'Cancelled' => [],
    ];

    private function supervisor(Request $request): SuperAdmin
    {
        $account = $request->user();
        abort_unless($account instanceof SuperAdmin && $account->role_type === 'Supervisor', 403, 'Supervisor access required.');
        return $account;
    }

    public function index(Request $request): JsonResponse
    {
        $this->supervisor($request);
        $input = $request->validate(['status' => ['nullable', Rule::in(array_merge(array_keys(self::TRANSITIONS), ['active']))]]);
        $query = DB::table('orders as o')
            ->join('grocer_users as g', 'o.user_id', '=', 'g.user_id')
            ->join('profiles as p', 'g.profile_id', '=', 'p.profile_id')
            ->leftJoin('worker_assignments as wa', function ($join) {
                $join->on('wa.order_id', '=', 'o.order_id')->whereNull('wa.completed_at');
            })
            ->select('o.*', 'p.first_name', 'p.last_name')
            ->selectRaw('MIN(wa.worker_id) as assigned_worker_id')
            ->groupBy('o.order_id', 'o.user_id', 'o.order_status', 'o.priority_order', 'o.priority_fee', 'o.time_completion', 'o.payment_type', 'o.pickup_window', 'o.verification_code', 'o.gross_amount', 'o.service_fee', 'o.net_total', 'o.created_at', 'o.updated_at', 'p.first_name', 'p.last_name');
        if (($input['status'] ?? null) === 'active') $query->whereNotIn('o.order_status', ['Completed', 'Cancelled']);
        elseif (!empty($input['status'])) $query->where('o.order_status', $input['status']);
        return response()->json(['data' => $query->orderByDesc('o.created_at')->limit(200)->get()]);
    }

    public function update(Request $request, int $order): JsonResponse
    {
        $supervisor = $this->supervisor($request);
        $data = $request->validate([
            'order_status' => ['required', Rule::in(array_keys(self::TRANSITIONS))],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);
        $updated = DB::transaction(function () use ($order, $data, $supervisor) {
            $current = DB::table('orders')->where('order_id', $order)->lockForUpdate()->first();
            abort_unless($current, 404, 'Order not found.');
            $next = $data['order_status'];
            abort_unless(in_array($next, self::TRANSITIONS[$current->order_status] ?? [], true), 409, 'Invalid order status transition.');
            DB::table('orders')->where('order_id', $order)->update([
                'order_status' => $next,
                'time_completion' => $next === 'Completed' ? now() : $current->time_completion,
                'updated_at' => now(),
            ]);
            DB::table('order_status_histories')->insert([
                'order_id' => $order,
                'from_status' => $current->order_status,
                'to_status' => $next,
                'changed_by_admin_id' => $supervisor->admin_id,
                'reason' => $data['reason'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            return DB::table('orders')->where('order_id', $order)->first();
        });
        return response()->json(['message' => 'Order status updated and recorded.', 'data' => $updated]);
    }

    public function history(Request $request, int $order): JsonResponse
    {
        $this->supervisor($request);
        abort_unless(DB::table('orders')->where('order_id', $order)->exists(), 404, 'Order not found.');
        return response()->json(['data' => DB::table('order_status_histories')->where('order_id', $order)->orderByDesc('created_at')->get()]);
    }
}
