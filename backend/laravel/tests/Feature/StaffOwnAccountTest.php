<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Hash;
use Tests\Support\TransactionTestCase;

class StaffOwnAccountTest extends TransactionTestCase
{
    public function test_staff_can_view_own_account_and_change_only_their_own_password_with_current_password(): void
    {
        $this->withHeaders(['Origin' => config('app.frontend_url')]);
        foreach ([[$this->inventoryWorker, 'inventory'], [$this->supervisor, 'supervisor'], [$this->admin, 'admin']] as [$user, $prefix]) {
            $this->flushSession();
            $this->app['auth']->shouldUse('web');
            $before = $this->shopper->fresh()->password;
            $this->signIn($user)->getJson('/api/user')->assertOk()->assertJsonPath('id', $user->id);
            $path = '/api/'.$prefix.'/password';
            $payload = ['current_password' => 'wrong', 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'];
            $this->putJson($path, $payload)->assertUnprocessable();
            $this->putJson($path, [...$payload, 'current_password' => 'password', 'user_id' => $this->shopper->id])->assertOk();
            $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));
            $this->assertSame($before, $this->shopper->fresh()->password);
        }
        $this->flushSession();
        $this->signIn($this->shopper)->putJson('/api/supervisor/password', [])->assertForbidden();
    }
}
