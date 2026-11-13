<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Store;
use App\Models\StoreInventory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TransactionTestCase;

class PublicCatalogTest extends TransactionTestCase
{
    private function publish(?Store $store = null): void
    {
        $store ??= $this->store;
        DB::table('store_locations')->insert(['store_id' => $store->store_id, 'latitude' => 10.3, 'longitude' => 123.9,
            'verified_address' => $store->address, 'verified_at' => now(), 'verified_by_user_id' => $this->admin->id, 'created_at' => now(), 'updated_at' => now()]);
    }
    private function guest(): void { $this->app['auth']->forgetGuards(); $this->app['auth']->guard('web')->logout(); }
    private function endpoint(?Store $store = null): string { return '/api/public/stores/'.($store ?? $this->store)->store_id.'/products'; }
    private function item(string $name, int $hard = 20, string $category = 'Test', ?Store $store = null): StoreInventory
    {
        $store ??= $this->store;
        $product = Product::create(['store_id' => $store->store_id, 'product_name' => $name, 'category' => $category, 'size' => '250 g', 'selling_unit' => 'pack']);
        return StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id, 'selling_price' => '10.50', 'hard_stock_qty' => $hard, 'soft_stock_qty' => 0, 'status' => 'active']);
    }
    private function batch(StoreInventory $item, int $quantity, string $status, string $expiry): void
    {
        DB::table('stock_batches')->insert(['store_id' => $item->store_id, 'store_inventory_id' => $item->store_inventory_id,
            'batch_reference' => 'FIXTURE-'.$item->store_inventory_id, 'received_date' => now('Asia/Manila')->subDays(5)->toDateString(), 'expiration_date' => $expiry,
            'quantity_received' => $quantity, 'remaining_qty' => $quantity, 'status' => $status,
            'received_by_user_id' => $this->inventoryWorker->id, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function test_guest_reads_only_sellable_owned_products_and_no_internal_quantities_or_audits(): void
    {
        $this->publish(); $this->publish($this->otherStore);
        $sold = $this->item('Fully reserved', 4); $sold->soft_stock_qty = 4; $sold->save();
        $inactive = $this->item('Inactive'); $inactive->status = 'inactive'; $inactive->save();
        $expired = $this->item('Expired', 5); $this->batch($expired, 5, 'available', now('Asia/Manila')->subDay()->toDateString());
        $quarantine = $this->item('Quarantined', 5); $this->batch($quarantine, 5, 'quarantined', now('Asia/Manila')->addDays(2)->toDateString());
        $safe = $this->item('Safe remaining', 10); $this->batch($safe, 2, 'quarantined', now('Asia/Manila')->addDay()->toDateString());
        $today = $this->item('Expires today', 3); $this->batch($today, 3, 'available', now('Asia/Manila')->toDateString());
        $this->item('Foreign store product', 10, 'Foreign category', $this->otherStore);
        $before = $this->businessState(); $this->guest();
        $response = $this->getJson($this->endpoint())->assertOk()->assertJsonCount(3, 'products')->assertJsonPath('store.store_id', $this->store->store_id);
        $names = array_column($response->json('products'), 'product_name'); sort($names);
        $this->assertSame(['Expires today', 'Rice', 'Safe remaining'], $names);
        foreach ($response->json('products') as $product) {
            $this->assertSame(['product_id','store_id','product_name','category','size','selling_unit','selling_price','availability','image_url'], array_keys($product));
            $this->assertSame('available', $product['availability']);
        }
        $this->assertStringNotContainsString('Foreign category', $response->getContent());
        $this->assertSame($before, $this->businessState());
        $this->assertSame(8, $safe->availableStock());
    }

    public function test_public_store_verification_status_and_exact_address_are_required_for_every_read(): void
    {
        $this->guest(); $this->getJson($this->endpoint())->assertNotFound();
        $this->publish(); $this->getJson($this->endpoint())->assertOk();
        $this->store->forceFill(['address' => 'a'])->save();
        $this->getJson($this->endpoint())->assertNotFound(); $this->getJson('/api/public/store-locations')->assertJsonCount(0, 'stores');
        $this->store->forceFill(['address' => 'A', 'status' => 'inactive'])->save(); $this->getJson($this->endpoint())->assertNotFound();
        $this->getJson('/api/public/stores/999999/products')->assertNotFound();
    }

    public function test_search_categories_pagination_and_validation_use_real_stable_catalog_rows(): void
    {
        $this->publish();
        for ($i = 1; $i <= 25; $i++) $this->item(sprintf('Milk %02d', $i), 3, 'Dairy');
        $this->item('Milk 100% special', 3, 'Dairy'); $this->guest();
        $first = $this->getJson($this->endpoint().'?category=Dairy&per_page=12')->assertOk()->assertJsonCount(12, 'products')->assertJsonPath('pagination.total', 26);
        $second = $this->getJson($this->endpoint().'?category=Dairy&per_page=12&page=2')->assertOk()->assertJsonCount(12, 'products');
        $this->assertSame([], array_intersect(array_column($first->json('products'), 'product_id'), array_column($second->json('products'), 'product_id')));
        $this->getJson($this->endpoint().'?search=100%25')->assertOk()->assertJsonCount(1, 'products')->assertJsonPath('products.0.product_name', 'Milk 100% special');
        $this->getJson($this->endpoint().'?search=Rice&category=Dairy')->assertOk()->assertJsonCount(0, 'products');
        foreach (['per_page=25', 'page=0', 'search%5B%5D=x', 'search='.str_repeat('a', 101)] as $query) $this->getJson($this->endpoint().'?'.$query)->assertUnprocessable();
    }

    public function test_public_photo_is_narrowly_scoped_and_private_authenticated_route_stays_private(): void
    {
        Storage::fake('local');
        $this->publish(); $item = $this->item('Photo fixture');
        $path = 'product-photos/fixture.png';
        Storage::disk('local')->put($path, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1cAAAAASUVORK5CYII='));
        $item->product->update(['image_path' => $path]); $this->guest();
        $url = '/api/public/stores/'.$this->store->store_id.'/products/'.$item->product_id.'/photo';
        $this->get($url)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Content-Type', 'image/png');
        $this->getJson('/api/catalog/products/'.$item->product_id.'/photo')->assertUnauthorized();
        $this->getJson('/api/public/stores/'.$this->otherStore->store_id.'/products/'.$item->product_id.'/photo')->assertNotFound();
        $response = $this->getJson($this->endpoint().'?search=Photo')->assertOk();
        $this->assertStringNotContainsString('product-photos', $response->getContent());
        $item->soft_stock_qty = 20; $item->save(); $this->get($url)->assertNotFound();
        $item->soft_stock_qty = 0; $item->save(); $item->product->update(['image_path' => 'product-photos/../private.png']); $this->get($url)->assertNotFound();
    }

    public function test_guest_mutations_purchase_data_and_ai_remain_authenticated(): void
    {
        $this->publish(); $before = $this->businessState(); $this->guest();
        foreach (['/api/shopper/checkout/quote','/api/shopper/orders','/api/inventory/items','/api/shopper/stores/'.$this->store->store_id.'/ai-recommendations/ask'] as $url) $this->postJson($url, [])->assertUnauthorized();
        $this->getJson('/api/shopper/orders')->assertUnauthorized();
        $this->getJson('/api/shopper/stores/'.$this->store->store_id.'/products')->assertUnauthorized();
        $this->getJson('/api/shopper/stores/'.$this->store->store_id.'/ai-recommendations')->assertUnauthorized();
        $this->assertSame($before, $this->businessState());
    }

    public function test_public_reads_are_rate_limited(): void
    {
        $this->publish(); $this->guest();
        for ($i = 0; $i < 60; $i++) $this->getJson($this->endpoint().'?per_page=1')->assertOk();
        $this->getJson($this->endpoint().'?per_page=1')->assertStatus(429);
    }

    public function test_admin_address_edits_revoke_publication_even_after_reverting_to_the_old_address(): void
    {
        $this->publish();
        $this->signIn($this->admin)->putJson('/api/admin/stores/'.$this->store->store_id, ['store_name' => $this->store->store_name, 'address' => 'New pickup address'])->assertOk();
        $this->putJson('/api/admin/stores/'.$this->store->store_id, ['store_name' => $this->store->store_name, 'address' => 'A'])->assertOk();
        $this->getJson($this->endpoint())->assertNotFound();
        $this->getJson('/api/public/store-locations')->assertOk()->assertJsonCount(0, 'stores');
        $this->assertDatabaseHas('store_locations', ['store_id' => $this->store->store_id, 'verified_at' => null, 'verified_by_user_id' => null]);
        $this->assertDatabaseCount('store_location_audits', 2);
        $this->assertDatabaseHas('store_location_audits', ['actor_user_id' => $this->admin->id]);
    }

    private function businessState(): array
    {
        $result = [];
        foreach (['stores','products','store_inventory','orders','order_items','order_payments','stock_batches','stock_alerts','stock_alert_states','store_locations','store_location_audits'] as $table) $result[$table] = DB::table($table)->get()->toJson();
        return $result;
    }
}
