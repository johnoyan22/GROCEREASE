<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminStoreController extends Controller
{
    public function index(): JsonResponse
    {
        $stores = Store::query()
            ->withCount(['staffStoreAssignments as assigned_staff_count'])
            ->orderBy('store_name')->orderBy('store_id')
            ->get()->map(fn (Store $store): array => $this->storeData($store));

        return response()->json(['stores' => $stores]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->detailRules());
        $store = Store::create([
            'store_name' => $validated['store_name'],
            'address' => $validated['address'],
            'status' => Store::STATUS_ACTIVE,
        ]);

        return response()->json([
            'message' => 'Store created. It is available for staff assignment.',
            'store' => $this->storeData($store->loadCount([
                'staffStoreAssignments as assigned_staff_count',
            ])),
        ], 201);
    }

    public function update(Request $request, Store $store): JsonResponse
    {
        $validated = $request->validate($this->detailRules());
        $store = $this->saveChanges($store, [
            'store_name' => $validated['store_name'],
            'address' => $validated['address'],
        ]);

        return response()->json([
            'message' => 'Store details saved.',
            'store' => $this->storeData($store),
        ]);
    }

    public function updateStatus(Request $request, Store $store): JsonResponse
    {
        $validated = $request->validate([
            ...$this->protectedFields(),
            'status' => ['required', 'string', Rule::in([
                Store::STATUS_ACTIVE, Store::STATUS_INACTIVE,
            ])],
            'store_name' => ['prohibited'],
            'address' => ['prohibited'],
        ]);
        $store = $this->saveChanges($store, ['status' => $validated['status']]);

        return response()->json([
            'message' => $store->status === Store::STATUS_ACTIVE
                ? 'Store activated. Approved staff can access their assigned store again.'
                : 'Store deactivated. Its records and staff assignments are preserved.',
            'store' => $this->storeData($store),
        ]);
    }

    private function detailRules(): array
    {
        return [
            ...$this->protectedFields(),
            'store_name' => ['required', 'string', 'max:100'],
            'address' => ['required', 'string', 'max:255'],
            'status' => ['prohibited'],
        ];
    }

    private function protectedFields(): array
    {
        return array_fill_keys([
            'id', 'store_id', 'owner_id', 'user_id', 'role', 'role_id',
            'assigned_by_user_id', 'assigned_staff_count', 'staff_ids',
            'created_at', 'updated_at',
        ], ['prohibited']);
    }

    private function saveChanges(Store $store, array $changes): Store
    {
        return DB::transaction(function () use ($store, $changes) {
            // Inventory writes and staff placements lock this same store row.
            $current = Store::query()->lockForUpdate()->findOrFail($store->store_id);
            $current->fill($changes);

            if ($current->isDirty()) {
                $current->save();
            }

            return $current->loadCount(['staffStoreAssignments as assigned_staff_count']);
        }, 3);
    }

    private function storeData(Store $store): array
    {
        return [
            'store_id' => $store->store_id,
            'store_name' => $store->store_name,
            'address' => $store->address,
            'status' => $store->status,
            'assigned_staff_count' => (int) $store->assigned_staff_count,
            'created_at' => $store->created_at?->toIso8601String(),
            'updated_at' => $store->updated_at?->toIso8601String(),
        ];
    }
}
