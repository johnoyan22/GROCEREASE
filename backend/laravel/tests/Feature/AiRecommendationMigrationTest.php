<?php

namespace Tests\Feature;

use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\TransactionTestCase;

class AiRecommendationMigrationTest extends TransactionTestCase
{
    public function test_exact_ai_migration_preserves_all_existing_rows_and_columns_in_both_directions(): void
    {
        $credential = $this->ready();
        $this->cash();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
        // Preserve a genuine completed payment/handover and a separate genuine COP strike.
        $this->orderId = $this->placeOrder();
        $this->ready();
        $this->travelTo(Order::findOrFail($this->orderId)->claim_expires_at->addSecond());
        $this->artisan('orders:process-deadlines')->assertExitCode(0);
        $this->assertDatabaseCount('cop_strikes', 1);
        $migration = require database_path('migrations/2026_11_09_000017_create_store_ai_recommendation_settings.php');
        $migration->down();
        $snapshots = [];
        foreach (Schema::getTableListing() as $table) {
            if ($table === 'sqlite_sequence') {
                continue;
            }
            $snapshots[$table] = ['columns' => Schema::getColumns($table), 'rows' => DB::table($table)->get()->map(fn ($r) => (array) $r)->all()];
        }
        $migration->up();
        $this->assertDatabaseCount('store_ai_recommendation_settings', 0);
        $this->assertDatabaseCount('ai_recommendation_setting_audits', 0);
        foreach ($snapshots as $table => $snapshot) {
            $this->assertSame($snapshot['columns'], Schema::getColumns($table), $table.' columns changed');
            $this->assertSame($snapshot['rows'], DB::table($table)->get()->map(fn ($r) => (array) $r)->all(), $table.' rows changed');
        }
        $migration->down();
        foreach ($snapshots as $table => $snapshot) {
            $this->assertSame($snapshot['rows'], DB::table($table)->get()->map(fn ($r) => (array) $r)->all(), $table.' rows changed on rollback');
        }
    }

    public function test_ai_migration_does_not_depend_on_pending_000015_or_000016(): void
    {
        $migration = require database_path('migrations/2026_11_09_000017_create_store_ai_recommendation_settings.php');
        $migration->down();
        (require database_path('migrations/2026_10_20_000016_add_account_status.php'))->down();
        (require database_path('migrations/2026_10_20_000015_create_payment_checkout_attempts.php'))->down();
        $before = DB::table('store_inventory')->get()->toJson();
        $migration->up();
        $this->assertFalse(Schema::hasColumn('users', 'account_status'));
        $this->assertFalse(Schema::hasTable('payment_checkout_attempts'));
        $this->assertSame($before, DB::table('store_inventory')->get()->toJson());
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart())->assertOk();
    }
}
