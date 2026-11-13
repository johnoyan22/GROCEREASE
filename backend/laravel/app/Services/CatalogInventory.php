<?php

namespace App\Services;

use App\Models\Store;
use App\Models\StoreInventory;
use Illuminate\Database\Eloquent\Builder;

class CatalogInventory
{
    public function query(Store $store): Builder
    {
        return StoreInventory::forStore($store->store_id)->where('store_inventory.status', StoreInventory::STATUS_ACTIVE)
            ->whereHas('product', fn ($query) => $query->forStore($store->store_id))->with('product');
    }

    public function sellable(Store $store): Builder
    {
        return app(BatchStock::class)->sellable($this->query($store));
    }
}
