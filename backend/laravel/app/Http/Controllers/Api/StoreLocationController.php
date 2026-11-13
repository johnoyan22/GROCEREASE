<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StoreLocationController extends Controller
{
    public function index(\App\Services\PublicStoreAccess $access)
    {
        if (! Schema::hasTable('store_locations')) {
            return response()->json(['available' => false, 'stores' => [], 'message' => 'Store locations are being prepared. You can still choose a supermarket after signing in.']);
        }
        $stores = $access->query()
            ->orderBy('stores.store_name')->orderBy('stores.store_id')
            ->get(['stores.store_id', 'stores.store_name', 'stores.address', 'public_locations.latitude', 'public_locations.longitude'])
            ->map(fn ($store) => ['store_id' => $store->store_id, 'store_name' => $store->store_name, 'address' => $store->address,
                'latitude' => (float) $store->latitude, 'longitude' => (float) $store->longitude]);

        return response()->json(['available' => true, 'stores' => $stores]);
    }

    public function show(Store $store)
    {
        $this->requireSchema();
        $location = DB::table('store_locations')->where('store_id', $store->store_id)->first();
        return response()->json(['location' => $this->present($location, $store)]);
    }

    public function update(Request $request, Store $store)
    {
        $this->requireSchema();
        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'verified' => ['required', 'boolean'],
            'expected_address' => ['required', 'string', 'max:255'],
            'verification_note' => ['required', 'string', 'min:3', 'max:500'],
            'store_id' => ['prohibited'], 'actor_user_id' => ['prohibited'],
            'verified_at' => ['prohibited'], 'verified_by_user_id' => ['prohibited'],
        ]);
        return DB::transaction(function () use ($request, $store, $data) {
            $current = Store::query()->lockForUpdate()->findOrFail($store->store_id);
            abort_unless($data['expected_address'] === $current->address, 409, 'The store address changed. Close this form, refresh stores and verify the current pickup address.');
            $before = DB::table('store_locations')->where('store_id', $current->store_id)->lockForUpdate()->first();
            $after = ['latitude' => round((float) $data['latitude'], 7), 'longitude' => round((float) $data['longitude'], 7),
                'verified_address' => $current->address, 'verified_at' => $data['verified'] ? now() : null,
                'verified_by_user_id' => $data['verified'] ? $request->user()->id : null, 'updated_at' => now()];
            DB::table('store_locations')->updateOrInsert(['store_id' => $current->store_id],
                [...$after, 'created_at' => $before?->created_at ?? now()]);
            DB::table('store_location_audits')->insert(['store_id' => $current->store_id, 'actor_user_id' => $request->user()->id,
                'before' => $before ? json_encode($before, JSON_THROW_ON_ERROR) : null,
                'after' => json_encode($after, JSON_THROW_ON_ERROR), 'verification_note' => $data['verification_note'], 'created_at' => now()]);
            return response()->json(['message' => $data['verified'] ? 'Verified map location saved. Only active stores appear publicly.' : 'Location saved as unverified and hidden from the public locator.',
                'location' => $this->present(DB::table('store_locations')->where('store_id', $current->store_id)->first(), $current)]);
        }, 3);
    }

    private function requireSchema(): void
    {
        abort_unless(Schema::hasTable('store_locations') && Schema::hasTable('store_location_audits'), 503,
            'Store locator setup is pending. Existing store management remains available.');
    }

    private function present($location, Store $store): ?array
    {
        return $location ? ['latitude' => (float) $location->latitude, 'longitude' => (float) $location->longitude,
            'verified' => $location->verified_at !== null && $location->verified_address === $store->address,
            'verified_at' => $location->verified_at, 'address_changed' => $location->verified_address !== $store->address] : null;
    }
}
