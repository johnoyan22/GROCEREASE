<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Role;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReceivingMigrationTest extends TestCase
{
    public function test_existing_identity_prices_counts_snapshots_and_unknown_dates_are_preserved(): void
    {
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $new = '2026_11_16_000001_add_product_receiving_and_batches.php';
        $paths = array_values(array_map(fn ($path) => 'database/migrations/'.basename($path), array_filter(glob(database_path('migrations/*.php')), fn ($path) => basename($path) < $new)));
        $this->artisan('migrate', ['--path' => $paths, '--force' => true])->assertExitCode(0);
        $this->seed(RoleSeeder::class);
        $shopper = User::factory()->create(['role_id' => Role::where('slug', 'shopper')->value('role_id')]);
        $store = Store::create(['store_name' => 'Historical store', 'address' => 'Historical address']);
        $product = \Tests\Support\CategoryFixture::product(['store_id' => $store->store_id, 'product_name' => 'Legacy', 'sku' => 'PRESERVED-001', 'size' => '1 1/2 litres?', 'category' => 'Legacy']);
        $inventory = StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id, 'selling_price' => '45.50', 'hard_stock_qty' => 17, 'soft_stock_qty' => 3, 'status' => 'active']);
        $order = Order::create(['store_id' => $store->store_id, 'shopper_user_id' => $shopper->id, 'store_name' => 'Historical name', 'store_address' => 'Old address', 'shopper_name' => 'Historical shopper',
            'subtotal_centavos' => 13650, 'total_centavos' => 13650, 'service_fee_policy' => 'historical', 'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('a', 64)]);
        $line = OrderItem::create(['order_id' => $order->order_id, 'store_id' => $store->store_id, 'store_inventory_id' => $inventory->store_inventory_id,
            'product_name' => 'Old product name', 'sku' => 'OLD-SNAPSHOT', 'size' => 'Old size', 'quantity' => 3, 'unit_price_centavos' => 4550, 'line_total_centavos' => 13650]);
        $before = [$product->fresh()->getAttributes(), $inventory->fresh()->getAttributes(), $order->fresh()->getAttributes(), $line->fresh()->getAttributes()];
        $this->artisan('migrate', ['--path' => 'database/migrations/'.$new, '--force' => true])->assertExitCode(0);
        foreach ([Product::find($product->product_id), StoreInventory::find($inventory->store_inventory_id), $order->fresh(), $line->fresh()] as $index => $model) {
            foreach ($before[$index] as $key => $value) $this->assertSame($value, $model->getRawOriginal($key), $key.' was preserved');
        }
        $this->assertNull($product->fresh()->size_amount);
        $this->assertNull($product->fresh()->selling_unit);
        $this->assertDatabaseHas('inventory_batches', ['store_inventory_id' => $inventory->store_inventory_id, 'quantity_received' => 17, 'remaining_quantity' => 17,
            'received_date' => null, 'expiry_date' => null, 'source' => 'historical']);
        $this->assertDatabaseHas('order_batch_allocations', ['order_item_id' => $line->order_item_id, 'quantity' => 3, 'status' => 'reserved']);
        $this->assertSame(14, $inventory->fresh()->availableStock());
    }
}
