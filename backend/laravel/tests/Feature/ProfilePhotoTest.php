<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfilePhotoTest extends TestCase
{
    use RefreshDatabase;

    private function photo(): \Illuminate\Http\Testing\File
    {
        // Real tiny PNG fixture; does not require the optional GD extension.
        return UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
    }

    private function shopper(string $slug = 'shopper'): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['role_id' => Role::where('slug', $slug)->value('role_id')]);
        $user->profile()->create(['first_name' => 'Ana', 'last_name' => 'Cruz', 'phone_number' => '+639'.random_int(100000000, 999999999)]);
        return $user;
    }

    public function test_photo_replacement_removal_and_private_ownership_preserve_account_fields(): void
    {
        Storage::fake('local');
        $owner = $this->shopper();
        $other = $this->shopper();
        $before = $owner->fresh()->getAttributes();
        $photo = $this->photo();
        $this->actingAs($owner, 'web')->post('/api/shopper/profile/photo', ['photo' => $photo])
            ->assertOk()->assertJsonPath('user.profile.first_name', 'Ana');
        $path = $owner->profile()->first()->imagesrc;
        Storage::disk('local')->assertExists($path);
        $this->get('/api/shopper/profile/photo')->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->app['auth']->forgetGuards();
        $this->actingAs($other, 'web')->get('/api/shopper/profile/photo')->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->actingAs($owner, 'web')->post('/api/shopper/profile/photo', ['photo' => $this->photo()])->assertOk();
        Storage::disk('local')->assertMissing($path);
        $this->deleteJson('/api/shopper/profile/photo')->assertOk()->assertJsonPath('user.profile.image_url', null);
        $this->assertSame($before, $owner->fresh()->getAttributes());
        $this->assertNull($other->profile()->first()->imagesrc);
    }

    public function test_invalid_images_and_identity_overrides_are_rejected(): void
    {
        Storage::fake('local');
        $this->actingAs($this->shopper(), 'web');
        $this->post('/api/shopper/profile/photo', ['photo' => UploadedFile::fake()->create('bad.php', 1, 'application/x-php')], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->post('/api/shopper/profile/photo', ['photo' => $this->photo()->size(2049)], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->post('/api/shopper/profile/photo', ['photo' => $this->photo(), 'user_id' => 999], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertCount(0, Storage::disk('local')->allFiles());
    }

    public function test_guests_staff_and_unverified_shoppers_cannot_upload(): void
    {
        $this->postJson('/api/shopper/profile/photo')->assertUnauthorized();
        $this->actingAs($this->shopper('inventory_worker'), 'web')->postJson('/api/shopper/profile/photo')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $shopper = $this->shopper();
        $shopper->forceFill(['email_verified_at' => null])->save();
        $this->actingAs($shopper, 'web')->postJson('/api/shopper/profile/photo')->assertForbidden();
    }
}
