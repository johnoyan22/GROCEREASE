<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\StoreStaffAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ProductPhotoController extends Controller
{
    public function show(Request $request, int $product, StoreStaffAccess $access)
    {
        $record = Product::findOrFail($product);
        if ($request->user()->role?->slug === 'shopper') {
            abort_unless($request->user()->hasVerifiedEmail(), 403);
            abort_unless($record->store?->status === 'active' && $record->storeInventories()->where('status', 'active')->exists(), 404);
        } else {
            DB::transaction(function () use ($request, $access, $record) {
                $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
                abort_unless($record->store_id === $context['store']->store_id, 404);
            });
        }
        return $this->photo($record);
    }

    public function publicShow(int $store, int $product, \App\Services\PublicStoreAccess $access, \App\Services\CatalogInventory $catalog)
    {
        $selected = $access->find($store);
        $item = $catalog->sellable($selected)->where('product_id', $product)->firstOrFail();
        return $this->photo($item->product);
    }

    private function photo(Product $record)
    {
        $path = $record->image_path;
        abort_unless($path && str_starts_with($path, 'product-photos/') && ! str_contains($path, '..') && Storage::disk('local')->exists($path), 404);
        abort_unless(in_array(Storage::disk('local')->mimeType($path), ['image/jpeg', 'image/png', 'image/webp'], true), 404);
        return response()->file(Storage::disk('local')->path($path), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'"]);
    }

    public function save(Request $request, int $item, StoreStaffAccess $access)
    {
        $request->validate(['photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096', 'dimensions:max_width=6000,max_height=6000']]);
        return $this->change($request, $item, $access, false);
    }

    public function destroy(Request $request, int $item, StoreStaffAccess $access)
    {
        return $this->change($request, $item, $access, true);
    }

    private function change(Request $request, int $item, StoreStaffAccess $access, bool $remove)
    {
        $new = null;
        try {
            $result = DB::transaction(function () use ($request, $item, $access, $remove, &$new) {
                $context = $access->resolve($request->user(), ['inventory_worker']);
                abort_unless(Schema::hasColumn('products', 'image_path'), 503, 'Product photos await reviewed catalog database setup.');
                $inventory = $access->inventory($context['store'], $item);
                $product = Product::forStore($context['store']->store_id)->lockForUpdate()->findOrFail($inventory->product_id);
                $old = $product->image_path;
                $new = $remove ? null : $request->file('photo')->store('product-photos', 'local');
                abort_if(! $remove && ! $new, 503, 'The image could not be saved.');
                $product->update(['image_path' => $new]);
                return ['old' => $old, 'image_url' => $product->imageUrl()];
            });
        } catch (\Throwable $error) {
            if ($new) Storage::disk('local')->delete($new);
            throw $error;
        }
        if ($result['old'] && str_starts_with($result['old'], 'product-photos/') && ! str_contains($result['old'], '..')) Storage::disk('local')->delete($result['old']);
        return response()->json(['message' => $remove ? 'Product photo removed.' : 'Product photo saved.', 'image_url' => $result['image_url']]);
    }
}
