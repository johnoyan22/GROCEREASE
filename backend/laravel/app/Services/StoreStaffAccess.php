<?php

namespace App\Services;

use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;

class StoreStaffAccess
{
    // Call inside a database transaction so placement changes cannot race a write.
    public function resolve(User $signedInUser, array $allowedRoles): array
    {
        $user = User::query()->with('role')->lockForUpdate()->findOrFail($signedInUser->id);

        if (! in_array($user->role?->slug, $allowedRoles, true) || ! $user->isApprovedStaff()) {
            abort(403, 'An Admin-approved staff account with permission for this operation is required.');
        }

        $assignment = $user->staffStoreAssignment()->lockForUpdate()->first();
        if (! $assignment) {
            abort(403, 'An active store assignment is required.');
        }

        $store = Store::query()->lockForUpdate()->findOrFail($assignment->store_id);
        if ($store->status !== Store::STATUS_ACTIVE) {
            abort(403, 'An active store assignment is required.');
        }

        return ['user' => $user, 'store' => $store];
    }

    public function inventory(Store $store, int $inventoryId): StoreInventory
    {
        return StoreInventory::forStore($store->store_id)
            ->whereHas('product', function ($query) use ($store) {
                $query->forStore($store->store_id);
            })
            ->whereKey($inventoryId)->lockForUpdate()->firstOrFail();
    }
}
