<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StaffStoreAssignmentController extends Controller
{
    public function adminIndex(): JsonResponse
    {
        $staff = User::query()
            ->with(['role', 'profile', 'staffStoreAssignment.store'])
            ->whereHas('role', fn ($query) => $query->whereIn(
                'slug', User::STAFF_ROLES
            ))
            ->orderBy('id')
            ->get()
            ->map(fn (User $user): array => $this->staffData($user));

        return response()->json([
            'staff' => $staff,
            'stores' => Store::active()->orderBy('store_name')
                ->get(['store_id', 'store_name', 'address', 'status']),
        ]);
    }

    public function adminUpdate(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'store_id' => ['required', 'integer', 'exists:stores,store_id'],
            'user_id' => ['prohibited'],
            'assigned_by_user_id' => ['prohibited'],
            'role' => ['prohibited'],
            'role_id' => ['prohibited'],
        ]);

        $assignment = DB::transaction(function () use ($request, $user, $validated) {
            $staff = User::query()->with('role')
                ->lockForUpdate()->findOrFail($user->id);

            if (! $staff->isApprovedStaff()) {
                throw ValidationException::withMessages([
                    'user' => 'Select an Admin-approved Inventory Worker or Supervisor.',
                ]);
            }

            $store = Store::query()->lockForUpdate()->find($validated['store_id']);

            if (! $store || $store->status !== Store::STATUS_ACTIVE) {
                throw ValidationException::withMessages([
                    'store_id' => 'Select an active store.',
                ]);
            }

            $assignment = $staff->staffStoreAssignment()->lockForUpdate()->first();

            if ($assignment && (int) $assignment->store_id === (int) $store->store_id) {
                return $assignment;
            }

            return StaffStoreAssignment::updateOrCreate(
                ['user_id' => $staff->id],
                [
                    'store_id' => $store->store_id,
                    'assigned_by_user_id' => $request->user()->id,
                ]
            );
        }, 3);

        return response()->json([
            'message' => 'Staff store assignment saved.',
            'assignment' => $this->assignmentData($assignment->load('store')),
        ]);
    }

    public function supervisorIndex(Request $request): JsonResponse
    {
        $this->validateStaffInput($request);
        $store = $this->currentStore($request);

        $staff = User::query()
            ->with(['role', 'profile', 'staffStoreAssignment.store'])
            ->whereHas('role', fn ($query) => $query->where('slug', 'inventory_worker'))
            ->whereHas('staffStoreAssignment', fn ($query) => $query->where(
                'store_id', $store->store_id
            ))
            ->orderBy('id')->get()
            ->map(fn (User $user): array => $this->staffData($user));

        $available = User::query()
            ->with(['role', 'profile', 'staffStoreAssignment.store'])
            ->whereHas('role', fn ($query) => $query->where('slug', 'inventory_worker'))
            ->whereNotNull('staff_approved_at')
            ->whereNotNull('staff_approved_by_user_id')
            ->whereDoesntHave('staffStoreAssignment')
            ->orderBy('id')->get()
            ->map(fn (User $user): array => $this->staffData($user));

        return response()->json([
            'store' => $store->only(['store_id', 'store_name', 'address', 'status']),
            'staff' => $staff,
            'available_staff' => $available,
        ]);
    }

    public function supervisorAssign(Request $request, User $user): JsonResponse
    {
        $this->validateStaffInput($request);

        $assignment = DB::transaction(function () use ($request, $user) {
            $actorId = $request->user()->id;

            // Lock actor and target in a consistent order.
            // Admin transfers also lock the target user's row.
            $accounts = User::query()->with('role')
                ->whereIn('id', [$actorId, $user->id])
                ->orderBy('id')->lockForUpdate()->get()->keyBy('id');

            $supervisor = $accounts->get($actorId);
            $staff = $accounts->get($user->id);

            abort_unless(
                $supervisor
                    && $supervisor->role?->slug === 'supervisor'
                    && $supervisor->isApprovedStaff(),
                403,
                'An approved Supervisor account is required.'
            );

            abort_unless($staff, 404, 'Staff account not found.');

            $placement = $supervisor->staffStoreAssignment()->lockForUpdate()->first();

            abort_unless($placement, 403, 'You need an active store assignment.');

            $store = Store::query()->lockForUpdate()->find($placement->store_id);

            abort_unless(
                $store && $store->status === Store::STATUS_ACTIVE,
                403,
                'You need an active store assignment.'
            );

            if ($staff->role?->slug !== 'inventory_worker' || ! $staff->isApprovedStaff()) {
                throw ValidationException::withMessages([
                    'user' => 'Select an approved, available Inventory Worker.',
                ]);
            }

            $existing = $staff->staffStoreAssignment()->lockForUpdate()->first();

            abort_if(
                $existing && (int) $existing->store_id !== (int) $store->store_id,
                409,
                'This staff account is already assigned. Only Admin can transfer staff.'
            );

            // Repeating an assignment to this same store is a harmless retry.
            return $existing ?? StaffStoreAssignment::create([
                'user_id' => $staff->id,
                'store_id' => $store->store_id,
                'assigned_by_user_id' => $supervisor->id,
            ]);
        }, 3);

        return response()->json([
            'message' => 'Inventory Worker assigned to your store.',
            'assignment' => $this->assignmentData($assignment->load('store')),
        ]);
    }

    public function showMine(Request $request): JsonResponse
    {
        $this->validateStaffInput($request);

        return response()->json([
            'store' => $this->currentStore($request)->only([
                'store_id', 'store_name', 'address', 'status',
            ]),
        ]);
    }

    private function validateStaffInput(Request $request): void
    {
        $request->validate([
            'store_id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'assigned_by_user_id' => ['prohibited'],
            'role' => ['prohibited'],
            'role_id' => ['prohibited'],
        ]);
    }

    private function currentStore(Request $request): Store
    {
        $store = $request->user()->assignedStore();

        abort_unless(
            $store,
            403,
            'You need Admin approval and an active store assignment.'
        );

        return $store;
    }

    private function staffData(User $user): array
    {
        return [
            'id' => $user->id,
            'email' => $user->email,
            'role' => $user->role->slug,
            'first_name' => $user->profile?->first_name,
            'last_name' => $user->profile?->last_name,
            'approved' => $user->isApprovedStaff(),
            'assignment' => $user->staffStoreAssignment
                ? $this->assignmentData($user->staffStoreAssignment)
                : null,
        ];
    }

    private function assignmentData(StaffStoreAssignment $assignment): array
    {
        return [
            'id' => $assignment->id,
            'user_id' => $assignment->user_id,
            'store_id' => $assignment->store_id,
            'assigned_by_user_id' => $assignment->assigned_by_user_id,
            'store' => $assignment->store->only([
                'store_id', 'store_name', 'address', 'status',
            ]),
        ];
    }
}