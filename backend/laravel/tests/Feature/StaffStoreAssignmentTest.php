<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StaffStoreAssignmentTest extends TestCase
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

        $this->artisan('migrate', [
            '--database' => 'sqlite',
            '--force' => true,
        ])->assertExitCode(0);

        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
    }

    private function account(string $role, bool $approved = true): User
    {
        $user = User::factory()->unverified()->create([
            'role_id' => Role::where('slug', $role)->firstOrFail()->role_id,
        ]);

        if ($approved && in_array($role, ['inventory_worker', 'supervisor'], true)) {
            $user->forceFill([
                'staff_approved_at' => now(),
                'staff_approved_by_user_id' => $this->admin->id,
            ])->save();
        }

        return $user;
    }

    private function store(string $name = 'Test Store'): Store
    {
        return Store::create([
            'store_name' => $name,
            'address' => $name.' address',
        ]);
    }

    private function assign(User $user, Store $store, ?User $actor = null): StaffStoreAssignment
    {
        return StaffStoreAssignment::create([
            'user_id' => $user->id,
            'store_id' => $store->store_id,
            'assigned_by_user_id' => ($actor ?? $this->admin)->id,
        ]);
    }

    private function adminPath(User $user): string
    {
        return '/api/admin/staff/'.$user->id.'/store-assignment';
    }

    private function supervisorPath(User $user): string
    {
        return '/api/supervisor/staff/'.$user->id.'/store-assignment';
    }

    public static function staffRoles(): array
    {
        return [['inventory_worker'], ['supervisor']];
    }

    public static function nonAdminRoles(): array
    {
        return [['shopper'], ['inventory_worker'], ['supervisor']];
    }

    public static function nonSupervisorRoles(): array
    {
        return [['shopper'], ['inventory_worker'], ['admin']];
    }

    public static function nonStaffRoles(): array
    {
        return [['shopper'], ['admin']];
    }

    public static function deniedStaffTargets(): array
    {
        return [
            ['inventory_worker', false],
            ['supervisor', true],
            ['shopper', false],
            ['admin', false],
        ];
    }

    public static function deniedStoreStates(): array
    {
        return [['unassigned'], ['inactive'], ['unapproved']];
    }

    public function test_admin_lists_staff_and_active_store_choices(): void
    {
        $worker = $this->account('inventory_worker');
        $this->account('supervisor');
        $this->account('inventory_worker', false);
        $this->account('shopper');

        $active = $this->store('Active');
        $inactive = $this->store('Inactive');
        $inactive->update(['status' => Store::STATUS_INACTIVE]);
        $this->assign($worker, $inactive);

        $this->actingAs($this->admin, 'web')
            ->getJson('/api/admin/staff-store-assignments')
            ->assertOk()
            ->assertJsonCount(3, 'staff')
            ->assertJsonPath('staff.0.id', $worker->id)
            ->assertJsonPath('staff.0.assignment.store.status', 'inactive')
            ->assertJsonPath('staff.2.approved', false)
            ->assertJsonCount(1, 'stores')
            ->assertJsonPath('stores.0.store_id', $active->store_id)
            ->assertJsonMissingPath('staff.0.password');
    }

    #[DataProvider('staffRoles')]
    public function test_admin_places_approved_staff(string $role): void
    {
        $staff = $this->account($role);
        $store = $this->store();

        $this->actingAs($this->admin, 'web')
            ->putJson($this->adminPath($staff), ['store_id' => $store->store_id])
            ->assertOk()
            ->assertJsonPath('assignment.user_id', $staff->id)
            ->assertJsonPath('assignment.assigned_by_user_id', $this->admin->id);

        $this->assertSame($store->store_id, $staff->assignedStore()?->store_id);
        $this->assertDatabaseCount('staff_store_assignments', 1);
    }

    public function test_admin_transfer_preserves_row_identity_and_other_staff(): void
    {
        $worker = $this->account('inventory_worker');
        $other = $this->account('supervisor');
        $first = $this->store('A');
        $second = $this->store('B');

        $placement = $this->assign($worker, $first);
        $this->assign($other, $first);
        $worker->load('staffStoreAssignment.store');

        $this->actingAs($this->admin, 'web')
            ->putJson($this->adminPath($worker), ['store_id' => $second->store_id])
            ->assertOk()
            ->assertJsonPath('assignment.id', $placement->id);

        $this->assertSame($second->store_id, $worker->assignedStore()?->store_id);
        $this->assertSame($first->store_id, $other->assignedStore()?->store_id);
        $this->assertSame(1, $first->staffStoreAssignments()->count());
        $this->assertSame(1, $second->staffStoreAssignments()->count());
        $this->assertDatabaseCount('staff_store_assignments', 2);
    }

    public function test_admin_cannot_place_unapproved_or_non_staff_accounts(): void
    {
        $store = $this->store();
        $this->actingAs($this->admin, 'web');

        foreach ([
            $this->account('inventory_worker', false),
            $this->account('shopper'),
            $this->account('admin'),
        ] as $target) {
            $this->putJson($this->adminPath($target), ['store_id' => $store->store_id])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('user');
        }

        $this->assertDatabaseCount('staff_store_assignments', 0);
    }

    public function test_invalid_admin_input_preserves_the_current_assignment(): void
    {
        $staff = $this->account('inventory_worker');
        $active = $this->store('Active');
        $inactive = $this->store('Inactive');
        $inactive->update(['status' => Store::STATUS_INACTIVE]);
        $placement = $this->assign($staff, $active);

        $this->actingAs($this->admin, 'web');

        foreach ([null, 'invalid', 999999, $inactive->store_id] as $storeId) {
            $this->putJson($this->adminPath($staff), ['store_id' => $storeId])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('store_id');
        }

        $this->putJson($this->adminPath($staff), [
            'store_id' => $active->store_id,
            'user_id' => $this->admin->id,
            'assigned_by_user_id' => $staff->id,
            'role_id' => $this->admin->role_id,
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'user_id', 'assigned_by_user_id', 'role_id',
        ]);

        $this->assertSame($active->store_id, $placement->fresh()->store_id);
    }

    public function test_supervisor_sees_own_staff_and_eligible_unassigned_workers(): void
    {
        $supervisor = $this->account('supervisor');
        $own = $this->account('inventory_worker');
        $foreign = $this->account('inventory_worker');
        $available = $this->account('inventory_worker');
        $this->account('inventory_worker', false);
        $this->account('supervisor');

        $first = $this->store('A');
        $second = $this->store('B');
        $this->assign($supervisor, $first);
        $this->assign($own, $first);
        $this->assign($foreign, $second);

        $this->actingAs($supervisor, 'web')
            ->getJson('/api/supervisor/staff')
            ->assertOk()
            ->assertJsonPath('store.store_id', $first->store_id)
            ->assertJsonCount(1, 'staff')
            ->assertJsonPath('staff.0.id', $own->id)
            ->assertJsonCount(1, 'available_staff')
            ->assertJsonPath('available_staff.0.id', $available->id)
            ->assertJsonMissing(['email' => $foreign->email]);

        $this->getJson('/api/supervisor/staff?store_id='.$second->store_id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('store_id');
    }

    public function test_supervisor_claims_worker_into_their_own_store(): void
    {
        $supervisor = $this->account('supervisor');
        $worker = $this->account('inventory_worker');
        $store = $this->store();
        $this->assign($supervisor, $store);

        $this->actingAs($supervisor, 'web')
            ->putJson($this->supervisorPath($worker), [])
            ->assertOk()
            ->assertJsonPath('assignment.store_id', $store->store_id)
            ->assertJsonPath('assignment.assigned_by_user_id', $supervisor->id);

        $this->assertSame($store->store_id, $worker->assignedStore()?->store_id);
        $this->assertDatabaseCount('staff_store_assignments', 2);
    }

    public function test_supervisor_cannot_take_another_stores_worker(): void
    {
        $supervisor = $this->account('supervisor');
        $worker = $this->account('inventory_worker');
        $first = $this->store('A');
        $second = $this->store('B');

        $this->assign($supervisor, $first);
        $placement = $this->assign($worker, $second);

        $this->actingAs($supervisor, 'web')
            ->putJson($this->supervisorPath($worker), [])
            ->assertStatus(409)
            ->assertJsonMissingPath('assignment');

        $this->assertSame($second->store_id, $placement->fresh()->store_id);
        $this->assertSame($this->admin->id, $placement->fresh()->assigned_by_user_id);
    }

    public function test_repeated_same_store_claim_preserves_the_assignment(): void
    {
        $supervisor = $this->account('supervisor');
        $worker = $this->account('inventory_worker');
        $store = $this->store();

        $this->assign($supervisor, $store);
        $placement = $this->assign($worker, $store);

        $this->actingAs($supervisor, 'web')
            ->putJson($this->supervisorPath($worker), [])
            ->assertOk()
            ->assertJsonPath('assignment.id', $placement->id)
            ->assertJsonPath('assignment.assigned_by_user_id', $this->admin->id);

        $this->assertDatabaseCount('staff_store_assignments', 2);
    }

    #[DataProvider('deniedStaffTargets')]
    public function test_supervisor_cannot_assign_ineligible_accounts(string $role, bool $approved): void
    {
        $supervisor = $this->account('supervisor');
        $target = $this->account($role, $approved);
        $this->assign($supervisor, $this->store());

        $this->actingAs($supervisor, 'web')
            ->putJson($this->supervisorPath($target), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('user');

        $this->assertDatabaseCount('staff_store_assignments', 1);
    }

    public function test_supervisor_cannot_submit_store_or_actor_overrides(): void
    {
        $supervisor = $this->account('supervisor');
        $worker = $this->account('inventory_worker');
        $this->assign($supervisor, $this->store('A'));
        $other = $this->store('B');

        $this->actingAs($supervisor, 'web')
            ->putJson($this->supervisorPath($worker), [
                'store_id' => $other->store_id,
                'user_id' => $this->admin->id,
                'assigned_by_user_id' => $this->admin->id,
                'role' => 'admin',
            ])->assertUnprocessable()->assertJsonValidationErrors([
                'store_id', 'user_id', 'assigned_by_user_id', 'role',
            ]);

        $this->assertDatabaseCount('staff_store_assignments', 1);
    }

    #[DataProvider('deniedStoreStates')]
    public function test_supervisor_requires_approval_and_an_active_store(string $state): void
    {
        $supervisor = $this->account('supervisor', $state !== 'unapproved');
        $worker = $this->account('inventory_worker');

        if ($state !== 'unassigned') {
            $store = $this->store();
            $this->assign($supervisor, $store);

            if ($state === 'inactive') {
                $store->update(['status' => Store::STATUS_INACTIVE]);
            }
        }

        $this->actingAs($supervisor, 'web')
            ->getJson('/api/supervisor/staff')
            ->assertForbidden();

        $this->putJson($this->supervisorPath($worker), [])->assertForbidden();
        $this->getJson('/api/staff/store')->assertForbidden();
    }

    #[DataProvider('staffRoles')]
    public function test_staff_resolves_only_their_own_current_store(string $role): void
    {
        $staff = $this->account($role);
        $other = $this->account('inventory_worker');
        $first = $this->store('A');
        $second = $this->store('B');

        $this->assign($staff, $first);
        $this->assign($other, $second);

        $this->actingAs($staff, 'web')
            ->getJson('/api/staff/store')
            ->assertOk()
            ->assertJsonPath('store.store_id', $first->store_id);

        $this->getJson('/api/staff/store?store_id='.$second->store_id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('store_id');

        $this->getJson('/api/staff/store?user_id='.$other->id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('user_id');
    }

    public function test_inventory_worker_without_an_active_approved_assignment_is_denied(): void
    {
        $worker = $this->account('inventory_worker');

        $this->actingAs($worker, 'web')
            ->getJson('/api/staff/store')
            ->assertForbidden();

        $store = $this->store();
        $this->assign($worker, $store);
        $store->update(['status' => Store::STATUS_INACTIVE]);

        $this->getJson('/api/staff/store')->assertForbidden();

        $store->update(['status' => Store::STATUS_ACTIVE]);
        $worker->forceFill(['staff_approved_at' => null])->save();

        $this->getJson('/api/staff/store')->assertForbidden();
        $this->assertDatabaseCount('staff_store_assignments', 1);
    }

    public function test_guests_cannot_use_any_assignment_endpoint(): void
    {
        $worker = $this->account('inventory_worker');
        $store = $this->store();

        $this->getJson('/api/admin/staff-store-assignments')->assertUnauthorized();

        $this->putJson($this->adminPath($worker), [
            'store_id' => $store->store_id,
        ])->assertUnauthorized();

        $this->getJson('/api/supervisor/staff')->assertUnauthorized();
        $this->putJson($this->supervisorPath($worker), [])->assertUnauthorized();
        $this->getJson('/api/staff/store')->assertUnauthorized();

        $this->assertDatabaseCount('staff_store_assignments', 0);
    }

    #[DataProvider('nonAdminRoles')]
    public function test_only_admin_manages_platform_assignments(string $role): void
    {
        $actor = $this->account($role);
        $worker = $this->account('inventory_worker');
        $store = $this->store();

        $this->actingAs($actor, 'web')
            ->getJson('/api/admin/staff-store-assignments')
            ->assertForbidden();

        $this->putJson($this->adminPath($worker), [
            'store_id' => $store->store_id,
        ])->assertForbidden();

        $this->assertDatabaseCount('staff_store_assignments', 0);
    }

    #[DataProvider('nonSupervisorRoles')]
    public function test_only_supervisors_can_use_supervisor_staff_endpoints(string $role): void
    {
        $actor = $role === 'admin' ? $this->admin : $this->account($role);
        $worker = $this->account('inventory_worker');

        $this->actingAs($actor, 'web')
            ->getJson('/api/supervisor/staff')
            ->assertForbidden();

        $this->putJson($this->supervisorPath($worker), [])->assertForbidden();
    }

    #[DataProvider('nonStaffRoles')]
    public function test_non_staff_roles_cannot_resolve_a_staff_store(string $role): void
    {
        $actor = $role === 'admin' ? $this->admin : $this->account($role);

        $this->actingAs($actor, 'web')
            ->getJson('/api/staff/store')
            ->assertForbidden();

        $this->assertNull($actor->assignedStore());
    }

    public function test_database_rejects_duplicate_user_assignments(): void
    {
        $worker = $this->account('inventory_worker');
        $this->assign($worker, $this->store('A'));
        $second = $this->store('B');

        $this->expectException(QueryException::class);

        $this->assign($worker, $second);
    }

    public function test_referenced_store_cannot_be_deleted(): void
    {
        $worker = $this->account('inventory_worker');
        $store = $this->store();
        $this->assign($worker, $store);

        $this->expectException(QueryException::class);

        $store->delete();
    }
}