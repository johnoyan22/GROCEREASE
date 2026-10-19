<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Store;
use App\Models\StoreInventory;
use Database\Seeders\LocalStoreInventorySeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class StoreInventoryFoundationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertSame(':memory:', DB::connection('sqlite')->getDatabaseName());
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('mail.default'));
        $this->assertSame(1, (int) DB::selectOne('PRAGMA foreign_keys')->foreign_keys);

        $this->artisan('migrate', [
            '--database' => 'sqlite',
            '--force' => true,
        ])->assertExitCode(0);
    }

    private function store(string $name): Store
    {
        return Store::create([
            'store_name' => $name,
            'address' => $name.' address',
        ]);
    }

    private function product(Store $store): Product
    {
        return Product::create([
            'store_id' => $store->store_id,
            'product_name' => 'Test Rice',
            'sku' => 'TEST-RICE-1KG',
            'size' => '1 kg',
            'category' => 'Staples',
        ]);
    }

    private function offering(Store $store, ?Product $product = null): StoreInventory
    {
        return StoreInventory::create([
            'store_id' => $store->store_id,
            'product_id' => ($product ?? $this->product($store))->product_id,
            'selling_price' => '65.50',
        ]);
    }

    public static function invalidNumbers(): array
    {
        return [
            'negative price' => ['selling_price', '-0.01'],
            'negative hard stock' => ['hard_stock_qty', -1],
            'negative soft stock' => ['soft_stock_qty', -1],
        ];
    }

    public static function referenceFields(): array
    {
        return [['store_id'], ['product_id']];
    }

    public function test_stores_own_independent_products_and_inventory(): void
    {
        $first = $this->store('A');
        $second = $this->store('B');
        $product = $this->product($first);
        $a = $this->offering($first, $product);
        $b = $this->offering($second);

        $a->update([
            'selling_price' => '72.25',
            'hard_stock_qty' => 12,
            'soft_stock_qty' => 2,
            'status' => StoreInventory::STATUS_ACTIVE,
        ]);

        $this->assertNotSame($a->store_inventory_id, $b->store_inventory_id);
        $this->assertSame('72.25', $a->fresh()->selling_price);
        $this->assertSame(12, $a->fresh()->hard_stock_qty);
        $this->assertSame(2, $a->fresh()->soft_stock_qty);
        $this->assertSame('65.50', $b->fresh()->selling_price);
        $this->assertSame(0, $b->fresh()->hard_stock_qty);
        $this->assertSame(0, $b->fresh()->soft_stock_qty);
        $this->assertSame(StoreInventory::STATUS_INACTIVE, $b->fresh()->status);
        $this->assertTrue($a->store->is($first));
        $this->assertTrue($a->product->is($product));
        $this->assertSame(1, $product->storeInventories()->count());
        $this->assertNotSame($a->product_id, $b->product_id);
        $this->assertSame($a->product->sku, $b->product->sku);
        $this->assertSame(1, $first->storeInventories()->count());
        $this->assertDatabaseCount('products', 2);
        $this->assertDatabaseCount('store_inventory', 2);
    }

    public function test_store_scope_excludes_other_stores_and_blocks_scoped_updates(): void
    {
        $first = $this->store('A');
        $second = $this->store('B');
        $product = $this->product($first);
        $a = $this->offering($first, $product);
        $b = $this->offering($second);

        $this->assertSame(
            [$a->store_inventory_id],
            StoreInventory::forStore($first->store_id)
                ->pluck('store_inventory_id')->all()
        );

        $changed = StoreInventory::forStore($first->store_id)
            ->whereKey($b->store_inventory_id)
            ->update(['selling_price' => '1.00']);

        $this->assertSame(0, $changed);
        $this->assertSame('65.50', $b->fresh()->selling_price);
    }

    public function test_database_defaults_are_zero_and_inactive(): void
    {
        $store = $this->store('A');
        $product = $this->product($store);

        $id = DB::table('store_inventory')->insertGetId([
            'store_id' => $store->store_id,
            'product_id' => $product->product_id,
            'selling_price' => '0.00',
        ], 'store_inventory_id');

        $saved = StoreInventory::findOrFail($id);
        $this->assertSame(0, $saved->hard_stock_qty);
        $this->assertSame(0, $saved->soft_stock_qty);
        $this->assertSame('0.00', $saved->selling_price);
        $this->assertSame(StoreInventory::STATUS_INACTIVE, $saved->status);
    }

    public function test_database_rejects_duplicate_store_product_pairs(): void
    {
        $store = $this->store('A');
        $product = $this->product($store);
        $this->offering($store, $product);
        $this->expectException(QueryException::class);

        DB::table('store_inventory')->insert([
            'store_id' => $store->store_id,
            'product_id' => $product->product_id,
            'selling_price' => '99.00',
        ]);
    }

    #[DataProvider('referenceFields')]
    public function test_database_rejects_unknown_references(string $field): void
    {
        $store = $this->store('A');
        $product = $this->product($store);
        $values = [
            'store_id' => $store->store_id,
            'product_id' => $product->product_id,
            'selling_price' => '1.00',
        ];
        $values[$field] = 999999;

        $this->expectException(QueryException::class);
        DB::table('store_inventory')->insert($values);
    }

    #[DataProvider('invalidNumbers')]
    public function test_database_rejects_negative_inserts(string $field, string|int $value): void
    {
        $store = $this->store('A');
        $product = $this->product($store);
        $values = [
            'store_id' => $store->store_id,
            'product_id' => $product->product_id,
            'selling_price' => '1.00',
        ];
        $values[$field] = $value;

        $this->expectException(QueryException::class);
        DB::table('store_inventory')->insert($values);
    }

    #[DataProvider('invalidNumbers')]
    public function test_database_rejects_negative_updates(string $field, string|int $value): void
    {
        $row = $this->offering($this->store('A'));

        $this->expectException(QueryException::class);
        DB::table('store_inventory')
            ->where('store_inventory_id', $row->store_inventory_id)
            ->update([$field => $value]);
    }

    public function test_database_rejects_unknown_status(): void
    {
        $row = $this->offering($this->store('A'));

        $this->expectException(QueryException::class);
        DB::table('store_inventory')
            ->where('store_inventory_id', $row->store_inventory_id)
            ->update(['status' => 'unknown']);
    }

    #[DataProvider('referenceFields')]
    public function test_referenced_store_or_product_cannot_be_deleted(string $field): void
    {
        $store = $this->store('A');
        $product = $this->product($store);
        $this->offering($store, $product);
        $this->expectException(QueryException::class);

        if ($field === 'store_id') {
            $store->delete();
        } else {
            $product->delete();
        }
    }

    public function test_store_deactivation_preserves_inventory(): void
    {
        $store = $this->store('A');
        $product = $this->product($store);
        $row = $this->offering($store, $product);

        $store->update(['status' => Store::STATUS_INACTIVE]);

        $this->assertDatabaseCount('store_inventory', 1);
        $this->assertDatabaseCount('products', 1);
        $this->assertTrue($row->fresh()->product->is($product));
        $this->assertSame(Store::STATUS_INACTIVE, $row->fresh()->store->status);
    }

    public function test_local_seeder_preserves_existing_offering_edits(): void
    {
        $this->app->instance('env', 'local');

        try {
            $this->seed(LocalStoreInventorySeeder::class);
            $row = StoreInventory::orderBy('store_inventory_id')->firstOrFail();
            $row->update(['selling_price' => '99.99']);

            $this->seed(LocalStoreInventorySeeder::class);

            $this->assertDatabaseCount('store_inventory', 3);
            $this->assertDatabaseCount('products', 3);
            $this->assertDatabaseCount('stores', 2);
            $this->assertSame('99.99', $row->fresh()->selling_price);
        } finally {
            $this->app->instance('env', 'testing');
        }
    }

    public function test_demo_seeder_refuses_a_non_local_environment(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage(
            'LocalStoreInventorySeeder may only run when APP_ENV=local.'
        );

        $this->seed(LocalStoreInventorySeeder::class);
    }

    public function test_database_rejects_a_product_owned_by_another_store(): void
    {
        $first = $this->store('A');
        $second = $this->store('B');
        $product = $this->product($first);
        $this->expectException(QueryException::class);

        DB::table('store_inventory')->insert([
            'store_id' => $second->store_id,
            'product_id' => $product->product_id,
            'selling_price' => '1.00',
        ]);
    }
}
