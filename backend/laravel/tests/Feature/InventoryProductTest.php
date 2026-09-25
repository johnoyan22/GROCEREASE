<?php

namespace Tests\Feature;

use App\Models\AssignedInventoryWorker;
use App\Models\GrocerUser;
use App\Models\Product;
use App\Models\Store;
use App\Models\StoreInventory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryProductTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_read_inventory_products(): void
    {
        $this->getJson('/api/inventory/products')
            ->assertUnauthorized();
    }

    public function test_shopper_cannot_read_inventory_products(): void
    {
        $this->seed();

        $shopper = GrocerUser::query()->firstOrFail();
        $token = $shopper->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/inventory/products')
            ->assertForbidden();
    }

    public function test_assigned_inventory_worker_can_read_only_their_store_products(): void
    {
        $this->seed();

        $inventoryWorker = AssignedInventoryWorker::query()->firstOrFail();
        $assignedStore = $inventoryWorker->store;

        $otherStore = Store::query()->create([
            'admin_id' => $assignedStore->admin_id,
            'owner_id' => $assignedStore->owner_id,
            'store_name' => 'Other Store',
            'address' => 'Other Address',
        ]);

        $otherProduct = Product::query()->create([
            'product_name' => 'Product From Another Store',
            'category' => 'Other',
            'base_cost' => 10,
        ]);

        StoreInventory::query()->create([
            'store_id' => $otherStore->store_id,
            'product_id' => $otherProduct->product_id,
            'selling_price' => 15,
            'soft_stock_qty' => 0,
            'hard_stock_qty' => 5,
        ]);

        $token = $inventoryWorker->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/inventory/products')
            ->assertOk()
            ->assertJsonPath('store.store_id', $inventoryWorker->store_id)
            ->assertJsonCount(1, 'products')
            ->assertJsonPath('products.0.product_name', 'Premium Jasmine Rice')
            ->assertJsonPath('products.0.category', 'Staples')
            ->assertJsonPath('products.0.selling_price', 285)
            ->assertJsonPath('products.0.hard_stock_qty', 120)
            ->assertJsonPath('products.0.availability', 'Available')
            ->assertJsonMissing([
                'product_name' => 'Product From Another Store',
            ]);
    }
}
