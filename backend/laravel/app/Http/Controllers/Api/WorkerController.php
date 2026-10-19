<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Worker;
use App\Models\WorkerAssignment;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class WorkerController extends Controller
{
    public function index(Request $request, StoreStaffAccess $access): JsonResponse
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $request->validate($this->protectedFields());
            $this->requireSchema();
            $workers = Worker::where('store_id', $context['store']->store_id)
                ->orderBy('full_name')->orderBy('worker_id')->lockForUpdate()->get();
            $rows = [];
            foreach ($workers as $worker) $rows[] = $this->workerData($worker);
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name', 'address']), 'workers' => $rows]);
        }, 3);
    }

    public function store(Request $request, StoreStaffAccess $access): JsonResponse
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $this->requireSchema();
            $validated = $request->validate(array_merge($this->rules(), ['status' => ['prohibited']]));
            $worker = Worker::create([
                'store_id' => $context['store']->store_id, 'full_name' => $validated['full_name'],
                'work_type' => $validated['work_type'], 'status' => 'active',
                'created_by_user_id' => $context['user']->id,
            ]);
            return response()->json(['message' => 'Store worker registered. No login account was created.', 'worker' => $this->workerData($worker)], 201);
        }, 3);
    }

    public function update(Request $request, int $worker, StoreStaffAccess $access): JsonResponse
    {
        return DB::transaction(function () use ($request, $worker, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $this->requireSchema();
            $record = Worker::where('store_id', $context['store']->store_id)->whereKey($worker)->lockForUpdate()->firstOrFail();
            $validated = $request->validate(array_merge($this->rules(), ['status' => ['required', Rule::in(['active', 'inactive'])]]));
            if ($validated['status'] === 'inactive' && WorkerAssignment::where('worker_id', $record->worker_id)
                ->where('status', 'assigned')->lockForUpdate()->first()) {
                abort(409, 'Finish or reassign this worker’s active task before deactivation.');
            }
            $record->full_name = $validated['full_name'];
            $record->work_type = $validated['work_type'];
            $record->status = $validated['status'];
            if ($record->isDirty()) {
                $record->updated_by_user_id = $context['user']->id;
                $record->save();
            }
            return response()->json(['message' => 'Store worker saved.', 'worker' => $this->workerData($record)]);
        }, 3);
    }

    private function rules(): array
    {
        return array_merge($this->protectedFields(), [
            'full_name' => ['required', 'string', 'max:150', 'regex:/\S/u'],
            'work_type' => ['required', Rule::in(['picker', 'packer', 'picker_packer'])],
        ]);
    }

    private function protectedFields(): array
    {
        return array_fill_keys([
            'store_id', 'worker_id', 'user_id', 'profile_id', 'role', 'role_id',
            'password', 'password_confirmation', 'email', 'created_by_user_id', 'updated_by_user_id',
            'worker_incentives', 'order_handled', 'created_at', 'updated_at',
        ], ['prohibited']);
    }

    private function workerData(Worker $worker): array
    {
        $active = WorkerAssignment::where('worker_id', $worker->worker_id)->where('status', 'assigned')->lockForUpdate()->first();
        return [
            'worker_id' => $worker->worker_id, 'store_id' => $worker->store_id,
            'full_name' => $worker->full_name, 'work_type' => $worker->work_type, 'status' => $worker->status,
            'active_task_count' => $active ? 1 : 0, 'busy_order_id' => $active?->order_id,
            'availability' => $worker->status === 'inactive' ? 'Inactive' : ($active ? 'Busy' : 'Available'),
            'created_by_user_id' => $worker->created_by_user_id,
            'updated_by_user_id' => $worker->updated_by_user_id,
        ];
    }

    private function requireSchema(): void
    {
        if (! Schema::hasTable('workers') || ! Schema::hasTable('worker_assignments')) {
            abort(503, 'Store worker management is awaiting database setup.');
        }
    }
}
