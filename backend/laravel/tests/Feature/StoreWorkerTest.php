<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\User;
use App\Models\Worker;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StoreWorkerTest extends TestCase
{
    private User $admin;
    private User $supervisor;
    private User $otherSupervisor;
    private Store $first;
    private Store $second;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('mail.default'));
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->first = Store::create(['store_name' => 'Store A', 'address' => 'A']);
        $this->second = Store::create(['store_name' => 'Store B', 'address' => 'B']);
        $this->supervisor = $this->account('supervisor', $this->first);
        $this->otherSupervisor = $this->account('supervisor', $this->second);
    }

    private function account(string $role, ?Store $store = null): User
    {
        $user = User::factory()->create(['role_id' => Role::where('slug', $role)->firstOrFail()->role_id]);
        if (in_array($role, User::STAFF_ROLES, true)) $user->forceFill(['staff_approved_at' => now(), 'staff_approved_by_user_id' => $this->admin->id])->save();
        if ($store) StaffStoreAssignment::create(['user_id' => $user->id, 'store_id' => $store->store_id, 'assigned_by_user_id' => $this->admin->id]);
        return $user;
    }

    private function signIn(User $user): static
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'web');
    }

    private function createWorker(): int
    {
        return $this->signIn($this->supervisor)->postJson('/api/supervisor/workers', ['full_name' => 'Store A Picker', 'work_type' => 'picker_packer'])
            ->assertCreated()->json('worker.worker_id');
    }

    public function test_worker_is_store_personnel_without_any_authentication_account_or_new_role(): void
    {
        $users = User::count();
        $profiles = DB::table('profiles')->count();
        $id = $this->createWorker();
        $this->assertDatabaseHas('workers', ['worker_id' => $id, 'store_id' => $this->first->store_id, 'created_by_user_id' => $this->supervisor->id]);
        $this->assertSame($users, User::count());
        $this->assertSame($profiles, DB::table('profiles')->count());
        $this->assertDatabaseCount('roles', 4);
        $this->getJson('/api/supervisor/workers')->assertOk()->assertJsonCount(1, 'workers')
            ->assertJsonPath('workers.0.full_name', 'Store A Picker')->assertJsonMissingPath('workers.0.password');
    }

    public function test_foreign_supervisor_cannot_view_or_update_another_stores_worker(): void
    {
        $id = $this->createWorker();
        $this->signIn($this->otherSupervisor)->getJson('/api/supervisor/workers')->assertOk()->assertJsonCount(0, 'workers');
        $this->putJson('/api/supervisor/workers/'.$id, ['full_name' => 'Wrong', 'work_type' => 'packer', 'status' => 'inactive'])->assertNotFound();
        $this->assertSame('Store A Picker', Worker::findOrFail($id)->full_name);
    }

    public function test_metadata_edits_and_deactivation_preserve_worker_identity(): void
    {
        $id = $this->createWorker();
        $this->putJson('/api/supervisor/workers/'.$id, ['full_name' => 'Updated Picker', 'work_type' => 'picker', 'status' => 'inactive'])->assertOk();
        $this->getJson('/api/supervisor/workers')->assertOk()->assertJsonPath('workers.0.worker_id', $id)
            ->assertJsonPath('workers.0.status', 'inactive')->assertJsonPath('workers.0.full_name', 'Updated Picker');
        $this->assertDatabaseHas('workers', ['worker_id' => $id, 'updated_by_user_id' => $this->supervisor->id]);
        $this->assertDatabaseCount('workers', 1);
    }

    public function test_creation_rejects_credentials_authentication_roles_and_ownership_overrides(): void
    {
        $fields = ['store_id' => $this->second->store_id, 'user_id' => $this->admin->id, 'profile_id' => 1,
            'email' => 'worker@example.test', 'password' => 'secret', 'role' => 'inventory_worker',
            'created_by_user_id' => $this->admin->id, 'worker_incentives' => 100, 'order_handled' => 10];
        $this->signIn($this->supervisor)->postJson('/api/supervisor/workers', array_merge([
            'full_name' => 'Picker', 'work_type' => 'picker_packer',
        ], $fields))->assertUnprocessable()->assertJsonValidationErrors(array_keys($fields));
        $this->getJson('/api/supervisor/workers?store_id='.$this->second->store_id)->assertUnprocessable();
        $this->assertDatabaseCount('workers', 0);
    }

    public function test_invalid_personnel_fields_do_not_create_records(): void
    {
        $this->signIn($this->supervisor)->postJson('/api/supervisor/workers', [])->assertUnprocessable();
        $this->postJson('/api/supervisor/workers', ['full_name' => str_repeat('x', 151), 'work_type' => 'admin'])->assertUnprocessable();
        $this->assertDatabaseCount('workers', 0);
    }

    public function test_guest_other_roles_and_unapproved_or_unassigned_supervisors_are_denied(): void
    {
        $this->getJson('/api/supervisor/workers')->assertUnauthorized();
        $this->postJson('/api/supervisor/workers', [])->assertUnauthorized();
        foreach ([$this->admin, $this->account('shopper'), $this->account('inventory_worker')] as $user) {
            $this->signIn($user)->getJson('/api/supervisor/workers')->assertForbidden();
            $this->postJson('/api/supervisor/workers', [])->assertForbidden();
        }
        $this->supervisor->forceFill(['staff_approved_at' => null])->save();
        $this->signIn($this->supervisor)->getJson('/api/supervisor/workers')->assertForbidden();
        $this->signIn($this->account('supervisor'))->getJson('/api/supervisor/workers')->assertForbidden();
    }

    public function test_inactive_store_or_new_staff_placement_invalidates_previous_access(): void
    {
        $id = $this->createWorker();
        $this->first->update(['status' => 'inactive']);
        $this->getJson('/api/supervisor/workers')->assertForbidden();
        $this->first->update(['status' => 'active']);
        $this->supervisor->load('staffStoreAssignment.store');
        $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->second->store_id]);
        $this->signIn($this->supervisor)->getJson('/api/supervisor/workers')->assertOk()->assertJsonCount(0, 'workers');
        $this->putJson('/api/supervisor/workers/'.$id, ['full_name' => 'Moved', 'work_type' => 'packer', 'status' => 'active'])->assertNotFound();
    }
}
