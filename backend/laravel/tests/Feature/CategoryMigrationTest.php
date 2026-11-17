<?php

namespace Tests\Feature;

use App\Models\Store;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CategoryMigrationTest extends TestCase
{
    public function test_backfill_deduplicates_only_within_store_and_retains_unresolved_legacy_values(): void
    {
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $new = '2026_11_17_000003_add_store_categories.php';
        $paths = array_map(fn ($p) => 'database/migrations/'.basename($p), array_filter(glob(database_path('migrations/*.php')), fn ($p) => basename($p) < $new));
        $this->artisan('migrate', ['--path' => array_values($paths), '--force' => true])->assertExitCode(0);
        $a = Store::create(['store_name' => 'A', 'address' => 'A']); $b = Store::create(['store_name' => 'B', 'address' => 'B']);
        $ids = [];
        foreach ([[$a->store_id, '  Fresh   Produce '], [$a->store_id, 'FRESH PRODUCE'], [$b->store_id, 'fresh produce'], [$a->store_id, '   '], [null, 'Unassigned legacy']] as $i => [$store, $name]) {
            $ids[] = DB::table('products')->insertGetId(['store_id' => $store, 'product_name' => 'Legacy '.$i, 'sku' => 'LEGACY-'.$i, 'category' => $name, 'created_at' => '2026-01-01', 'updated_at' => '2026-01-01']);
        }
        $before = DB::table('products')->orderBy('product_id')->get();
        DB::table('store_ai_recommendation_settings')->insert(['store_id' => $a->store_id, 'included_categories' => json_encode(['FRESH PRODUCE']), 'excluded_categories' => '[]']);
        $this->artisan('migrate', ['--path' => 'database/migrations/'.$new, '--force' => true])->assertExitCode(0);
        $products = DB::table('products')->orderBy('product_id')->get();
        $this->assertSame($products[0]->category_id, $products[1]->category_id);
        $this->assertNotSame($products[0]->category_id, $products[2]->category_id);
        $this->assertSame('Fresh Produce', $products[1]->category);
        $this->assertNull($products[3]->category_id); $this->assertNull($products[4]->category_id);
        $this->assertDatabaseCount('categories', 2); $this->assertDatabaseCount('category_mapping_issues', 2);
        $this->assertSame(['Fresh Produce'], json_decode(DB::table('store_ai_recommendation_settings')->value('included_categories'), true));
        foreach ($products as $i => $product) {
            $this->assertSame($before[$i]->category, $product->category_legacy);
            foreach (['product_id', 'sku', 'product_name', 'created_at', 'updated_at', 'store_id'] as $field) $this->assertSame($before[$i]->$field, $product->$field);
        }
        $this->artisan('inventory:category-mapping-status')->expectsOutputToContain('2 unresolved')->assertExitCode(0);
    }
}
