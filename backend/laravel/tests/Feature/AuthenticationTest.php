<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_shopper_can_register_and_login_with_a_sanctum_token(): void
    {
        $registration = $this->postJson('/api/register/shopper', [
            'first_name' => 'Ana',
            'last_name' => 'Buyer',
            'email' => 'ANA@example.test',
            'phone_number' => '09123456789',
            'password' => 'secret123',
            'address' => 'Cebu City',
        ]);

        $registration
            ->assertCreated()
            ->assertJsonStructure(['message', 'user_id', 'profile_id']);

        $this->assertDatabaseHas('profiles', ['email' => 'ana@example.test']);
        $this->assertDatabaseMissing('users', ['email' => 'ana@example.test']);

        $passwordHash = (string) $this->getConnection()
            ->table('grocer_users')
            ->value('password_hash');
        $this->assertTrue(Hash::check('secret123', $passwordHash));

        $login = $this->postJson('/api/login', [
            'email' => 'ANA@example.test',
            'password' => 'secret123',
        ]);

        $login
            ->assertOk()
            ->assertJsonPath('role', 'shopper')
            ->assertJsonPath('profile.email', 'ana@example.test')
            ->assertJsonStructure(['token', 'token_type', 'profile', 'account']);

        $this->withToken($login->json('token'))
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('role', 'shopper');
    }

    public function test_all_seeded_roles_can_login(): void
    {
        $this->seed();

        foreach ([
            'worker@grocerease.com' => 'worker',
            'shopper@grocerease.com' => 'shopper',
            'supervisor@grocerease.com' => 'supervisor',
            'admin@grocerease.com' => 'admin',
        ] as $email => $role) {
            $this->postJson('/api/login', [
                'email' => $email,
                'password' => 'password123',
            ])
                ->assertOk()
                ->assertJsonPath('role', $role)
                ->assertJsonStructure(['token']);
        }
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $this->postJson('/api/login', [
            'email' => 'missing@example.test',
            'password' => 'incorrect',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_only_an_authenticated_admin_can_create_staff(): void
    {
        $this->seed();

        $staff = [
            'role' => 'worker',
            'first_name' => 'New',
            'last_name' => 'Worker',
            'email' => 'new.worker@example.test',
            'phone_number' => '09999999999',
            'password' => 'worker-password',
        ];

        $this->postJson('/api/register/staff', $staff)->assertUnauthorized();

        $shopperToken = $this->loginToken('shopper@grocerease.com');
        $this->withToken($shopperToken)
            ->postJson('/api/register/staff', $staff)
            ->assertForbidden();

        $this->app['auth']->forgetGuards();
        $adminToken = $this->loginToken('admin@grocerease.com');
        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->postJson('/api/register/staff', $staff)
            ->assertCreated()
            ->assertJsonPath('role', 'worker');

        $this->postJson('/api/login', [
            'email' => $staff['email'],
            'password' => $staff['password'],
        ])
            ->assertOk()
            ->assertJsonPath('role', 'worker');
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $this->seed();
        $token = $this->loginToken('shopper@grocerease.com');

        $this->withToken($token)
            ->postJson('/api/logout')
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->getJson('/api/user')
            ->assertUnauthorized();
    }

    public function test_assigned_inventory_worker_can_login(): void
    {
        $this->seed();

        $login = $this->postJson('/api/login', [
            'email' => 'inventory@grocerease.com',
            'password' => 'password123',
        ]);

        $login
            ->assertOk()
            ->assertJsonPath('role', 'inventory_worker')
            ->assertJsonPath('profile.email', 'inventory@grocerease.com')
            ->assertJsonPath('account.status', 'Active')
            ->assertJsonStructure([
                'message',
                'token',
                'token_type',
                'profile',
                'account' => [
                    'inventory_worker_id',
                    'store_id',
                    'status',
                ],
            ]);
    }

    private function loginToken(string $email): string
    {
        return (string) $this->postJson('/api/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('token');
    }


}
