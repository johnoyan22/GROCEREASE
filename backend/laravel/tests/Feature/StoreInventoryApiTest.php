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
use RuntimeException;
use Tests\TestCase;

class StoreInventoryApiTest extends TestCase
{
    private User $admin;
    private User $worker;
    private User $otherWorker;
    private Store $first;
    private Store $second;
    private Product $rice;
    private Product $otherRice;

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
        $this->first = Store::create(['store_name' => 'A', 'address' => 'A address']);
        $this->second = Store::create(['store_name' => 'B', 'address' => 'B address']);
        $this->worker = $this->account('inventory_worker');
        $this->otherWorker = $this->account('inventory_worker');
        $this->assign($this->worker, $this->first);
        $this->assign($this->otherWorker, $this->second);
        $this->rice = Product::create([
            'store_id' => $this->first->store_id, 'product_name' => 'Store A Rice',
            'sku' => 'TEST-RICE', 'barcode' => '0001234567890', 'size' => '1 kg', 'category' => 'Staples',
        ]);
        $this->otherRice = Product::create([
            'store_id' => $this->second->store_id, 'product_name' => 'Store B Rice',
            'sku' => 'TEST-RICE', 'category' => 'Staples',
        ]);
    }

    private function account(string $role): User
    {
        $user = User::factory()->unverified()->create([
            'role_id' => Role::where('slug', $role)->firstOrFail()->role_id,
        ]);
        if (in_array($role, User::STAFF_ROLES, true)) {
            $user->forceFill([
                'staff_approved_at' => now(), 'staff_approved_by_user_id' => $this->admin->id,
            ])->save();
        }
        return $user;
    }

    private function signIn(User $user): static
    {
        // Each browser account has a fresh authentication guard. Laravel's test
        // application is reused between requests, so clear Sanctum's cached user.
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'web');
    }

    private function assign(User $user, Store $store): void
    {
        StaffStoreAssignment::create([
            'user_id' => $user->id, 'store_id' => $store->store_id,
            'assigned_by_user_id' => $this->admin->id,
        ]);
    }

    private function offering(Store $store): StoreInventory
    {
        return StoreInventory::create([
            'store_id' => $store->store_id,
            'product_id' => $store->is($this->first) ? $this->rice->product_id : $this->otherRice->product_id,
            'selling_price' => '65.50', 'hard_stock_qty' => 12, 'soft_stock_qty' => 2,
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace([
            'product_name' => 'New Store Product', 'sku' => 'NEW-001', 'barcode' => null,
            'size' => '1 L', 'category' => 'Beverages', 'selling_price' => '25.50', 'status' => 'inactive',
        ], $overrides);
    }

    private function requests(StoreInventory $item): array
    {
        return [
            ['GET', '/api/inventory/items', []],
            ['POST', '/api/inventory/items', $this->payload()],
            ['PUT', '/api/inventory/items/'.$item->store_inventory_id, [
                'selling_price' => '72.25', 'status' => 'active',
            ]],
        ];
    }

    public static function otherRoles(): array
    {
        return [['shopper'], ['admin']];
    }

    public static function deniedAssignments(): array
    {
        return [['unapproved'], ['unassigned'], ['inactive']];
    }

    public static function badPrices(): array
    {
        return [[null], [''], ['invalid'], ['-0.01'], ['1.234'], ['100000000'], ['1e2']];
    }

    public function test_worker_reads_only_their_store_products_and_inventory(): void
    {
        $own = $this->offering($this->first);
        $foreign = $this->offering($this->second);
        $foreign->update(['selling_price' => '87.25']);
        $this->signIn($this->worker)->getJson('/api/inventory/items')
            ->assertOk()->assertJsonPath('store.store_id', $this->first->store_id)
            ->assertJsonCount(1, 'inventory')
            ->assertJsonPath('inventory.0.store_inventory_id', $own->store_inventory_id)
            ->assertJsonPath('inventory.0.product_name', 'Store A Rice')
            ->assertJsonPath('inventory.0.barcode', '0001234567890')
            ->assertJsonPath('inventory.0.selling_price', '65.50')
            ->assertJsonPath('inventory.0.hard_stock_qty', 12)
            ->assertJsonMissing(['product_name' => 'Store B Rice'])
            ->assertJsonMissing(['selling_price' => '87.25']);
    }

    public function test_empty_store_has_no_global_product_picker(): void
    {
        $this->offering($this->second);
        $this->signIn($this->worker)->getJson('/api/inventory/items')
            ->assertOk()->assertJsonCount(0, 'inventory');
        $this->getJson('/api/inventory/catalog')->assertNotFound();
    }

    public function test_worker_creates_product_details_and_inventory_in_own_store(): void
    {
        $this->signIn($this->worker)
            ->postJson('/api/inventory/items', $this->payload(['sku' => '  new-001  ']))
            ->assertCreated()->assertJsonPath('inventory.store_id', $this->first->store_id)
            ->assertJsonPath('inventory.product_name', 'New Store Product')
            ->assertJsonPath('inventory.sku', 'NEW-001')
            ->assertJsonPath('inventory.selling_price', '25.50')
            ->assertJsonPath('inventory.hard_stock_qty', 0)
            ->assertJsonPath('inventory.soft_stock_qty', 0)
            ->assertJsonPath('inventory.status', 'inactive');
        $this->assertDatabaseHas('products', [
            'store_id' => $this->first->store_id, 'sku' => 'NEW-001', 'category' => 'Beverages',
        ]);
        $this->assertDatabaseCount('products', 3);
        $this->assertDatabaseCount('store_inventory', 1);
        $this->getJson('/api/inventory/items')->assertOk()
            ->assertJsonPath('inventory.0.product_name', 'New Store Product');
    }

    public function test_different_stores_can_create_the_same_sku_as_separate_products(): void
    {
        $first = $this->signIn($this->worker)
            ->postJson('/api/inventory/items', $this->payload())
            ->assertCreated()->json('inventory.product_id');
        $second = $this->signIn($this->otherWorker)
            ->postJson('/api/inventory/items', $this->payload([
                'product_name' => 'Store B New Product', 'selling_price' => '30.00',
            ]))->assertCreated()->json('inventory.product_id');
        $this->assertNotSame($first, $second);
        $this->signIn($this->worker)->getJson('/api/inventory/items')
            ->assertOk()->assertJsonCount(1, 'inventory')
            ->assertJsonPath('inventory.0.selling_price', '25.50')
            ->assertJsonMissing(['product_name' => 'Store B New Product']);
    }

    public function test_worker_edits_only_own_product_details_price_and_status(): void
    {
        $own = $this->offering($this->first);
        $foreign = $this->offering($this->second);
        $original = $this->otherRice->fresh()->getAttributes();
        $this->signIn($this->worker)->putJson(
            '/api/inventory/items/'.$own->store_inventory_id,
            $this->payload(['product_name' => 'Updated A Rice', 'sku' => 'TEST-RICE', 'selling_price' => '72.25', 'status' => 'active'])
        )->assertOk()->assertJsonPath('inventory.product_name', 'Updated A Rice');
        $this->getJson('/api/inventory/items')->assertOk()
            ->assertJsonPath('inventory.0.product_name', 'Updated A Rice')
            ->assertJsonPath('inventory.0.selling_price', '72.25');
        $this->assertSame($original, $this->otherRice->fresh()->getAttributes());
        $this->assertSame('65.50', $foreign->fresh()->selling_price);
        $this->assertSame(12, $own->fresh()->hard_stock_qty);
        $this->assertSame(2, $own->fresh()->soft_stock_qty);
    }

    public function test_duplicate_sku_in_same_store_is_rejected_without_changing_records(): void
    {
        $own = $this->offering($this->first);
        $this->signIn($this->worker)->postJson(
            '/api/inventory/items', $this->payload(['sku' => '  test-rice  '])
        )->assertUnprocessable()->assertJsonValidationErrors('sku');
        $other = Product::create([
            'store_id' => $this->first->store_id, 'product_name' => 'Other', 'sku' => 'TAKEN', 'category' => 'Other',
        ]);
        $this->putJson('/api/inventory/items/'.$own->store_inventory_id, [
            'sku' => strtolower($other->sku), 'selling_price' => '1.00', 'status' => 'active',
        ])->assertUnprocessable()->assertJsonValidationErrors('sku');
        $this->assertSame('Store A Rice', $this->rice->fresh()->product_name);
        $this->assertSame('65.50', $own->fresh()->selling_price);
    }

    public function test_foreign_and_unknown_inventory_ids_are_not_found(): void
    {
        $foreign = $this->offering($this->second);
        $this->signIn($this->worker);
        foreach ([$foreign->store_inventory_id, 999999] as $id) {
            $this->putJson('/api/inventory/items/'.$id, $this->payload())->assertNotFound();
        }
        $this->assertSame('Store B Rice', $this->otherRice->fresh()->product_name);
        $this->assertSame('65.50', $foreign->fresh()->selling_price);
    }

    #[DataProvider('badPrices')]
    public function test_invalid_prices_do_not_create_or_update_products(mixed $price): void
    {
        $own = $this->offering($this->first);
        $this->signIn($this->worker)
            ->postJson('/api/inventory/items', $this->payload(['selling_price' => $price]))
            ->assertUnprocessable()->assertJsonValidationErrors('selling_price');
        $this->putJson('/api/inventory/items/'.$own->store_inventory_id, $this->payload(['selling_price' => $price]))
            ->assertUnprocessable()->assertJsonValidationErrors('selling_price');
        $this->assertDatabaseCount('products', 2);
        $this->assertDatabaseCount('store_inventory', 1);
        $this->assertSame('65.50', $own->fresh()->selling_price);
    }

    public function test_invalid_metadata_status_and_missing_fields_are_rejected(): void
    {
        $this->signIn($this->worker)->postJson('/api/inventory/items', [])
            ->assertUnprocessable()->assertJsonValidationErrors(['product_name', 'sku', 'category', 'selling_price', 'status']);
        foreach ([
            ['product_name' => str_repeat('a', 256)], ['sku' => str_repeat('a', 65)],
            ['barcode' => ['invalid']], ['size' => str_repeat('a', 101)],
            ['category' => ''], ['status' => 'unknown'],
        ] as $invalid) {
            $this->postJson('/api/inventory/items', $this->payload($invalid))
                ->assertUnprocessable()->assertJsonValidationErrors(array_keys($invalid));
        }
        $this->assertDatabaseCount('products', 2);
        $this->assertDatabaseCount('store_inventory', 0);
    }

    public function test_overrides_of_store_product_identity_stock_and_roles_are_rejected(): void
    {
        $own = $this->offering($this->first);
        $protected = [
            'store_id' => $this->second->store_id, 'product_id' => $this->otherRice->product_id,
            'user_id' => $this->admin->id, 'hard_stock_qty' => 99, 'soft_stock_qty' => 10,
            'stock_quantity' => 50, 'base_cost' => 1, 'base_price' => 1, 'role' => 'admin',
            'role_id' => $this->admin->role_id, 'assigned_by_user_id' => $this->admin->id,
            'store_inventory_id' => 999999,
        ];
        $this->signIn($this->worker)
            ->postJson('/api/inventory/items', array_merge($this->payload(), $protected))
            ->assertUnprocessable()->assertJsonValidationErrors(array_keys($protected));
        $this->putJson('/api/inventory/items/'.$own->store_inventory_id, array_merge($this->payload(), $protected))
            ->assertUnprocessable()->assertJsonValidationErrors(array_keys($protected));
        $this->getJson('/api/inventory/items?store_id='.$this->second->store_id)
            ->assertUnprocessable()->assertJsonValidationErrors('store_id');
        $this->assertSame('65.50', $own->fresh()->selling_price);
        $this->assertSame(12, $own->fresh()->hard_stock_qty);
        $this->assertDatabaseCount('products', 2);
    }

    public function test_guests_cannot_use_inventory_endpoints(): void
    {
        $own = $this->offering($this->first);
        foreach ($this->requests($own) as [$method, $path, $payload]) {
            $this->json($method, $path, $payload)->assertUnauthorized();
        }
    }

    #[DataProvider('otherRoles')]
    public function test_other_roles_cannot_use_inventory_endpoints(string $role): void
    {
        $own = $this->offering($this->first);
        $this->signIn($this->account($role));
        foreach ($this->requests($own) as [$method, $path, $payload]) {
            $this->json($method, $path, $payload)->assertForbidden();
        }
    }

    public function test_supervisors_read_only_their_own_store_and_cannot_modify_products(): void
    {
        $own = $this->offering($this->first);
        $this->offering($this->second);
        foreach ([$this->first, $this->second] as $store) {
            $supervisor = $this->account('supervisor');
            $this->assign($supervisor, $store);
            $expected = $store->is($this->first) ? 'Store A Rice' : 'Store B Rice';
            $this->signIn($supervisor)->getJson('/api/inventory/items')
                ->assertOk()->assertJsonCount(1, 'inventory')
                ->assertJsonPath('inventory.0.product_name', $expected);
            $this->postJson('/api/inventory/items', $this->payload())->assertForbidden();
            $this->putJson('/api/inventory/items/'.$own->store_inventory_id, $this->payload())->assertForbidden();
        }
        $this->assertSame('Store A Rice', $this->rice->fresh()->product_name);
    }

    #[DataProvider('deniedAssignments')]
    public function test_worker_requires_current_approval_and_active_store(string $state): void
    {
        $own = $this->offering($this->first);
        if ($state === 'unapproved') {
            $this->worker->forceFill(['staff_approved_at' => null])->save();
        } elseif ($state === 'unassigned') {
            $this->worker->staffStoreAssignment()->delete();
        } else {
            $this->first->update(['status' => Store::STATUS_INACTIVE]);
        }
        $this->signIn($this->worker);
        foreach ($this->requests($own) as [$method, $path, $payload]) {
            $this->json($method, $path, array_merge($payload, ['selling_price' => 'invalid']))->assertForbidden();
        }
    }

    public function test_reassignment_invalidates_old_store_access_with_loaded_relations(): void
    {
        $old = $this->offering($this->first);
        $new = $this->offering($this->second);
        $this->worker->load('staffStoreAssignment.store');
        $this->worker->staffStoreAssignment()->update(['store_id' => $this->second->store_id]);
        $this->signIn($this->worker)->getJson('/api/inventory/items')
            ->assertOk()->assertJsonPath('inventory.0.store_inventory_id', $new->store_inventory_id);
        $this->putJson('/api/inventory/items/'.$old->store_inventory_id, $this->payload())->assertNotFound();
        $this->assertSame('Store A Rice', $this->rice->fresh()->product_name);
    }

    public function test_unassigned_legacy_products_are_hidden_and_never_adopted_implicitly(): void
    {
        $legacyId = DB::table('products')->insertGetId([
            'store_id' => null, 'product_name' => 'Legacy Private Record',
            'sku' => 'NEW-001', 'category' => 'Legacy',
        ], 'product_id');
        $this->signIn($this->worker)->getJson('/api/inventory/items')
            ->assertOk()->assertJsonCount(0, 'inventory');
        $created = $this->postJson('/api/inventory/items', $this->payload())->assertCreated();
        $this->assertNotSame($legacyId, $created->json('inventory.product_id'));
        $this->assertDatabaseHas('products', ['product_id' => $legacyId, 'store_id' => null]);
    }

    public function test_inventory_failure_rolls_back_product_creation(): void
    {
        $this->withoutExceptionHandling();
        StoreInventory::creating(function () { throw new RuntimeException('Simulated inventory failure'); });
        try {
            $this->signIn($this->worker)->postJson('/api/inventory/items', $this->payload());
            $this->fail('Expected the simulated failure.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated inventory failure', $exception->getMessage());
        } finally {
            StoreInventory::flushEventListeners();
        }
        $this->assertDatabaseCount('products', 2);
        $this->assertDatabaseCount('store_inventory', 0);
    }
}
