<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AdminStoreTest extends TestCase
{
    private User $admin;

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
    }

    private function account(string $role): User
    {
        $user = User::factory()->unverified()->create([
            'role_id' => Role::where('slug', $role)->firstOrFail()->role_id,
        ]);
        if (in_array($role, User::STAFF_ROLES, true)) {
            $user->forceFill([
                'staff_approved_at' => now(),
                'staff_approved_by_user_id' => $this->admin->id,
            ])->save();
        }

        return $user;
    }

    private function signIn(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user, 'web');
    }

    private function payload(array $changes = []): array
    {
        return array_replace(['store_name' => 'Test Grocery', 'address' => 'Test Address, Cebu City'], $changes);
    }

    private function store(array $changes = []): Store
    {
        return Store::create($this->payload($changes));
    }

    private function assign(User $user, Store $store): StaffStoreAssignment
    {
        return StaffStoreAssignment::create([
            'user_id' => $user->id, 'store_id' => $store->store_id,
            'assigned_by_user_id' => $this->admin->id,
        ]);
    }

    public function test_admin_lists_active_and_inactive_stores_with_actual_staff_counts(): void
    {
        $first = $this->store(['store_name' => 'A branch']);
        $second = $this->store(['store_name' => 'B branch', 'status' => 'inactive']);
        $this->assign($this->account('supervisor'), $first);
        $this->assign($this->account('inventory_worker'), $first);

        $this->signIn($this->admin);
        $this->getJson('/api/admin/stores')->assertOk()
            ->assertJsonCount(2, 'stores')
            ->assertJsonPath('stores.0.store_id', $first->store_id)
            ->assertJsonPath('stores.0.assigned_staff_count', 2)
            ->assertJsonPath('stores.1.store_id', $second->store_id)
            ->assertJsonPath('stores.1.status', 'inactive')
            ->assertJsonPath('stores.1.assigned_staff_count', 0)
            ->assertJsonMissingPath('stores.0.staff');
    }

    public function test_empty_store_list_is_a_successful_empty_response(): void
    {
        $this->signIn($this->admin);
        $this->getJson('/api/admin/stores')->assertOk()->assertExactJson(['stores' => []]);
    }

    public function test_admin_creates_an_active_store_that_is_available_for_assignment(): void
    {
        $this->signIn($this->admin);
        $response = $this->postJson('/api/admin/stores', $this->payload([
            'store_name' => '  New Branch  ', 'address' => '  Cebu City  ',
        ]))->assertCreated()->assertJsonPath('store.store_name', 'New Branch')
            ->assertJsonPath('store.address', 'Cebu City')
            ->assertJsonPath('store.status', 'active')
            ->assertJsonPath('store.assigned_staff_count', 0);
        $id = $response->json('store.store_id');

        $this->assertDatabaseHas('stores', ['store_id' => $id, 'status' => 'active']);
        $this->getJson('/api/admin/staff-store-assignments')->assertOk()
            ->assertJsonPath('stores.0.store_id', $id);
        $this->assertDatabaseCount('staff_store_assignments', 0);
    }

    public function test_same_named_branches_can_be_created_with_separate_ids(): void
    {
        $this->signIn($this->admin);
        $first = $this->postJson('/api/admin/stores', $this->payload())->assertCreated();
        $second = $this->postJson('/api/admin/stores', $this->payload(['address' => 'Different branch address']))->assertCreated();
        $this->assertNotSame($first->json('store.store_id'), $second->json('store.store_id'));
        $this->assertDatabaseCount('stores', 2);
    }

    public function test_detail_edit_preserves_id_status_and_other_stores(): void
    {
        $store = $this->store(['status' => 'inactive']);
        $other = $this->store(['store_name' => 'Other store']);
        $this->signIn($this->admin);
        $this->putJson('/api/admin/stores/'.$store->store_id, $this->payload([
            'store_name' => 'Edited name', 'address' => 'Edited address',
        ]))->assertOk()->assertJsonPath('store.store_id', $store->store_id)
            ->assertJsonPath('store.status', 'inactive');

        $this->assertDatabaseHas('stores', [
            'store_id' => $store->store_id, 'store_name' => 'Edited name', 'address' => 'Edited address', 'status' => 'inactive',
        ]);
        $this->assertSame('Other store', $other->fresh()->store_name);
        $this->assertDatabaseCount('stores', 2);
    }

    public static function invalidDetails(): array
    {
        return [
            'empty name' => [['store_name' => '   '], 'store_name'],
            'empty address' => [['address' => null], 'address'],
            'long name' => [['store_name' => str_repeat('a', 101)], 'store_name'],
            'long address' => [['address' => str_repeat('a', 256)], 'address'],
            'non-string name' => [['store_name' => ['invalid']], 'store_name'],
            'non-string address' => [['address' => ['invalid']], 'address'],
            'status requires separate action' => [['status' => 'inactive'], 'status'],
        ];
    }

    #[DataProvider('invalidDetails')]
    public function test_invalid_details_never_create_or_modify_a_store(array $changes, string $field): void
    {
        $store = $this->store();
        $before = $store->fresh()->getAttributes();
        $this->signIn($this->admin);
        $this->postJson('/api/admin/stores', $this->payload($changes))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson('/api/admin/stores/'.$store->store_id, $this->payload($changes))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertSame($before, $store->fresh()->getAttributes());
        $this->assertDatabaseCount('stores', 1);
    }

    public function test_missing_required_fields_are_rejected(): void
    {
        $store = $this->store();
        $this->signIn($this->admin);
        $this->postJson('/api/admin/stores', [])->assertUnprocessable()->assertJsonValidationErrors(['store_name', 'address']);
        $this->putJson('/api/admin/stores/'.$store->store_id, [])->assertUnprocessable()->assertJsonValidationErrors(['store_name', 'address']);
    }

    public function test_protected_fields_cannot_be_changed_through_any_write_endpoint(): void
    {
        $store = $this->store();
        $this->signIn($this->admin);
        $spoof = ['store_id' => 999, 'owner_id' => 99, 'user_id' => 99, 'role' => 'shopper', 'role_id' => 99,
            'assigned_by_user_id' => 99, 'assigned_staff_count' => 100, 'staff_ids' => [99], 'created_at' => '2000-01-01', 'updated_at' => '2000-01-01'];
        $fields = array_keys($spoof);
        $this->postJson('/api/admin/stores', [...$this->payload(), ...$spoof])->assertUnprocessable()->assertJsonValidationErrors($fields);
        $this->putJson('/api/admin/stores/'.$store->store_id, [...$this->payload(), ...$spoof])->assertUnprocessable()->assertJsonValidationErrors($fields);
        $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => 'inactive', ...$spoof])->assertUnprocessable()->assertJsonValidationErrors($fields);
        $this->assertSame('active', $store->fresh()->status);
        $this->assertDatabaseCount('stores', 1);
    }

    public function test_empty_protected_status_does_not_clear_status_during_metadata_edit(): void
    {
        $store = $this->store();
        $this->signIn($this->admin);
        foreach ([null, ''] as $status) {
            $this->putJson('/api/admin/stores/'.$store->store_id, $this->payload(['status' => $status, 'store_id' => null]))
                ->assertOk()->assertJsonPath('store.status', 'active')->assertJsonPath('store.store_id', $store->store_id);
        }
        $this->assertSame('active', $store->fresh()->status);
    }

    public function test_status_endpoint_rejects_invalid_status_and_metadata_changes(): void
    {
        $store = $this->store();
        $this->signIn($this->admin);
        foreach (['unknown', 'ACTIVE', null, ['active'], ''] as $status) {
            $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => $status])
                ->assertUnprocessable()->assertJsonValidationErrors('status');
        }
        $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => 'inactive', 'store_name' => 'Spoof', 'address' => 'Spoof'])
            ->assertUnprocessable()->assertJsonValidationErrors(['store_name', 'address']);
        $this->assertSame('active', $store->fresh()->status);
        $this->assertSame('Test Grocery', $store->fresh()->store_name);
    }

    public function test_deactivation_and_reactivation_preserve_data_and_control_staff_access(): void
    {
        $store = $this->store();
        $other = $this->store(['store_name' => 'Other store']);
        $worker = $this->account('inventory_worker');
        $supervisor = $this->account('supervisor');
        $unassigned = $this->account('inventory_worker');
        $assignment = $this->assign($worker, $store);
        $this->assign($supervisor, $store);
        $product = Product::create(['store_id' => $store->store_id, 'product_name' => 'Rice', 'sku' => 'RICE-1KG', 'category' => 'Staples']);
        $inventory = StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id,
            'selling_price' => '67.00', 'hard_stock_qty' => 12, 'soft_stock_qty' => 2, 'status' => 'active']);
        $inventoryBefore = $inventory->fresh()->getAttributes();
        $productBefore = $product->fresh()->getAttributes();
        $assignmentBefore = $assignment->fresh()->getAttributes();

        $this->signIn($this->admin);
        $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => 'inactive'])
            ->assertOk()->assertJsonPath('store.status', 'inactive')->assertJsonPath('store.assigned_staff_count', 2);
        $choices = $this->getJson('/api/admin/staff-store-assignments')->assertOk();
        $this->assertSame([$other->store_id], array_column($choices->json('stores'), 'store_id'));
        $this->putJson('/api/admin/staff/'.$unassigned->id.'/store-assignment', ['store_id' => $store->store_id])
            ->assertUnprocessable()->assertJsonValidationErrors('store_id');

        $this->signIn($worker);
        $this->getJson('/api/staff/store')->assertForbidden();
        $this->getJson('/api/inventory/items')->assertForbidden();
        $this->postJson('/api/inventory/items', ['product_name' => 'Water', 'sku' => 'WATER', 'category' => 'Drinks', 'selling_price' => '10.00', 'status' => 'active'])->assertForbidden();
        $this->putJson('/api/inventory/items/'.$inventory->store_inventory_id, ['selling_price' => '99.00', 'status' => 'inactive'])->assertForbidden();
        $this->signIn($supervisor);
        $this->getJson('/api/inventory/items')->assertForbidden();
        $this->getJson('/api/supervisor/staff')->assertForbidden();

        $this->signIn($this->admin);
        $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => 'active'])
            ->assertOk()->assertJsonPath('store.status', 'active');
        $choices = $this->getJson('/api/admin/staff-store-assignments')->assertOk();
        $this->assertContains($store->store_id, array_column($choices->json('stores'), 'store_id'));
        $this->signIn($worker);
        $this->getJson('/api/staff/store')->assertOk()->assertJsonPath('store.store_id', $store->store_id);
        $this->getJson('/api/inventory/items')->assertOk()->assertJsonPath('inventory.0.selling_price', '67.00');
        $this->signIn($supervisor);
        $this->getJson('/api/inventory/items')->assertOk()->assertJsonCount(1, 'inventory');

        $this->assertSame($inventoryBefore, $inventory->fresh()->getAttributes());
        $this->assertSame($productBefore, $product->fresh()->getAttributes());
        $this->assertSame($assignmentBefore, $assignment->fresh()->getAttributes());
        $this->assertSame('active', $other->fresh()->status);
        $this->assertDatabaseCount('stores', 2);
        $this->assertDatabaseCount('products', 1);
        $this->assertDatabaseCount('store_inventory', 1);
        $this->assertDatabaseCount('staff_store_assignments', 2);
    }

    public function test_repeated_status_save_preserves_the_timestamp(): void
    {
        $store = $this->store();
        $this->signIn($this->admin);
        $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => 'inactive'])->assertOk();
        $updatedAt = $store->fresh()->getRawOriginal('updated_at');
        $this->travel(5)->minutes();
        $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => 'inactive'])->assertOk();
        $this->assertSame($updatedAt, $store->fresh()->getRawOriginal('updated_at'));
    }

    public function test_unknown_store_ids_return_not_found_without_creating_records(): void
    {
        $this->signIn($this->admin);
        $this->putJson('/api/admin/stores/999999', $this->payload())->assertNotFound();
        $this->putJson('/api/admin/stores/999999/status', ['status' => 'inactive'])->assertNotFound();
        $this->assertDatabaseCount('stores', 0);
    }

    public function test_guests_cannot_use_any_store_management_endpoint(): void
    {
        $store = $this->store();
        $this->getJson('/api/admin/stores')->assertUnauthorized();
        $this->postJson('/api/admin/stores', $this->payload())->assertUnauthorized();
        $this->putJson('/api/admin/stores/'.$store->store_id, $this->payload())->assertUnauthorized();
        $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => 'inactive'])->assertUnauthorized();
        $this->assertSame('active', $store->fresh()->status);
        $this->assertDatabaseCount('stores', 1);
    }

    public static function nonAdminRoles(): array
    {
        return [['shopper'], ['inventory_worker'], ['supervisor']];
    }

    #[DataProvider('nonAdminRoles')]
    public function test_other_roles_cannot_manage_stores(string $role): void
    {
        $store = $this->store();
        $this->signIn($this->account($role));
        $this->getJson('/api/admin/stores')->assertForbidden();
        $this->postJson('/api/admin/stores', $this->payload())->assertForbidden();
        $this->putJson('/api/admin/stores/'.$store->store_id, $this->payload(['store_name' => 'Spoof']))->assertForbidden();
        $this->putJson('/api/admin/stores/'.$store->store_id.'/status', ['status' => 'inactive'])->assertForbidden();
        $this->assertSame('Test Grocery', $store->fresh()->store_name);
        $this->assertSame('active', $store->fresh()->status);
        $this->assertDatabaseCount('stores', 1);
    }

    public function test_hard_delete_is_not_exposed(): void
    {
        $store = $this->store();
        $this->signIn($this->admin);
        $this->deleteJson('/api/admin/stores/'.$store->store_id)->assertStatus(405);
        $this->assertDatabaseHas('stores', ['store_id' => $store->store_id]);
    }
}
