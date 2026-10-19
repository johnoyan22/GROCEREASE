<?php

namespace Tests\Feature;

use App\Models\InventoryAvailabilityLog;
use App\Models\LowStockReport;
use App\Models\Product;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class StockReportingTest extends TestCase
{
    private User $admin;
    private User $worker;
    private User $supervisor;
    private User $otherWorker;
    private User $otherSupervisor;
    private Store $first;
    private Store $second;
    private StoreInventory $own;
    private StoreInventory $foreign;

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
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->first = Store::create(['store_name' => 'Store A', 'address' => 'A address']);
        $this->second = Store::create(['store_name' => 'Store B', 'address' => 'B address']);
        $this->worker = $this->account('inventory_worker', $this->first);
        $this->supervisor = $this->account('supervisor', $this->first);
        $this->otherWorker = $this->account('inventory_worker', $this->second);
        $this->otherSupervisor = $this->account('supervisor', $this->second);
        $this->own = $this->inventory($this->first);
        $this->foreign = $this->inventory($this->second);
    }

    private function account(string $role, ?Store $store = null): User
    {
        $user = User::factory()->unverified()->create([
            'role_id' => Role::where('slug', $role)->firstOrFail()->role_id,
        ]);
        if (in_array($role, User::STAFF_ROLES, true)) {
            $user->forceFill([
                'staff_approved_at' => now(), 'staff_approved_by_user_id' => $this->admin->id,
            ])->save();
        }
        if ($store) {
            StaffStoreAssignment::create([
                'user_id' => $user->id, 'store_id' => $store->store_id,
                'assigned_by_user_id' => $this->admin->id,
            ]);
        }
        return $user;
    }

    private function inventory(Store $store): StoreInventory
    {
        $product = Product::create([
            'store_id' => $store->store_id, 'product_name' => $store->store_name.' Rice',
            'sku' => 'RICE', 'category' => 'Staples',
        ]);
        return StoreInventory::create([
            'store_id' => $store->store_id, 'product_id' => $product->product_id,
            'selling_price' => '50.00', 'hard_stock_qty' => 8, 'soft_stock_qty' => 3,
            'status' => 'active',
        ]);
    }

    private function signIn(User $user): static
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'web');
    }

    private function reportPath(?StoreInventory $inventory = null): string
    {
        $inventory = $inventory ?? $this->own;
        return '/api/inventory/items/'.$inventory->store_inventory_id.'/low-stock-reports';
    }

    private function productPayload(): array
    {
        return [
            'product_name' => 'New product', 'sku' => 'NEW', 'category' => 'Staples',
            'selling_price' => '60.00', 'status' => 'inactive',
        ];
    }

    public function test_report_captures_actor_and_quantity_snapshot_without_changing_inventory(): void
    {
        $before = $this->own->fresh()->getAttributes();
        $id = $this->signIn($this->worker)->postJson($this->reportPath(), [
            'note' => 'Only a few rice packs remain on the shelf.',
        ])->assertCreated()
            ->assertJsonPath('report.store_id', $this->first->store_id)
            ->assertJsonPath('report.reported_by_user_id', $this->worker->id)
            ->assertJsonPath('report.observed_hard_stock_qty', 8)
            ->assertJsonPath('report.observed_soft_stock_qty', 3)->json('report.id');
        $this->assertSame($before, $this->own->fresh()->getAttributes());
        $this->getJson('/api/inventory/low-stock-reports')->assertOk()
            ->assertJsonCount(1, 'reports')->assertJsonPath('reports.0.id', $id);
        $this->own->update(['hard_stock_qty' => 5]);
        $this->assertSame(8, LowStockReport::findOrFail($id)->observed_hard_stock_qty);
        $this->assertDatabaseCount('inventory_availability_logs', 0);
    }

    public function test_both_roles_read_only_their_own_store_reports_and_availability_history(): void
    {
        $this->signIn($this->worker)->postJson($this->reportPath(), ['note' => 'A private note'])->assertCreated();
        $this->putJson('/api/inventory/items/'.$this->own->store_inventory_id, [
            'selling_price' => '50.00', 'status' => 'inactive',
        ])->assertOk();
        $this->signIn($this->otherWorker)->postJson($this->reportPath($this->foreign), ['note' => 'B private note'])->assertCreated();
        $this->putJson('/api/inventory/items/'.$this->foreign->store_inventory_id, [
            'selling_price' => '50.00', 'status' => 'inactive',
        ])->assertOk();
        foreach ([$this->worker, $this->supervisor] as $user) {
            $this->signIn($user)->getJson('/api/inventory/low-stock-reports')->assertOk()
                ->assertJsonCount(1, 'reports')->assertJsonPath('reports.0.note', 'A private note')
                ->assertJsonMissing(['note' => 'B private note']);
            $this->getJson('/api/inventory/availability-history')->assertOk()
                ->assertJsonCount(1, 'history')->assertJsonPath('history.0.product_name', 'Store A Rice')
                ->assertJsonMissing(['product_name' => 'Store B Rice']);
        }
        $this->signIn($this->otherSupervisor)->getJson('/api/inventory/low-stock-reports')->assertOk()
            ->assertJsonCount(1, 'reports')->assertJsonPath('reports.0.note', 'B private note');
        $this->getJson('/api/inventory/availability-history')->assertOk()
            ->assertJsonCount(1, 'history')->assertJsonPath('history.0.product_name', 'Store B Rice');
    }

    public function test_foreign_and_unknown_products_cannot_be_reported(): void
    {
        $this->signIn($this->worker)->postJson($this->reportPath($this->foreign), ['note' => 'Wrong store'])->assertNotFound();
        $this->postJson('/api/inventory/items/999999/low-stock-reports', ['note' => 'Unknown'])->assertNotFound();
        $this->assertDatabaseCount('low_stock_reports', 0);
    }

    public function test_only_inventory_workers_can_report_low_stock(): void
    {
        foreach ([$this->admin, $this->supervisor, $this->account('shopper')] as $user) {
            $this->signIn($user)->postJson($this->reportPath(), ['note' => 'No permission'])->assertForbidden();
        }
        $this->assertDatabaseCount('low_stock_reports', 0);
    }

    public function test_guests_and_non_staff_cannot_read_reporting_endpoints(): void
    {
        foreach (['/api/inventory/low-stock-reports', '/api/inventory/availability-history'] as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        $this->postJson($this->reportPath(), ['note' => 'Guest'])->assertUnauthorized();
        foreach ([$this->admin, $this->account('shopper')] as $user) {
            foreach (['/api/inventory/low-stock-reports', '/api/inventory/availability-history'] as $path) {
                $this->signIn($user)->getJson($path)->assertForbidden();
            }
        }
    }

    public static function deniedStates(): array
    {
        return [['unapproved'], ['unassigned'], ['inactive']];
    }

    #[DataProvider('deniedStates')]
    public function test_access_requires_current_approval_and_active_assignment(string $state): void
    {
        foreach ([$this->worker, $this->supervisor] as $user) {
            if ($state === 'unapproved') {
                $user->forceFill(['staff_approved_at' => null])->save();
            } elseif ($state === 'unassigned') {
                $user->staffStoreAssignment()->delete();
            } else {
                $this->first->update(['status' => 'inactive']);
            }
            $this->signIn($user)->getJson('/api/inventory/low-stock-reports')->assertForbidden();
            $this->getJson('/api/inventory/availability-history')->assertForbidden();
        }
        $this->signIn($this->worker)->postJson($this->reportPath(), ['note' => 'Denied'])->assertForbidden();
        $this->assertDatabaseCount('low_stock_reports', 0);
    }

    public function test_reassignment_invalidates_cached_store_access(): void
    {
        $this->worker->load('staffStoreAssignment.store');
        $this->worker->staffStoreAssignment()->update(['store_id' => $this->second->store_id]);
        $this->signIn($this->worker)->postJson($this->reportPath(), ['note' => 'Old store'])->assertNotFound();
        $this->postJson($this->reportPath($this->foreign), ['note' => 'New store'])->assertCreated()
            ->assertJsonPath('report.store_id', $this->second->store_id);
    }

    public function test_invalid_note_and_client_owned_audit_fields_are_rejected(): void
    {
        $this->signIn($this->worker);
        foreach (['', str_repeat('x', 1001), ['invalid']] as $note) {
            $this->postJson($this->reportPath(), ['note' => $note])->assertUnprocessable()->assertJsonValidationErrors('note');
        }
        $fields = [
            'store_id' => $this->second->store_id, 'user_id' => $this->admin->id,
            'store_inventory_id' => $this->foreign->store_inventory_id, 'product_id' => $this->foreign->product_id,
            'reported_by_user_id' => $this->admin->id, 'changed_by_user_id' => $this->admin->id,
            'hard_stock_qty' => 100, 'soft_stock_qty' => 90,
            'observed_hard_stock_qty' => 100, 'observed_soft_stock_qty' => 90,
            'status' => 'active', 'previous_status' => 'active', 'new_status' => 'inactive',
            'created_at' => '2020-01-01', 'updated_at' => '2020-01-01', 'role' => 'admin',
        ];
        $this->postJson($this->reportPath(), array_merge(['note' => 'Override'], $fields))
            ->assertUnprocessable()->assertJsonValidationErrors(array_keys($fields));
        $this->getJson('/api/inventory/low-stock-reports?store_id='.$this->second->store_id)
            ->assertUnprocessable()->assertJsonValidationErrors('store_id');
        $this->getJson('/api/inventory/availability-history?store_id='.$this->second->store_id)
            ->assertUnprocessable()->assertJsonValidationErrors('store_id');
        $this->assertDatabaseCount('low_stock_reports', 0);
    }

    public function test_availability_is_audited_on_creation_and_real_status_change_only(): void
    {
        $id = $this->signIn($this->worker)->postJson('/api/inventory/items', $this->productPayload())
            ->assertCreated()->json('inventory.store_inventory_id');
        $this->assertDatabaseHas('inventory_availability_logs', [
            'store_inventory_id' => $id, 'store_id' => $this->first->store_id,
            'changed_by_user_id' => $this->worker->id, 'previous_status' => null, 'new_status' => 'inactive',
        ]);
        $this->putJson('/api/inventory/items/'.$id, ['selling_price' => '61.00', 'status' => 'active'])->assertOk();
        $this->putJson('/api/inventory/items/'.$id, ['selling_price' => '62.00', 'status' => 'active'])->assertOk();
        $this->assertDatabaseCount('inventory_availability_logs', 2);
        $this->assertDatabaseHas('inventory_availability_logs', [
            'store_inventory_id' => $id, 'previous_status' => 'inactive', 'new_status' => 'active',
        ]);
        $this->assertSame(0, StoreInventory::findOrFail($id)->hard_stock_qty);
        $this->assertSame(0, StoreInventory::findOrFail($id)->soft_stock_qty);
        $this->getJson('/api/inventory/availability-history')->assertOk()->assertJsonCount(2, 'history');
    }

    public function test_audit_failure_rolls_back_status_price_and_product_edits(): void
    {
        $before = $this->own->fresh()->getAttributes();
        $this->withoutExceptionHandling();
        InventoryAvailabilityLog::creating(function () { throw new RuntimeException('Simulated audit failure'); });
        try {
            $this->signIn($this->worker)->putJson('/api/inventory/items/'.$this->own->store_inventory_id, [
                'product_name' => 'Should roll back', 'selling_price' => '99.00', 'status' => 'inactive',
            ]);
            $this->fail('Expected an audit failure.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated audit failure', $exception->getMessage());
        } finally {
            InventoryAvailabilityLog::flushEventListeners();
        }
        $this->assertSame($before, $this->own->fresh()->getAttributes());
        $this->assertSame('Store A Rice', $this->own->fresh()->product->product_name);
        $this->assertDatabaseCount('inventory_availability_logs', 0);
    }

    public function test_database_rejects_cross_store_report_and_audit_links(): void
    {
        foreach (['low_stock_reports', 'inventory_availability_logs'] as $table) {
            $values = [
                'store_id' => $this->second->store_id, 'store_inventory_id' => $this->own->store_inventory_id,
            ];
            if ($table === 'low_stock_reports') {
                $values = array_merge($values, [
                    'reported_by_user_id' => $this->worker->id, 'note' => 'Invalid link',
                    'observed_hard_stock_qty' => 8, 'observed_soft_stock_qty' => 3,
                ]);
            } else {
                $values = array_merge($values, ['changed_by_user_id' => $this->worker->id, 'new_status' => 'inactive']);
            }
            try {
                DB::table($table)->insert($values);
                $this->fail('The database accepted a cross-store link.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('FOREIGN KEY constraint failed', $exception->getMessage());
            }
            $this->assertDatabaseCount($table, 0);
        }
    }

    public function test_missing_reporting_schema_returns_setup_error_and_preserves_product_data(): void
    {
        Schema::drop('low_stock_reports');
        Schema::drop('inventory_availability_logs');
        $before = $this->own->fresh()->getAttributes();
        $this->signIn($this->worker)->postJson($this->reportPath(), ['note' => 'No setup'])->assertStatus(503);
        $this->getJson('/api/inventory/low-stock-reports')->assertStatus(503);
        $this->getJson('/api/inventory/availability-history')->assertStatus(503);
        $this->postJson('/api/inventory/items', $this->productPayload())->assertStatus(503);
        $this->putJson('/api/inventory/items/'.$this->own->store_inventory_id, [
            'product_name' => 'Should roll back', 'selling_price' => '99.00', 'status' => 'inactive',
        ])->assertStatus(503);
        $this->assertSame($before, $this->own->fresh()->getAttributes());
        $this->assertSame('Store A Rice', $this->own->fresh()->product->product_name);
        $this->assertDatabaseCount('products', 2);
        $this->assertDatabaseCount('store_inventory', 2);
        $this->getJson('/api/inventory/items')->assertOk();
    }
}
