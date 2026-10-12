<?php

namespace Tests\Feature;

use App\Models\Profile;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class AuthenticationRegressionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(
            ':memory:',
            config('database.connections.sqlite.database')
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

        $this->withHeaders([
            'Origin' => config('app.frontend_url'),
        ]);
    }

    public static function phoneInputs(): array
    {
        return [
            'local format' => ['09900000001'],
            'international format' => ['+639900000001'],
        ];
    }

    public static function roles(): array
    {
        return [
            'shopper' => ['shopper'],
            'inventory worker' => ['inventory_worker'],
            'supervisor' => ['supervisor'],
            'admin' => ['admin'],
        ];
    }

    private function registrationData(array $overrides = []): array
    {
        return array_replace([
            'first_name' => 'Test',
            'last_name' => 'Shopper',
            'email' => 'regression-test@example.test',
            'phone_number' => '09900000001',
            'password' => 'ExamplePass123!',
            'password_confirmation' => 'ExamplePass123!',
            'agree_to_terms' => true,
        ], $overrides);
    }

    private function createAccount(string $roleSlug = 'shopper'): User
    {
        $role = Role::where('slug', $roleSlug)->firstOrFail();

        $user = User::factory()->unverified()->create([
            'role_id' => $role->role_id,
        ]);

        $user->profile()->create([
            'first_name' => 'Test',
            'last_name' => 'Account',
            'phone_number' => '+639900000001',
        ]);

        return $user;
    }

    #[DataProvider('phoneInputs')]
    public function test_registration_normalizes_phone_and_hashes_password(
        string $phone
    ): void {
        $this->postJson('/api/register', $this->registrationData([
            'phone_number' => $phone,
        ]))
            ->assertCreated()
            ->assertJsonPath(
                'user.profile.phone_number',
                '+639900000001'
            )
            ->assertJsonPath('user.role.slug', 'shopper')
            ->assertJsonMissingPath('user.password');

        $user = User::firstOrFail();

        $this->assertTrue(
            Hash::check('ExamplePass123!', $user->password)
        );
        $this->assertFalse($user->hasVerifiedEmail());
        $this->assertSame($user->id, $user->profile->user_id);
        $this->assertNull($user->profile->address);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('profiles', 1);
    }

    public function test_duplicate_email_does_not_create_another_account(): void
    {
        $existing = $this->createAccount();

        $this->postJson('/api/register', $this->registrationData([
            'email' => $existing->email,
            'phone_number' => '+639900000002',
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('profiles', 1);
        Notification::assertNothingSent();
    }

    #[DataProvider('phoneInputs')]
    public function test_duplicate_phone_is_rejected_in_both_formats(
        string $phone
    ): void {
        $this->createAccount();

        $this->postJson('/api/register', $this->registrationData([
            'phone_number' => $phone,
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['phone_number']);

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('profiles', 1);
        Notification::assertNothingSent();
    }

    public function test_public_registration_rejects_client_selected_roles(): void
    {
        $adminRole = Role::where('slug', 'admin')->firstOrFail();

        $this->postJson('/api/register', $this->registrationData([
            'role' => 'admin',
            'role_id' => $adminRole->role_id,
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['role', 'role_id']);

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('profiles', 0);
        Notification::assertNothingSent();
    }

    public function test_profile_failure_rolls_back_user_creation(): void
    {
        Profile::creating(function () {
            throw new RuntimeException('Simulated profile failure');
        });

        $this->withoutExceptionHandling();
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Simulated profile failure');

        try {
            $this->postJson('/api/register', $this->registrationData());
        } finally {
            $this->assertDatabaseCount('users', 0);
            $this->assertDatabaseCount('profiles', 0);
            Notification::assertNothingSent();
        }
    }

    #[DataProvider('roles')]
    public function test_all_four_roles_can_authenticate(
        string $roleSlug
    ): void {
        $user = $this->createAccount($roleSlug);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role.slug', $roleSlug)
            ->assertJsonPath('user.email_verified_at', null)
            ->assertJsonMissingPath('user.password');

        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_incorrect_password_does_not_authenticate(): void
    {
        $user = $this->createAccount();

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'incorrect-password',
        ])->assertUnauthorized();

        $this->assertGuest('web');
    }

    public function test_logout_invalidates_the_authenticated_session(): void
    {
        $user = $this->createAccount();

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $sessionId = $this->app['session']->driver()->getId();
        $this->withCookie(config('session.cookie'), $sessionId);

        // Separate browser requests do not share an in-memory auth guard.
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('id', $user->id);

        $this->app['auth']->forgetGuards();

        $this->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertGuest('web');
        $this->app['auth']->forgetGuards();

        // Reusing the old cookie must not restore the logged-out account.
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_signed_out_users_cannot_use_authenticated_endpoints(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
        $this->postJson('/api/logout')->assertUnauthorized();
        $this->postJson('/api/email/verification-notification')
            ->assertUnauthorized();

        Notification::assertNothingSent();
    }
}