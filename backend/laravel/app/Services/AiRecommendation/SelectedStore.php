<?php

namespace App\Services\AiRecommendation;

use App\Models\Store;
use Illuminate\Http\Request;

class SelectedStore
{
    public function select(Request $request, int $storeId): Store
    {
        $store = Store::active()->findOrFail($storeId);
        $request->session()->put('shopper_selected_store', ['user_id' => $request->user()->id, 'store_id' => $store->store_id]);

        return $store;
    }

    public function require(Request $request, int $storeId): Store
    {
        $selection = $request->session()->get('shopper_selected_store');
        abort_unless(is_array($selection) && ($selection['user_id'] ?? null) === $request->user()->id
            && ($selection['store_id'] ?? null) === $storeId, 409, 'Select this supermarket in Browse Products before requesting recommendations. Your store selection may have changed in another tab.');

        return Store::active()->findOrFail($storeId);
    }
}
