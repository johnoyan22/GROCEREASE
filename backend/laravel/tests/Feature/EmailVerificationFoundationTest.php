<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmailVerificationFoundationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(
            ':memory:',
            config('database.connections.sqlite.database')
        );

        $this->artisan('migrate', [
            '--database' => 'sqlite',
            '--force' => true,
        ])->assertExitCode(0);

        $this->seed(RoleSeeder::class);
    }

    public function test_unverified_user_has_correct_verification_state(): void
    {
        $this->assertTrue(
            Schema::hasColumn('users', 'email_verified_at')
        );

        $user = User::factory()->unverified()->create();

        $this->assertInstanceOf(MustVerifyEmail::class, $user);
        $this->assertNull($user->email_verified_at);
        $this->assertFalse($user->hasVerifiedEmail());
        $this->assertSame('shopper', $user->role->slug);
        $this->assertArrayNotHasKey('password', $user->toArray());
    }

    public function test_default_factory_creates_a_verified_test_fixture(): void
    {
        $user = User::factory()->create();

        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue($user->hasVerifiedEmail());
    }

    public function test_registration_rejects_client_supplied_verification(): void
    {
        $this->postJson('/api/register', [
            'first_name' => 'Test',
            'last_name' => 'Shopper',
            'email' => 'verification-test@example.com',
            'phone_number' => '+639900000001',
            'password' => 'ExamplePass123!',
            'password_confirmation' => 'ExamplePass123!',
            'agree_to_terms' => true,
            'email_verified_at' => now()->toDateTimeString(),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email_verified_at']);

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('profiles', 0);
    }

    public function test_phone_number_remains_unique(): void
    {
        $firstUser = User::factory()->unverified()->create();
        $secondUser = User::factory()->unverified()->create();

        $profileData = [
            'first_name' => 'Test',
            'last_name' => 'Shopper',
            'phone_number' => '+639900000001',
        ];

        $firstUser->profile()->create($profileData);

        $this->expectException(
            UniqueConstraintViolationException::class
        );

        $secondUser->profile()->create($profileData);
    }
}
