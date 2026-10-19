<?php

namespace Tests\Feature;

use App\Models\Profile;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class AdminStaffTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(
            ':memory:',
            config('database.connections.sqlite.database')
        );
        $this->assertSame(
            ':memory:',
            DB::connection('sqlite')->getDatabaseName()
        );
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('mail.default'));

        $this->artisan('migrate', [
            '--database' => 'sqlite',
            '--force' => true,
        ])->assertExitCode(0);

        $this->seed(RoleSeeder::class);
        Notification::fake();
    }

    private function account(string $role): User
    {
        return User::factory()->unverified()->create([
            'role_id' => Role::where('slug', $role)->firstOrFail()->role_id,
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace([
            'first_name' => 'New',
            'last_name' => 'Staff',
            'email' => 'new-staff@example.test',
            'phone_number' => '09900000001',
            'address' => 'Test address',
            'role' => 'inventory_worker',
            'password' => 'ExamplePass123!',
            'password_confirmation' => 'ExamplePass123!',
        ], $overrides);
    }

    public static function staffRoles(): array
    {
        return [
            'inventory worker' => ['inventory_worker'],
            'supervisor' => ['supervisor'],
        ];
    }

    public static function nonAdminRoles(): array
    {
        return [
            'shopper' => ['shopper'],
            'inventory worker' => ['inventory_worker'],
            'supervisor' => ['supervisor'],
        ];
    }

    public static function otherRoles(): array
    {
        return [
            'shopper' => ['shopper'],
            'admin' => ['admin'],
        ];
    }

    #[DataProvider('staffRoles')]
    public function test_admin_creates_and_approves_staff(string $role): void
    {
        $admin = $this->account('admin');

        $this->actingAs($admin, 'web')
            ->postJson('/api/admin/staff', $this->payload(['role' => $role]))
            ->assertCreated()
            ->assertJsonPath('staff.role', $role)
            ->assertJsonPath('staff.approved', true)
            ->assertJsonPath('staff.approved_by_user_id', $admin->id)
            ->assertJsonPath('staff.profile.phone_number', '+639900000001')
            ->assertJsonMissingPath('staff.password')
            ->assertJsonMissingPath('staff.remember_token');

        $staff = User::where('email', 'new-staff@example.test')->firstOrFail();

        $this->assertTrue(Hash::check('ExamplePass123!', $staff->password));
        $this->assertTrue($staff->isApprovedStaff());
        $this->assertTrue($staff->staffApprover->is($admin));
        $this->assertFalse($staff->hasVerifiedEmail());
        $this->assertArrayNotHasKey('staff_approved_at', $staff->toArray());
        $this->assertArrayNotHasKey('staff_approved_by_user_id', $staff->toArray());
        $this->assertDatabaseCount('users', 2);
        $this->assertDatabaseCount('profiles', 1);
        Notification::assertNothingSent();
    }

    public function test_existing_staff_requires_explicit_admin_approval(): void
    {
        $staff = $this->account('inventory_worker');
        $admin = $this->account('admin');

        $this->assertFalse($staff->isApprovedStaff());

        $this->actingAs($admin, 'web')
            ->putJson('/api/admin/staff/'.$staff->id.'/approval', [])
            ->assertOk()
            ->assertJsonPath('staff.approved', true)
            ->assertJsonPath('staff.approved_by_user_id', $admin->id);

        $this->assertTrue($staff->fresh()->isApprovedStaff());
        $this->assertFalse($staff->fresh()->hasVerifiedEmail());
    }

    public function test_repeated_approval_preserves_the_original_approver(): void
    {
        $staff = $this->account('supervisor');
        $firstAdmin = $this->account('admin');
        $secondAdmin = $this->account('admin');

        $this->actingAs($firstAdmin, 'web')
            ->putJson('/api/admin/staff/'.$staff->id.'/approval', [])
            ->assertOk();

        $approvedAt = $staff->fresh()->getRawOriginal('staff_approved_at');
        $this->travel(5)->minutes();

        $this->actingAs($secondAdmin, 'web')
            ->putJson('/api/admin/staff/'.$staff->id.'/approval', [])
            ->assertOk()
            ->assertJsonPath('staff.approved_by_user_id', $firstAdmin->id);

        $this->assertSame(
            $approvedAt,
            $staff->fresh()->getRawOriginal('staff_approved_at')
        );
    }

    public function test_admin_lists_only_login_staff(): void
    {
        $worker = $this->account('inventory_worker');
        $supervisor = $this->account('supervisor');
        $admin = $this->account('admin');
        $this->account('shopper');

        $this->actingAs($admin, 'web')
            ->getJson('/api/admin/staff')
            ->assertOk()
            ->assertJsonCount(2, 'staff')
            ->assertJsonPath('staff.0.id', $worker->id)
            ->assertJsonPath('staff.0.approved', false)
            ->assertJsonPath('staff.1.id', $supervisor->id)
            ->assertJsonMissingPath('staff.0.password');
    }

    public function test_guests_cannot_manage_staff(): void
    {
        $staff = $this->account('inventory_worker');

        $this->getJson('/api/admin/staff')->assertUnauthorized();
        $this->postJson('/api/admin/staff', $this->payload())->assertUnauthorized();
        $this->putJson('/api/admin/staff/'.$staff->id.'/approval', [])
            ->assertUnauthorized();

        $this->assertDatabaseCount('users', 1);
        $this->assertFalse($staff->fresh()->isApprovedStaff());
    }

    #[DataProvider('nonAdminRoles')]
    public function test_other_roles_cannot_manage_staff(string $role): void
    {
        $actor = $this->account($role);
        $target = $this->account('inventory_worker');

        $this->actingAs($actor, 'web')
            ->getJson('/api/admin/staff')
            ->assertForbidden();

        $this->postJson('/api/admin/staff', $this->payload())
            ->assertForbidden();

        $this->putJson('/api/admin/staff/'.$target->id.'/approval', [])
            ->assertForbidden();

        $this->assertDatabaseCount('users', 2);
        $this->assertFalse($target->fresh()->isApprovedStaff());
    }

    #[DataProvider('otherRoles')]
    public function test_admin_cannot_create_other_roles_through_staff_endpoint(string $role): void
    {
        $admin = $this->account('admin');

        $this->actingAs($admin, 'web')
            ->postJson('/api/admin/staff', $this->payload(['role' => $role]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertDatabaseCount('users', 1);
    }

    #[DataProvider('otherRoles')]
    public function test_admin_cannot_approve_other_account_roles(string $role): void
    {
        $admin = $this->account('admin');
        $target = $this->account($role);

        $this->actingAs($admin, 'web')
            ->putJson('/api/admin/staff/'.$target->id.'/approval', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('user');

        $this->assertFalse($target->fresh()->isApprovedStaff());
    }

    public function test_duplicate_email_and_normalized_phone_are_rejected(): void
    {
        $admin = $this->account('admin');
        $this->actingAs($admin, 'web');

        $this->postJson('/api/admin/staff', $this->payload())->assertCreated();

        $this->postJson('/api/admin/staff', $this->payload([
            'phone_number' => '09900000002',
        ]))->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->postJson('/api/admin/staff', $this->payload([
            'email' => 'another-staff@example.test',
            'phone_number' => '+639900000001',
        ]))->assertUnprocessable()->assertJsonValidationErrors('phone_number');

        $this->assertDatabaseCount('users', 2);
        $this->assertDatabaseCount('profiles', 1);
    }

    public function test_invalid_fields_do_not_create_an_account(): void
    {
        $admin = $this->account('admin');

        $this->actingAs($admin, 'web')
            ->postJson('/api/admin/staff', $this->payload([
                'first_name' => '',
                'last_name' => str_repeat('x', 256),
                'email' => 'invalid',
                'phone_number' => '123',
                'password_confirmation' => 'different',
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'first_name', 'last_name', 'email', 'phone_number', 'password',
            ]);

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('profiles', 0);
    }

    public function test_creation_rejects_client_supplied_approval_fields(): void
    {
        $admin = $this->account('admin');

        $this->actingAs($admin, 'web')
            ->postJson('/api/admin/staff', $this->payload([
                'role_id' => $admin->role_id,
                'store_id' => 1,
                'email_verified_at' => now()->toDateTimeString(),
                'staff_approved_at' => now()->toDateTimeString(),
                'staff_approved_by_user_id' => $admin->id,
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'role_id', 'store_id', 'email_verified_at',
                'staff_approved_at', 'staff_approved_by_user_id',
            ]);

        $this->assertDatabaseCount('users', 1);
    }

    public function test_approval_rejects_client_supplied_metadata(): void
    {
        $admin = $this->account('admin');
        $target = $this->account('inventory_worker');

        $this->actingAs($admin, 'web')
            ->putJson('/api/admin/staff/'.$target->id.'/approval', [
                'role_id' => $admin->role_id,
                'staff_approved_at' => now()->toDateTimeString(),
                'staff_approved_by_user_id' => $target->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'role_id', 'staff_approved_at', 'staff_approved_by_user_id',
            ]);

        $this->assertFalse($target->fresh()->isApprovedStaff());
    }

    public function test_password_over_72_bytes_is_rejected(): void
    {
        $admin = $this->account('admin');
        $password = str_repeat('a', 73);

        $this->actingAs($admin, 'web')
            ->postJson('/api/admin/staff', $this->payload([
                'password' => $password,
                'password_confirmation' => $password,
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseCount('users', 1);
    }

    public function test_profile_failure_rolls_back_the_staff_account(): void
    {
        $admin = $this->account('admin');

        Profile::creating(function () {
            throw new RuntimeException('Simulated profile failure');
        });

        $this->withoutExceptionHandling();
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Simulated profile failure');

        try {
            $this->actingAs($admin, 'web')
                ->postJson('/api/admin/staff', $this->payload());
        } finally {
            $this->assertDatabaseCount('users', 1);
            $this->assertDatabaseCount('profiles', 0);
        }
    }
}