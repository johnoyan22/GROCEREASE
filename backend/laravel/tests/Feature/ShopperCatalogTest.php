<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Role;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ShopperCatalogTest extends TestCase
{
    private Store $first;
    private Store $second;
    private StoreInventory $rice;
    private User $shopper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('mail.default'));
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
        $this->seed(RoleSeeder::class);
        $this->first = Store::create(['store_name' => 'Store A', 'address' => 'A address']);
        $this->second = Store::create(['store_name' => 'Store B', 'address' => 'B address']);
        $this->rice = $this->inventory($this->first, 'Store A Rice');
        $this->inventory($this->second, 'Store B Rice');
        $this->shopper = $this->account('shopper');
    }

    private function account(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('slug', $role)->firstOrFail()->role_id]);
    }

    private function inventory(Store $store, string $name): StoreInventory
    {
        $product = Product::create(['store_id' => $store->store_id, 'product_name' => $name, 'sku' => 'RICE', 'category' => 'Staples']);
        $inventory = StoreInventory::create([
            'store_id' => $store->store_id, 'product_id' => $product->product_id,
            'selling_price' => '67.25', 'hard_stock_qty' => 100, 'soft_stock_qty' => 15, 'status' => 'active',
        ]);
        $inventory->max_per_order = 4;
        $inventory->low_stock_threshold = 85;
        $inventory->save();
        return $inventory;
    }

    private function signIn(User $user): static
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'web');
    }

    public function test_shopper_sees_active_stores_with_distinct_branch_ids(): void
    {
        $inactive = Store::create(['store_name' => 'Hidden Store', 'address' => 'Hidden', 'status' => 'inactive']);
        $this->signIn($this->shopper)->getJson('/api/shopper/stores')->assertOk()->assertJsonCount(2, 'stores')
            ->assertJsonPath('stores.0.store_id', $this->first->store_id)
            ->assertJsonMissing(['store_id' => $inactive->store_id]);
    }

    public function test_selected_store_products_use_real_prices_available_stock_and_limits(): void
    {
        $before = $this->rice->fresh()->getAttributes();
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->first->store_id.'/products')->assertOk()
            ->assertJsonCount(1, 'products')->assertJsonPath('products.0.product_name', 'Store A Rice')
            ->assertJsonPath('products.0.selling_price', '67.25')
            ->assertJsonPath('products.0.available_stock', 85)->assertJsonPath('products.0.max_per_order', 4)
            ->assertJsonPath('products.0.is_low_stock', true)->assertJsonMissing(['product_name' => 'Store B Rice'])
            ->assertJsonMissingPath('products.0.hard_stock_qty')->assertJsonMissingPath('products.0.soft_stock_qty');
        $this->getJson('/api/shopper/stores/'.$this->second->store_id.'/products')->assertOk()
            ->assertJsonPath('products.0.product_name', 'Store B Rice')->assertJsonMissing(['product_name' => 'Store A Rice']);
        $this->assertSame($before, $this->rice->fresh()->getAttributes());
    }

    public function test_inactive_products_are_hidden_and_zero_available_stock_is_explicit(): void
    {
        $this->rice->update(['status' => 'inactive']);
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->first->store_id.'/products')
            ->assertOk()->assertJsonCount(0, 'products');
        $this->rice->update(['status' => 'active', 'soft_stock_qty' => 100]);
        $this->getJson('/api/shopper/stores/'.$this->first->store_id.'/products')->assertOk()
            ->assertJsonPath('products.0.available_stock', 0);
    }

    public function test_inactive_and_unknown_stores_are_not_found(): void
    {
        $this->first->update(['status' => 'inactive']);
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->first->store_id.'/products')->assertNotFound();
        $this->getJson('/api/shopper/stores/999999/products')->assertNotFound();
    }

    public function test_guests_unverified_shoppers_and_staff_cannot_use_shopper_catalog(): void
    {
        $paths = ['/api/shopper/stores', '/api/shopper/stores/'.$this->first->store_id.'/products'];
        foreach ($paths as $path) $this->getJson($path)->assertUnauthorized();
        $unverified = User::factory()->unverified()->create(['role_id' => $this->shopper->role_id]);
        foreach (['inventory_worker', 'supervisor', 'admin'] as $role) {
            $this->signIn($this->account($role));
            foreach ($paths as $path) $this->getJson($path)->assertForbidden();
        }
        $this->signIn($unverified);
        foreach ($paths as $path) $this->getJson($path)->assertForbidden();
    }
}
