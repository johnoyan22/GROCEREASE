<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ShopperProfileTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(
            ':memory:',
            config('database.connections.sqlite.database')
        );
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('cache.default'));

        $this->artisan('migrate', [
            '--database' => 'sqlite',
            '--force' => true,
        ])->assertExitCode(0);

        $this->seed(RoleSeeder::class);
    }

    private function createAccount(
        string $roleSlug = 'shopper',
        string $phone = '+639900000001'
    ): User {
        $role = Role::where('slug', $roleSlug)->firstOrFail();

        $user = User::factory()->create([
            'role_id' => $role->role_id,
        ]);

        $user->profile()->create([
            'first_name' => 'Original',
            'last_name' => 'Shopper',
            'phone_number' => $phone,
            'address' => 'Original address',
        ]);

        return $user;
    }

    private function profileData(array $overrides = []): array
    {
        return array_replace([
            'first_name' => 'Updated',
            'last_name' => 'Name',
            'address' => 'Updated address',
        ], $overrides);
    }

    public function test_shopper_updates_only_their_own_profile(): void
    {
        $shopper = $this->createAccount();
        $other = $this->createAccount('shopper', '+639900000002');
        $originalUser = $shopper->fresh()->getAttributes();

        $this->actingAs($shopper, 'web')
            ->putJson('/api/shopper/profile', $this->profileData())
            ->assertOk()
            ->assertJsonPath('message', 'Profile updated successfully.')
            ->assertJsonPath('user.id', $shopper->id)
            ->assertJsonPath('user.profile.first_name', 'Updated')
            ->assertJsonPath('user.profile.last_name', 'Name')
            ->assertJsonPath('user.profile.address', 'Updated address')
            ->assertJsonPath(
                'user.profile.phone_number',
                '+639900000001'
            )
            ->assertJsonMissingPath('user.password');

        $this->assertDatabaseHas('profiles', [
            'user_id' => $shopper->id,
            'first_name' => 'Updated',
            'last_name' => 'Name',
            'address' => 'Updated address',
        ]);

        $this->assertDatabaseHas('profiles', [
            'user_id' => $other->id,
            'first_name' => 'Original',
            'last_name' => 'Shopper',
            'address' => 'Original address',
        ]);

        $this->assertSame(
            $originalUser,
            $shopper->fresh()->getAttributes()
        );
    }

    public function test_shopper_can_clear_their_address(): void
    {
        $shopper = $this->createAccount();

        $this->actingAs($shopper, 'web')
            ->putJson('/api/shopper/profile', $this->profileData([
                'address' => null,
            ]))
            ->assertOk()
            ->assertJsonPath('user.profile.address', null);

        $this->assertNull($shopper->profile()->firstOrFail()->address);
    }

    public function test_guest_cannot_update_a_profile(): void
    {
        $this->putJson('/api/shopper/profile', $this->profileData())
            ->assertUnauthorized();

        $this->assertDatabaseCount('profiles', 0);
    }

    public function test_unverified_shopper_cannot_update_a_profile(): void
    {
        $shopper = $this->createAccount();
        $shopper->forceFill(['email_verified_at' => null])->save();

        $this->actingAs($shopper, 'web')
            ->putJson('/api/shopper/profile', $this->profileData())
            ->assertForbidden();

        $this->assertSame(
            'Original',
            $shopper->profile()->firstOrFail()->first_name
        );
    }

    public static function staffRoles(): array
    {
        return [
            'inventory worker' => ['inventory_worker'],
            'supervisor' => ['supervisor'],
            'admin' => ['admin'],
        ];
    }

    #[DataProvider('staffRoles')]
    public function test_staff_cannot_use_the_shopper_endpoint(
        string $roleSlug
    ): void {
        $staff = $this->createAccount($roleSlug);

        $this->actingAs($staff, 'web')
            ->putJson('/api/shopper/profile', $this->profileData())
            ->assertForbidden();

        $this->assertSame(
            'Original',
            $staff->profile()->firstOrFail()->first_name
        );
    }

    public function test_invalid_profile_fields_do_not_save(): void
    {
        $shopper = $this->createAccount();

        $this->actingAs($shopper, 'web')
            ->putJson('/api/shopper/profile', [
                'first_name' => '',
                'last_name' => str_repeat('x', 256),
                'address' => ['invalid'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'first_name',
                'last_name',
                'address',
            ]);

        $this->assertSame(
            'Original',
            $shopper->profile()->firstOrFail()->first_name
        );
    }

    public function test_protected_account_fields_cannot_be_changed(): void
    {
        $shopper = $this->createAccount();
        $other = $this->createAccount('shopper', '+639900000002');
        $admin = Role::where('slug', 'admin')->firstOrFail();
        $originalUser = $shopper->fresh()->getAttributes();
        $originalProfile = $shopper->profile->getAttributes();

        $protectedFields = [
            'id' => $other->id,
            'user_id' => $other->id,
            'profile_id' => $other->profile->profile_id,
            'role' => 'admin',
            'role_id' => $admin->role_id,
            'email' => 'changed@example.test',
            'email_verified_at' => now()->toDateTimeString(),
            'phone_number' => '+639900000003',
            'password' => 'DifferentPass123!',
            'imagesrc' => 'unapproved-image.jpg',
        ];

        $this->actingAs($shopper, 'web')
            ->putJson(
                '/api/shopper/profile',
                $this->profileData($protectedFields)
            )
            ->assertUnprocessable()
            ->assertJsonValidationErrors(array_keys($protectedFields));

        $this->assertSame(
            $originalUser,
            $shopper->fresh()->getAttributes()
        );

        $this->assertSame(
            $originalProfile,
            $shopper->profile()->firstOrFail()->getAttributes()
        );
    }

    public function test_empty_protected_fields_do_not_clear_account_data(): void
    {
        $shopper = $this->createAccount();
        $originalUser = $shopper->fresh()->getAttributes();

        $this->actingAs($shopper, 'web')
            ->putJson('/api/shopper/profile', $this->profileData([
                'user_id' => null,
                'phone_number' => null,
                'email' => null,
                'role_id' => null,
            ]))
            ->assertOk();

        $this->assertDatabaseHas('profiles', [
            'user_id' => $shopper->id,
            'phone_number' => '+639900000001',
            'first_name' => 'Updated',
        ]);

        $this->assertSame(
            $originalUser,
            $shopper->fresh()->getAttributes()
        );
    }

    public function test_missing_profile_is_not_silently_created(): void
    {
        $shopper = User::factory()->create();

        $this->actingAs($shopper, 'web')
            ->putJson('/api/shopper/profile', $this->profileData())
            ->assertNotFound();

        $this->assertDatabaseCount('profiles', 0);
    }
}