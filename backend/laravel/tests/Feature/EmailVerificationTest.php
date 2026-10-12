<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Events\Verified;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use RuntimeException;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Guard the real database and prevent external mail before any writes.
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(
            ':memory:',
            config('database.connections.sqlite.database')
        );
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('mail.default'));

        $this->artisan('migrate', [
            '--database' => 'sqlite',
            '--force' => true,
        ])->assertExitCode(0);

        $this->seed(RoleSeeder::class);
        Notification::fake();

        // This route exists only inside these tests, not in the application.
        Route::get('/api/test/verified-only', function () {
            return response()->json(['allowed' => true]);
        })->middleware(['api', 'auth:sanctum', 'verified']);
    }

    private function registrationData(): array
    {
        return [
            'first_name' => 'Test',
            'last_name' => 'Shopper',
            'email' => 'email-verification-test@example.test',
            'phone_number' => '09900000001',
            'password' => 'ExamplePass123!',
            'password_confirmation' => 'ExamplePass123!',
            'agree_to_terms' => true,
        ];
    }

    private function verificationUrl(User $user, bool $expired = false): string
    {
        return URL::temporarySignedRoute(
            'verification.verify',
            $expired ? now()->subMinute() : now()->addHour(),
            [
                'id' => $user->id,
                'hash' => sha1($user->getEmailForVerification()),
            ]
        );
    }

    private function frontendUrl(string $path): string
    {
        return rtrim(config('app.frontend_url'), '/').$path;
    }

    public function test_registration_generates_verification_notification(): void
    {
        $this->postJson('/api/register', $this->registrationData())
            ->assertCreated()
            ->assertJsonPath('email_verification_required', true)
            ->assertJsonPath('verification_email_sent', true)
            ->assertJsonPath('user.email_verified_at', null)
            ->assertJsonPath('user.role.slug', 'shopper')
            ->assertJsonPath(
                'user.profile.phone_number',
                '+639900000001'
            )
            ->assertJsonMissingPath('user.password');

        $user = User::firstOrFail();

        $this->assertFalse($user->hasVerifiedEmail());
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('profiles', 1);

        Notification::assertSentTo(
            $user,
            VerifyEmail::class,
            function (VerifyEmail $notification, array $channels) use ($user) {
                $url = $notification->toMail($user)->actionUrl;

                $this->assertStringContainsString(
                    '/email/verify/'.$user->id.'/',
                    $url
                );
                $this->assertStringContainsString('signature=', $url);

                return in_array('mail', $channels, true);
            }
        );
    }

    public function test_notification_failure_does_not_undo_registration(): void
    {
        Notification::shouldReceive('send')
            ->once()
            ->andThrow(new RuntimeException('Simulated mail failure'));

        $this->postJson('/api/register', $this->registrationData())
            ->assertCreated()
            ->assertJsonPath('verification_email_sent', false)
            ->assertJsonPath('email_verification_required', true);

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('profiles', 1);
        $this->assertFalse(User::firstOrFail()->hasVerifiedEmail());
    }

    public function test_valid_link_verifies_the_authenticated_user(): void
    {
        Event::fake([Verified::class]);

        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'web')
            ->getJson($this->verificationUrl($user))
            ->assertOk()
            ->assertJsonPath('email_verified', true);

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        Event::assertDispatched(Verified::class);
    }

    public function test_already_verified_link_does_not_repeat_verified_event(): void
    {
        Event::fake([Verified::class]);

        $user = User::factory()->create();

        $this->actingAs($user, 'web')
            ->getJson($this->verificationUrl($user))
            ->assertOk()
            ->assertJsonPath('message', 'Your email is already verified.');

        Event::assertNotDispatched(Verified::class);
    }

    public function test_expired_and_tampered_links_do_not_verify_user(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'web');

        $urls = [
            $this->verificationUrl($user, true),
            $this->verificationUrl($user).'&unexpected=tampered',
        ];

        foreach ($urls as $url) {
            $this->getJson($url)->assertForbidden();
            $this->assertFalse($user->fresh()->hasVerifiedEmail());
        }
    }

    public function test_user_cannot_verify_using_another_accounts_link(): void
    {
        $user = User::factory()->unverified()->create();
        $otherUser = User::factory()->unverified()->create();

        $this->actingAs($user, 'web')
            ->getJson($this->verificationUrl($otherUser))
            ->assertForbidden();

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
        $this->assertFalse($otherUser->fresh()->hasVerifiedEmail());
    }

    public function test_browser_verification_redirects_to_frontend(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'web')
            ->get($this->verificationUrl($user))
            ->assertRedirect(
                $this->frontendUrl('/verify-email?status=verified')
            );

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }

    public function test_invalid_browser_link_redirects_without_verifying(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'web')
            ->get($this->verificationUrl($user).'&unexpected=tampered')
            ->assertRedirect(
                $this->frontendUrl('/verify-email?status=invalid')
            );

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_signed_out_browser_is_redirected_to_login(): void
    {
        $user = User::factory()->unverified()->create();

        $this->get($this->verificationUrl($user))
            ->assertRedirect(
                $this->frontendUrl('/login?verification=required')
            );

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_resend_is_authenticated_and_rate_limited(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'web')
            ->postJson('/api/email/verification-notification')
            ->assertOk()
            ->assertJsonPath('verification_email_sent', true);

        $this->postJson('/api/email/verification-notification')
            ->assertStatus(429)
            ->assertHeader('Retry-After');

        Notification::assertSentToTimes($user, VerifyEmail::class, 1);
        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_verified_user_does_not_receive_another_notification(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'web')
            ->postJson('/api/email/verification-notification')
            ->assertOk()
            ->assertJsonPath('email_verified', true)
            ->assertJsonPath('verification_email_sent', false);

        Notification::assertNothingSent();
    }

    public function test_guest_api_requests_return_unauthenticated_json(): void
    {
        $this->postJson('/api/email/verification-notification')
            ->assertUnauthorized();

        $this->get('/api/user')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');

        Notification::assertNothingSent();
    }

    public function test_resend_failure_returns_service_unavailable(): void
    {
        $user = User::factory()->unverified()->create();

        Notification::shouldReceive('send')
            ->once()
            ->andThrow(new RuntimeException('Simulated mail failure'));

        $this->actingAs($user, 'web')
            ->postJson('/api/email/verification-notification')
            ->assertStatus(503)
            ->assertJsonPath('verification_email_sent', false);

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_unverified_user_can_read_status_but_not_verified_route(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'web')
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('email_verified_at', null);

        $this->getJson('/email/verify')
            ->assertOk()
            ->assertJsonPath('email_verified', false);

        $this->getJson('/api/test/verified-only')
            ->assertForbidden();

        $user->markEmailAsVerified();

        $this->getJson('/api/test/verified-only')
            ->assertOk()
            ->assertJsonPath('allowed', true);
    }

    public function test_registration_requests_are_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 6; $attempt++) {
            $this->postJson('/api/register', [])
                ->assertStatus(422);
        }

        $this->postJson('/api/register', [])
            ->assertStatus(429)
            ->assertHeader('Retry-After');

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('profiles', 0);

        Notification::assertNothingSent();
    }

    public function test_migrated_schema_uses_email_verification_without_sms_storage(): void
    {
        $this->assertTrue(
            Schema::hasColumn('users', 'email_verified_at')
        );

        $this->assertTrue(
            Schema::hasColumn('profiles', 'phone_number')
        );

        $this->assertFalse(
            Schema::hasTable('phone_verifications')
        );

        $this->assertFalse(
            Schema::hasColumn('profiles', 'phone_verified_at')
        );

        $this->assertTrue(
            Schema::hasIndex(
                'profiles',
                'profiles_phone_number_unique',
                'unique'
            )
        );
    }
}
