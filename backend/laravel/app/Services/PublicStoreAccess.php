<?php

namespace App\Services;

use App\Models\Store;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PublicStoreAccess
{
    public function available(): bool { return Schema::hasTable('store_locations'); }

    public function query(): Builder
    {
        $query = Store::active()->join('store_locations as public_locations', 'public_locations.store_id', '=', 'stores.store_id')
            ->whereNotNull('public_locations.verified_at')->whereNotNull('public_locations.verified_by_user_id')
            ->whereBetween('public_locations.latitude', [-90, 90])->whereBetween('public_locations.longitude', [-180, 180]);
        // Verification approves the exact address, including on MySQL's case-insensitive collations.
        if (DB::connection()->getDriverName() === 'mysql') $query->whereRaw('BINARY public_locations.verified_address = BINARY stores.address');
        else $query->whereColumn('public_locations.verified_address', 'stores.address');
        return $query;
    }

    public function find(int $id): Store
    {
        abort_unless($this->available(), 404, 'This store is not available for public browsing.');
        return $this->query()->where('stores.store_id', $id)->select('stores.*')->firstOrFail();
    }

    // Called under the existing store row lock by Admin store-address updates.
    public function invalidate(int $storeId, int $actorId): void
    {
        if (! $this->available()) return;
        $before = DB::table('store_locations')->where('store_id', $storeId)->lockForUpdate()->first();
        if (! $before) return;
        abort_unless(Schema::hasTable('store_location_audits'), 503, 'Store locator audit setup needs review before changing this verified address.');
        DB::table('store_locations')->where('store_id', $storeId)->update(['verified_at' => null, 'verified_by_user_id' => null, 'updated_at' => now()]);
        DB::table('store_location_audits')->insert(['store_id' => $storeId, 'actor_user_id' => $actorId,
            'before' => json_encode($before, JSON_THROW_ON_ERROR),
            'after' => json_encode(DB::table('store_locations')->where('store_id', $storeId)->first(), JSON_THROW_ON_ERROR),
            'verification_note' => 'Store address changed. Public map/catalog verification revoked; the current pickup address must be verified again.', 'created_at' => now()]);
    }
}
