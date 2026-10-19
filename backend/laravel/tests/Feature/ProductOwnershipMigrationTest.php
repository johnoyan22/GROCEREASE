<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductOwnershipMigrationTest extends TestCase
{
    public function test_conversion_preserves_existing_inventory_and_separates_legacy_shared_products(): void
    {
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertSame(':memory:', DB::connection('sqlite')->getDatabaseName());
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('mail.default'));
        $this->assertSame(1, (int) DB::selectOne('PRAGMA foreign_keys')->foreign_keys);

        $target = '2026_10_19_000006_scope_products_to_stores.php';
        $historical = array_values(array_filter(
            glob(database_path('migrations/*.php')),
            fn ($path) => strcmp(basename($path), $target) < 0
        ));
        $this->artisan('migrate', [
            '--database' => 'sqlite', '--path' => $historical,
            '--realpath' => true, '--force' => true,
        ])->assertExitCode(0);

        $first = DB::table('stores')->insertGetId([
            'store_name' => 'Legacy A', 'address' => 'A', 'status' => 'active',
        ], 'store_id');
        $second = DB::table('stores')->insertGetId([
            'store_name' => 'Legacy B', 'address' => 'B', 'status' => 'active',
        ], 'store_id');
        $product = DB::table('products')->insertGetId([
            'product_name' => 'Legacy Rice', 'sku' => 'LEGACY-RICE', 'barcode' => '000123',
            'size' => '1 kg', 'category' => 'Staples',
        ], 'product_id');
        $orphan = DB::table('products')->insertGetId([
            'product_name' => 'Unassigned Legacy', 'sku' => 'LEGACY-UNASSIGNED', 'category' => 'Other',
        ], 'product_id');
        $timestamp = '2026-10-18 10:00:00';
        $a = DB::table('store_inventory')->insertGetId([
            'store_id' => $first, 'product_id' => $product, 'selling_price' => '67.00',
            'hard_stock_qty' => 12, 'soft_stock_qty' => 2, 'status' => 'active',
            'created_at' => $timestamp, 'updated_at' => $timestamp,
        ], 'store_inventory_id');
        $b = DB::table('store_inventory')->insertGetId([
            'store_id' => $second, 'product_id' => $product, 'selling_price' => '70.00',
            'hard_stock_qty' => 4, 'soft_stock_qty' => 1, 'status' => 'inactive',
            'created_at' => $timestamp, 'updated_at' => $timestamp,
        ], 'store_inventory_id');

        $this->artisan('migrate', [
            '--database' => 'sqlite', '--path' => [database_path('migrations/'.$target)],
            '--realpath' => true, '--force' => true,
        ])->assertExitCode(0);

        $firstRow = DB::table('store_inventory')->where('store_inventory_id', $a)->first();
        $secondRow = DB::table('store_inventory')->where('store_inventory_id', $b)->first();
        $this->assertSame($product, (int) $firstRow->product_id);
        $this->assertNotSame((int) $firstRow->product_id, (int) $secondRow->product_id);
        $this->assertSame(67.0, (float) $firstRow->selling_price);
        $this->assertSame(70.0, (float) $secondRow->selling_price);
        $this->assertSame(12, (int) $firstRow->hard_stock_qty);
        $this->assertSame(2, (int) $firstRow->soft_stock_qty);
        $this->assertSame(4, (int) $secondRow->hard_stock_qty);
        $this->assertSame(1, (int) $secondRow->soft_stock_qty);
        $this->assertSame('active', $firstRow->status);
        $this->assertSame('inactive', $secondRow->status);
        $this->assertSame($timestamp, $firstRow->created_at);
        $this->assertSame($timestamp, $secondRow->updated_at);
        $this->assertSame(1, Product::forStore($first)->count());
        $this->assertSame(1, Product::forStore($second)->count());
        $this->assertDatabaseHas('products', ['product_id' => $orphan, 'store_id' => null]);
        $this->assertDatabaseCount('products', 3);
        $this->assertSame([], DB::select('PRAGMA foreign_key_check'));
        $this->assertSame(1, (int) DB::selectOne('PRAGMA foreign_keys')->foreign_keys);
    }
}
