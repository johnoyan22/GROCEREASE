<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Store;
use Database\Seeders\LocalProductSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class ProductFoundationTest extends TestCase
{
    private Store $store;
    protected function setUp(): void
    {
        parent::setUp();

        // Stop before migrations unless this is the isolated test database.
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertSame(':memory:', DB::connection('sqlite')->getDatabaseName());
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('mail.default'));

        $this->artisan('migrate', [
            '--database' => 'sqlite',
            '--force' => true,
        ])->assertExitCode(0);

        $this->store = Store::create(['store_name' => 'Test Store', 'address' => 'Test address']);
    }

    private function product(array $overrides = []): Product
    {
        return Product::create(array_replace([
            'store_id' => $this->store->store_id,
            'product_name' => 'Test Jasmine Rice',
            'sku' => 'TEST-RICE-1KG',
            'barcode' => '0001234567890',
            'size' => '1 kg',
            'category' => 'Staples',
        ], $overrides));
    }

    public function test_product_persists_with_custom_key_and_text_barcode(): void
    {
        $product = $this->product(['sku' => '  test-rice-1kg  ']);
        $saved = Product::findOrFail($product->product_id);

        $this->assertSame('product_id', $saved->getKeyName());
        $this->assertNotNull($saved->getKey());
        $this->assertSame($product->product_id, $saved->product_id);
        $this->assertSame('Test Jasmine Rice', $saved->product_name);
        $this->assertSame('TEST-RICE-1KG', $saved->sku);
        $this->assertSame('0001234567890', $saved->barcode);
        $this->assertSame('1 kg', $saved->size);
        $this->assertSame('Staples', $saved->category);
        $this->assertNotNull($saved->created_at);
        $this->assertNotNull($saved->updated_at);
    }

    public function test_same_named_size_variants_have_distinct_identities(): void
    {
        $small = $this->product();
        $large = $this->product([
            'sku' => 'TEST-RICE-5KG',
            'barcode' => '0001234567891',
            'size' => '5 kg',
        ]);

        $this->assertNotSame($small->product_id, $large->product_id);
        $this->assertSame($small->product_name, $large->product_name);
        $this->assertSame('1 kg', $small->fresh()->size);
        $this->assertSame('5 kg', $large->fresh()->size);
        $this->assertDatabaseCount('products', 2);
    }

    public function test_barcode_and_size_are_optional(): void
    {
        $first = $this->product(['barcode' => null, 'size' => null]);
        $second = $this->product([
            'sku' => 'TEST-OTHER-ITEM',
            'barcode' => null,
            'size' => null,
        ]);

        $this->assertNull($first->fresh()->barcode);
        $this->assertNull($first->fresh()->size);
        $this->assertNull($second->fresh()->barcode);
        $this->assertNull($second->fresh()->size);
        $this->assertDatabaseCount('products', 2);
    }

    public function test_database_rejects_duplicate_skus_without_using_the_model(): void
    {
        $this->product();
        $this->expectException(QueryException::class);

        DB::table('products')->insert([
            'store_id' => $this->store->store_id,
            'product_name' => 'Different Name',
            'sku' => 'TEST-RICE-1KG',
            'category' => 'Staples',
        ]);
    }

    public function test_sku_case_and_surrounding_spaces_cannot_bypass_uniqueness(): void
    {
        $this->product();
        $this->expectException(QueryException::class);

        $this->product([
            'product_name' => 'Duplicate Identity',
            'sku' => '  test-rice-1kg  ',
        ]);
    }

    public function test_local_seeder_can_repeat_without_overwriting_edits(): void
    {
        // Database/cache/session/mail remain isolated; only the seeder guard
        // sees "local" during this test.
        $this->app->instance('env', 'local');

        try {
            $this->seed(LocalProductSeeder::class);

            $rice = Product::where('sku', 'GE-DEMO-RICE-1KG')->firstOrFail();
            $productId = $rice->product_id;
            $rice->update(['product_name' => 'Locally Edited Demo Rice']);

            $this->seed(LocalProductSeeder::class);

            $this->assertDatabaseCount('products', 3);
            $saved = Product::where('sku', 'GE-DEMO-RICE-1KG')->firstOrFail();
            $this->assertSame($productId, $saved->product_id);
            $this->assertSame('Locally Edited Demo Rice', $saved->product_name);
            $this->assertDatabaseHas('products', [
                'sku' => 'GE-DEMO-WATER-1L',
                'size' => '1 L',
            ]);
        } finally {
            $this->app->instance('env', 'testing');
        }
    }

    public function test_demo_seeder_refuses_a_non_local_environment(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage(
            'LocalProductSeeder may only run when APP_ENV=local.'
        );

        $this->seed(LocalProductSeeder::class);
    }

    public function test_different_stores_can_use_the_same_sku_independently(): void
    {
        $first = $this->product();
        $other = Store::create(['store_name' => 'Other Store', 'address' => 'Other address']);
        $second = $this->product(['store_id' => $other->store_id]);
        $this->assertNotSame($first->product_id, $second->product_id);
        $this->assertSame($first->sku, $second->sku);
        $this->assertSame(1, Product::forStore($this->store->store_id)->count());
        $this->assertSame(1, $other->products()->count());
    }
}
