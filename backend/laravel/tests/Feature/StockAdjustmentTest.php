<?php

namespace Tests\Feature;

use App\Models\InventoryPolicyLog;
use App\Models\Product;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\StockAdjustment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class StockAdjustmentTest extends TestCase
{
    private User $admin;
    private User $worker;
    private User $supervisor;
    private User $otherSupervisor;
    private Store $first;
    private Store $second;
    private StoreInventory $inventory;

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
        $this->first = Store::create(['store_name' => 'Store A', 'address' => 'A']);
        $this->second = Store::create(['store_name' => 'Store B', 'address' => 'B']);
        $this->worker = $this->account('inventory_worker', $this->first);
        $this->supervisor = $this->account('supervisor', $this->first);
        $this->otherSupervisor = $this->account('supervisor', $this->second);
        $product = Product::create([
            'store_id' => $this->first->store_id, 'product_name' => 'Rice', 'sku' => 'RICE', 'category' => 'Staples',
        ]);
        $this->inventory = StoreInventory::create([
            'store_id' => $this->first->store_id, 'product_id' => $product->product_id,
            'selling_price' => '50.00', 'hard_stock_qty' => 100, 'soft_stock_qty' => 15, 'status' => 'active',
        ])->refresh();
    }

    private function account(string $role, ?Store $store = null): User
    {
        $user = User::factory()->unverified()->create([
            'role_id' => Role::where('slug', $role)->firstOrFail()->role_id,
        ]);
        if (in_array($role, User::STAFF_ROLES, true)) {
            $user->forceFill(['staff_approved_at' => now(), 'staff_approved_by_user_id' => $this->admin->id])->save();
        }
        if ($store) {
            StaffStoreAssignment::create([
                'user_id' => $user->id, 'store_id' => $store->store_id, 'assigned_by_user_id' => $this->admin->id,
            ]);
        }
        return $user;
    }

    private function signIn(User $user): static
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'web');
    }

    private function submit(array $overrides = []): int
    {
        return $this->signIn($this->worker)->postJson($this->submissionPath(), array_merge([
            'requested_hard_stock_qty' => 92, 'expected_stock_version' => $this->inventory->fresh()->stock_version,
            'reason' => 'Physical count confirmed on shelf and in storage.',
        ], $overrides))->assertCreated()->json('adjustment.id');
    }

    private function submissionPath(): string
    {
        return '/api/inventory/items/'.$this->inventory->store_inventory_id.'/stock-adjustments';
    }

    private function decisionPath(int $id): string
    {
        return '/api/supervisor/stock-adjustments/'.$id.'/decision';
    }

    private function policyPath(): string
    {
        return '/api/supervisor/inventory/items/'.$this->inventory->store_inventory_id.'/policy';
    }

    public function test_correction_is_pending_until_same_store_supervisor_approves_once(): void
    {
        $before = $this->inventory->fresh()->getAttributes();
        $id = $this->submit();
        $this->assertSame($before, $this->inventory->fresh()->getAttributes());
        $this->assertDatabaseHas('stock_adjustments', [
            'id' => $id, 'status' => 'pending', 'requested_by_user_id' => $this->worker->id,
            'observed_hard_stock_qty' => 100, 'observed_soft_stock_qty' => 15, 'observed_stock_version' => 0,
            'decided_by_user_id' => null,
        ]);
        $this->signIn($this->supervisor)->putJson($this->decisionPath($id), ['decision' => 'approved'])
            ->assertOk()->assertJsonPath('adjustment.status', 'approved')
            ->assertJsonPath('adjustment.current_hard_stock_qty', 92)
            ->assertJsonPath('adjustment.current_soft_stock_qty', 15)
            ->assertJsonPath('adjustment.decided_by_user_id', $this->supervisor->id);
        $approved = StockAdjustment::findOrFail($id)->getAttributes();
        $this->assertNotNull($approved['decided_at']);
        $this->assertSame(1, $this->inventory->fresh()->stock_version);
        $this->travel(5)->minutes();
        $this->putJson($this->decisionPath($id), ['decision' => 'approved'])->assertConflict();
        $this->putJson($this->decisionPath($id), ['decision' => 'rejected', 'decision_note' => 'Too late'])->assertConflict();
        $this->assertSame($approved, StockAdjustment::findOrFail($id)->getAttributes());
        $this->assertSame(92, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(1, $this->inventory->fresh()->stock_version);
        foreach ([$this->worker, $this->supervisor] as $user) {
            $this->signIn($user)->getJson('/api/inventory/items')->assertOk()
                ->assertJsonPath('inventory.0.hard_stock_qty', 92)->assertJsonPath('inventory.0.available_stock', 77);
            $this->getJson('/api/inventory/stock-adjustments')->assertOk()->assertJsonPath('adjustments.0.status', 'approved');
        }
    }

    public function test_rejection_requires_reason_and_preserves_inventory(): void
    {
        $id = $this->submit();
        $before = $this->inventory->fresh()->getAttributes();
        $this->signIn($this->supervisor)->putJson($this->decisionPath($id), ['decision' => 'rejected'])
            ->assertUnprocessable()->assertJsonValidationErrors('decision_note');
        $this->putJson($this->decisionPath($id), ['decision' => 'rejected', 'decision_note' => 'Please recount the storage room.'])
            ->assertOk()->assertJsonPath('adjustment.status', 'rejected');
        $this->assertSame($before, $this->inventory->fresh()->getAttributes());
        $this->putJson($this->decisionPath($id), ['decision' => 'approved'])->assertConflict();
    }

    public static function stockChanges(): array
    {
        return [['physical'], ['reserved'], ['version']];
    }

    #[DataProvider('stockChanges')]
    public function test_changed_stock_prevents_stale_approval_but_allows_rejection(string $change): void
    {
        $id = $this->submit();
        if ($change === 'physical') {
            $this->inventory->hard_stock_qty = 110;
        } elseif ($change === 'reserved') {
            $this->inventory->soft_stock_qty = 20;
        }
        $this->inventory->stock_version = $this->inventory->stock_version + 1;
        $this->inventory->save();
        $before = $this->inventory->fresh()->getAttributes();
        $this->signIn($this->supervisor)->getJson('/api/inventory/stock-adjustments')->assertOk()
            ->assertJsonPath('adjustments.0.is_stale', true);
        $this->putJson($this->decisionPath($id), ['decision' => 'approved'])->assertConflict();
        $this->assertSame('pending', StockAdjustment::findOrFail($id)->status);
        $this->assertSame($before, $this->inventory->fresh()->getAttributes());
        $this->putJson($this->decisionPath($id), ['decision' => 'rejected', 'decision_note' => 'Stock changed; please reconcile.'])->assertOk();
    }

    public function test_two_requests_from_same_snapshot_cannot_both_overwrite_stock(): void
    {
        $first = $this->submit();
        $second = $this->submit(['requested_hard_stock_qty' => 94]);
        $this->signIn($this->supervisor)->putJson($this->decisionPath($first), ['decision' => 'approved'])->assertOk();
        $this->putJson($this->decisionPath($second), ['decision' => 'approved'])->assertConflict();
        $this->assertSame(92, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_count_cannot_be_below_reservations_and_stale_submission_is_rejected(): void
    {
        $this->signIn($this->worker)->postJson($this->submissionPath(), [
            'requested_hard_stock_qty' => 14, 'expected_stock_version' => 0, 'reason' => 'Reserved items missing',
        ])->assertUnprocessable()->assertJsonValidationErrors('requested_hard_stock_qty');
        $this->inventory->stock_version = 1;
        $this->inventory->save();
        $this->postJson($this->submissionPath(), [
            'requested_hard_stock_qty' => 92, 'expected_stock_version' => 0, 'reason' => 'Old screen',
        ])->assertConflict();
        $this->assertDatabaseCount('stock_adjustments', 0);
    }

    public function test_foreign_supervisor_cannot_read_or_decide_another_stores_request(): void
    {
        $id = $this->submit();
        $this->signIn($this->otherSupervisor)->getJson('/api/inventory/stock-adjustments')->assertOk()->assertJsonCount(0, 'adjustments');
        $this->putJson($this->decisionPath($id), ['decision' => 'approved'])->assertNotFound();
        $this->putJson($this->policyPath(), ['max_per_order' => 3, 'low_stock_threshold' => 20])->assertNotFound();
        $this->putJson($this->decisionPath(999999), ['decision' => 'approved'])->assertNotFound();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame('pending', StockAdjustment::findOrFail($id)->status);
    }

    public function test_worker_cannot_request_a_foreign_inventory_item(): void
    {
        $this->worker->staffStoreAssignment()->update(['store_id' => $this->second->store_id]);
        $this->signIn($this->worker)->postJson($this->submissionPath(), [
            'requested_hard_stock_qty' => 92, 'expected_stock_version' => 0, 'reason' => 'Foreign item',
        ])->assertNotFound();
    }

    public function test_role_and_guest_restrictions_cover_all_new_operations(): void
    {
        $this->getJson('/api/inventory/stock-adjustments')->assertUnauthorized();
        $this->postJson($this->submissionPath(), [])->assertUnauthorized();
        $this->putJson($this->decisionPath(1), [])->assertUnauthorized();
        $this->putJson($this->policyPath(), [])->assertUnauthorized();
        foreach ([$this->admin, $this->account('shopper')] as $user) {
            $this->signIn($user)->getJson('/api/inventory/stock-adjustments')->assertForbidden();
            $this->postJson($this->submissionPath(), [])->assertForbidden();
            $this->putJson($this->decisionPath(1), [])->assertForbidden();
            $this->putJson($this->policyPath(), [])->assertForbidden();
        }
        $this->signIn($this->supervisor)->postJson($this->submissionPath(), [])->assertForbidden();
        $this->signIn($this->worker)->putJson($this->decisionPath(1), [])->assertForbidden();
        $this->putJson($this->policyPath(), [])->assertForbidden();
    }

    public static function deniedStates(): array
    {
        return [['unapproved'], ['unassigned'], ['inactive']];
    }

    #[DataProvider('deniedStates')]
    public function test_decision_uses_current_approval_assignment_and_active_store(string $state): void
    {
        $id = $this->submit();
        $this->supervisor->load('staffStoreAssignment.store');
        if ($state === 'unapproved') {
            $this->supervisor->forceFill(['staff_approved_at' => null])->save();
        } elseif ($state === 'unassigned') {
            $this->supervisor->staffStoreAssignment()->delete();
        } else {
            $this->first->update(['status' => 'inactive']);
        }
        $this->signIn($this->supervisor)->putJson($this->decisionPath($id), ['decision' => 'approved'])->assertForbidden();
        $this->getJson('/api/inventory/stock-adjustments')->assertForbidden();
        $this->putJson($this->policyPath(), ['max_per_order' => 3, 'low_stock_threshold' => 20])->assertForbidden();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_supervisor_reassignment_invalidates_old_requests(): void
    {
        $id = $this->submit();
        $this->supervisor->load('staffStoreAssignment.store');
        $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->second->store_id]);
        $this->signIn($this->supervisor)->putJson($this->decisionPath($id), ['decision' => 'approved'])->assertNotFound();
    }

    public function test_promoted_requester_cannot_approve_own_request(): void
    {
        $id = $this->submit();
        $this->worker->role_id = Role::where('slug', 'supervisor')->firstOrFail()->role_id;
        $this->worker->save();
        $this->signIn($this->worker)->putJson($this->decisionPath($id), ['decision' => 'approved'])->assertForbidden();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_decision_persistence_failure_rolls_back_the_quantity_change(): void
    {
        $id = $this->submit();
        $before = $this->inventory->fresh()->getAttributes();
        $this->withoutExceptionHandling();
        StockAdjustment::updating(function () { throw new RuntimeException('Simulated decision failure'); });
        try {
            $this->signIn($this->supervisor)->putJson($this->decisionPath($id), ['decision' => 'approved']);
            $this->fail('Expected a decision failure.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated decision failure', $exception->getMessage());
        } finally {
            StockAdjustment::flushEventListeners();
        }
        $this->assertSame($before, $this->inventory->fresh()->getAttributes());
        $this->assertSame('pending', StockAdjustment::findOrFail($id)->status);
    }

    public function test_supervisor_sets_policy_and_low_stock_uses_available_quantity(): void
    {
        $this->signIn($this->supervisor)->putJson($this->policyPath(), ['max_per_order' => 4, 'low_stock_threshold' => 85])->assertOk();
        $this->getJson('/api/inventory/items')->assertOk()->assertJsonPath('inventory.0.available_stock', 85)
            ->assertJsonPath('inventory.0.is_low_stock', true)->assertJsonPath('inventory.0.max_per_order', 4);
        $this->putJson($this->policyPath(), ['max_per_order' => 4, 'low_stock_threshold' => 85])->assertOk();
        $this->assertDatabaseCount('inventory_policy_logs', 1);
        $this->assertDatabaseHas('inventory_policy_logs', [
            'changed_by_user_id' => $this->supervisor->id, 'previous_max_per_order' => null,
            'new_max_per_order' => 4, 'new_low_stock_threshold' => 85,
        ]);
        $this->putJson($this->policyPath(), ['max_per_order' => null, 'low_stock_threshold' => null])->assertOk();
        $this->getJson('/api/inventory/items')->assertOk()->assertJsonPath('inventory.0.is_low_stock', false)
            ->assertJsonPath('inventory.0.max_per_order', null)->assertJsonPath('inventory.0.low_stock_threshold', null);
        $this->assertSame(0, $this->inventory->fresh()->stock_version);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(15, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('inventory_policy_logs', 2);
    }

    public function test_invalid_policy_and_quantity_input_cannot_change_stock(): void
    {
        $this->signIn($this->worker);
        foreach ([-1, 1.5, 2147483648, 'invalid'] as $quantity) {
            $this->postJson($this->submissionPath(), [
                'requested_hard_stock_qty' => $quantity, 'expected_stock_version' => 0, 'reason' => 'Invalid',
            ])->assertUnprocessable()->assertJsonValidationErrors('requested_hard_stock_qty');
        }
        $this->postJson($this->submissionPath(), [])->assertUnprocessable()
            ->assertJsonValidationErrors(['reason', 'requested_hard_stock_qty', 'expected_stock_version']);
        $this->signIn($this->supervisor);
        foreach ([['max_per_order' => 0], ['max_per_order' => 1.5], ['low_stock_threshold' => -1]] as $invalid) {
            $this->putJson($this->policyPath(), array_merge(['max_per_order' => 2, 'low_stock_threshold' => 10], $invalid))
                ->assertUnprocessable()->assertJsonValidationErrors(array_keys($invalid));
        }
        $this->putJson($this->policyPath(), [])->assertUnprocessable();
        $this->assertDatabaseCount('stock_adjustments', 0);
        $this->assertDatabaseCount('inventory_policy_logs', 0);
    }

    public function test_client_cannot_override_actor_store_snapshot_or_decision_metadata(): void
    {
        $fields = [
            'store_id' => $this->second->store_id, 'requested_by_user_id' => $this->supervisor->id,
            'decided_by_user_id' => $this->admin->id, 'observed_hard_stock_qty' => 999,
            'observed_soft_stock_qty' => 0, 'observed_stock_version' => 999,
            'hard_stock_qty' => 999, 'soft_stock_qty' => 0, 'stock_version' => 999,
            'status' => 'approved', 'decided_at' => '2020-01-01',
        ];
        $this->signIn($this->worker)->postJson($this->submissionPath(), array_merge([
            'requested_hard_stock_qty' => 92, 'expected_stock_version' => 0, 'reason' => 'Override',
        ], $fields))->assertUnprocessable()->assertJsonValidationErrors(array_keys($fields));
        $id = $this->submit();
        $this->signIn($this->supervisor)->putJson($this->decisionPath($id), array_merge([
            'decision' => 'approved', 'requested_hard_stock_qty' => 999,
        ], $fields))->assertUnprocessable()->assertJsonValidationErrors(array_merge(array_keys($fields), ['requested_hard_stock_qty']));
        $this->getJson('/api/inventory/stock-adjustments?store_id='.$this->second->store_id)->assertUnprocessable();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_database_rejects_reserved_stock_above_physical_stock(): void
    {
        $this->expectException(QueryException::class);
        DB::table('store_inventory')->where('store_inventory_id', $this->inventory->store_inventory_id)
            ->update(['hard_stock_qty' => 14]);
    }
}
