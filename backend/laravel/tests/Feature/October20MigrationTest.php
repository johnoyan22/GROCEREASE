<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class October20MigrationTest extends TransactionTestCase
{
    public function test_existing_cart_dashboard_and_cop_remain_available_before_new_migration_approval(): void
    {
        $accounts = require database_path('migrations/2026_10_20_000016_add_account_status.php');
        $payments = require database_path('migrations/2026_10_20_000015_create_payment_checkout_attempts.php');
        $accounts->down(); $payments->down();
        $this->signIn($this->shopper)->getJson('/api/user')->assertOk();
        $this->getJson('/api/dashboard/summary')->assertOk()->assertJsonPath('active_orders', 1);
        $this->postJson('/api/shopper/checkout/quote', $this->cart())->assertOk();
        $this->getJson('/api/shopper/stores/'.$this->store->store_id.'/payment-options')->assertOk()->assertJsonPath('digital.available', false);
        $this->signIn($this->admin)->getJson('/api/admin/accounts')->assertStatus(503);
    }

    public function test_additive_migrations_preserve_existing_business_columns_and_seed_nothing(): void
    {
        $payments = require database_path('migrations/2026_10_20_000015_create_payment_checkout_attempts.php');
        $accounts = require database_path('migrations/2026_10_20_000016_add_account_status.php');
        $accounts->down(); $payments->down();
        $tables = ['users', 'roles', 'stores', 'staff_store_assignments', 'products', 'store_inventory', 'orders', 'order_items'];
        $snapshots = [];
        foreach ($tables as $table) $snapshots[$table] = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
        $payments->up(); $accounts->up();
        foreach ($tables as $table) {
            $rows = DB::table($table)->get()->map(function ($row) use ($table) {
                $data = (array) $row;
                if ($table === 'users') { $this->assertSame('active', $data['account_status']); unset($data['account_status']); }
                return $data;
            })->all();
            $this->assertSame($snapshots[$table], $rows, $table.' original columns changed');
        }
        foreach (['payment_checkout_attempts', 'payment_webhook_events', 'account_status_logs'] as $table) $this->assertDatabaseCount($table, 0);
    }
}
