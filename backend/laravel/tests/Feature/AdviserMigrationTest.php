<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\TransactionTestCase;

class AdviserMigrationTest extends TransactionTestCase
{
    public function test_additive_migrations_preserve_every_original_column_and_business_record(): void
    {
        $stock = require database_path('migrations/2026_11_13_000019_add_stock_receiving_and_alerts.php');
        $catalog = require database_path('migrations/2026_11_13_000018_add_catalog_management.php');
        $stock->down(); $catalog->down();
        $snapshots = [];
        foreach (Schema::getTableListing() as $table) {
            if ($table === 'sqlite_sequence') continue;
            $columns = Schema::getColumnListing($table);
            $snapshots[$table] = ['columns' => $columns, 'rows' => DB::table($table)->get($columns)->map(fn ($r) => (array) $r)->all()];
        }
        $catalog->up(); $stock->up();
        foreach ($snapshots as $table => $snapshot) {
            $this->assertSame($snapshot['rows'], DB::table($table)->get($snapshot['columns'])->map(fn ($r) => (array) $r)->all(), $table.' original values changed');
        }
        $this->assertDatabaseCount('stock_batches', 0);
        $this->assertDatabaseCount('stock_receiving_requests', 0);
        $this->assertDatabaseCount('product_price_changes', 0);
        $this->assertDatabaseCount('stock_alerts', 0);
        $this->assertDatabaseCount('store_categories', 1);
        $this->assertNotNull($this->inventory->product->fresh()->category_id);
        $this->assertSame([], DB::select('PRAGMA foreign_key_check'));
    }
}
