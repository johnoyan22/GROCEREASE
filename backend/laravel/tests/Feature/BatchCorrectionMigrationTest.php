<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Role;
use App\Models\StockAdjustment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BatchCorrectionMigrationTest extends TestCase
{
    public function test_additive_schema_preserves_legacy_requests_batches_receipts_and_logs(): void
    {
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $migration = '2026_11_17_000001_add_batch_count_corrections.php';
        $paths = array_values(array_map(fn ($p) => 'database/migrations/'.basename($p),
            array_filter(glob(database_path('migrations/*.php')), fn ($p) => basename($p) < $migration)));
        $this->artisan('migrate', ['--path' => $paths, '--force' => true])->assertExitCode(0);
        $this->seed(\Database\Seeders\RoleSeeder::class);
        $worker = User::factory()->create(['role_id' => Role::where('slug', 'inventory_worker')->value('role_id')]);
        $store = Store::create(['store_name' => 'Legacy QA', 'address' => 'QA']);
        $product = \Tests\Support\CategoryFixture::product(['store_id' => $store->store_id, 'product_name' => 'Legacy rice', 'sku' => 'LEGACY-KEPT', 'category' => 'Staples']);
        $inventory = StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id,
            'selling_price' => '10.00', 'hard_stock_qty' => 100, 'status' => 'active']);
        app(\App\Services\BatchStock::class)->initialize($inventory);
        foreach (['approved', 'pending'] as $status) {
            $record = StockAdjustment::create(['store_id' => $store->store_id, 'store_inventory_id' => $inventory->store_inventory_id,
                'requested_by_user_id' => $worker->id, 'observed_hard_stock_qty' => 110, 'observed_soft_stock_qty' => 0,
                'observed_stock_version' => 0, 'requested_hard_stock_qty' => 100, 'reason' => 'Original whole-product count', 'status' => $status]);
            if ($status === 'approved') DB::table('batch_correction_logs')->insert(['stock_adjustment_id' => $record->id,
                'inventory_batch_id' => $inventory->batches()->value('id'), 'quantity_change' => -10, 'created_at' => now(), 'updated_at' => now()]);
        }
        $tables = ['stock_adjustments', 'inventory_batches', 'stock_receipts', 'batch_correction_logs', 'store_inventory', 'products'];
        $before = [];
        foreach ($tables as $table) $before[$table] = DB::table($table)->get()->map(fn ($r) => (array) $r)->all();
        $this->artisan('migrate', ['--path' => 'database/migrations/'.$migration, '--force' => true])->assertExitCode(0);
        foreach ($tables as $table) {
            $after = DB::table($table)->get()->map(fn ($r) => (array) $r)->all();
            $this->assertCount(count($before[$table]), $after);
            foreach ($before[$table] as $i => $row) foreach ($row as $key => $value) $this->assertSame($value, $after[$i][$key], $table.'.'.$key);
        }
        foreach (StockAdjustment::all() as $record) {
            $this->assertNull($record->inventory_batch_id);
            $this->assertNull($record->batch_snapshot);
            $this->assertNull($record->pending_batch_id);
            $this->assertNull($record->requested_remaining_quantity);
        }
    }
}
