<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class AccountStatusTest extends TransactionTestCase
{
    public function test_admin_deactivation_blocks_existing_session_and_tokens_without_changing_store_or_cop(): void
    {
        DB::table('personal_access_tokens')->insert(['tokenable_type' => User::class, 'tokenable_id' => $this->inventoryWorker->id,
            'name' => 'fixture', 'token' => hash('sha256', 'fixture'), 'abilities' => '["*"]', 'created_at' => now(), 'updated_at' => now()]);
        $assignment = $this->inventoryWorker->staffStoreAssignment->getAttributes();
        $this->signIn($this->admin)->putJson('/api/admin/accounts/'.$this->inventoryWorker->id.'/status', [
            'account_status' => 'inactive', 'reason' => 'Access suspended for review',
        ])->assertOk();
        $this->assertSame('active', $this->store->fresh()->status);
        $this->assertSame($assignment, $this->inventoryWorker->fresh()->staffStoreAssignment->getAttributes());
        $this->assertNotNull($this->inventoryWorker->fresh()->staff_approved_at);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseCount('cop_strikes', 0);
        $this->signIn($this->inventoryWorker)->getJson('/api/user')->assertForbidden();
        $this->getJson('/api/inventory/items')->assertForbidden();
        $this->getJson('/api/dashboard/summary')->assertForbidden();
        $this->assertDatabaseHas('account_status_logs', ['user_id' => $this->inventoryWorker->id,
            'changed_by_user_id' => $this->admin->id, 'previous_status' => 'active', 'new_status' => 'inactive']);
        $this->signIn($this->admin)->putJson('/api/admin/accounts/'.$this->inventoryWorker->id.'/status', [
            'account_status' => 'active', 'reason' => 'Review completed',
        ])->assertOk();
        $this->signIn($this->inventoryWorker)->getJson('/api/inventory/items')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0); // Reactivation never restores revoked credentials.
    }

    public function test_account_controls_require_admin_reason_and_preserve_own_active_admin(): void
    {
        $path = '/api/admin/accounts/'.$this->shopper->id.'/status';
        $payload = ['account_status' => 'inactive', 'reason' => 'Review'];
        $this->signIn($this->supervisor)->putJson($path, $payload)->assertForbidden();
        $this->signIn($this->shopper)->getJson('/api/admin/accounts')->assertForbidden();
        $this->signIn($this->admin)->putJson('/api/admin/accounts/'.$this->admin->id.'/status', $payload)->assertUnprocessable();
        $this->putJson($path, ['account_status' => 'inactive', 'reason' => ' '])->assertUnprocessable();
        $this->putJson($path, [...$payload, 'role_id' => 1, 'store_id' => 1])->assertUnprocessable();
        $this->assertDatabaseCount('account_status_logs', 0);
        $this->putJson($path, $payload)->assertOk();
        $this->putJson($path, $payload)->assertOk();
        $this->assertDatabaseCount('account_status_logs', 1);
    }

    public function test_inactive_login_is_rejected_and_store_deactivation_does_not_deactivate_an_account(): void
    {
        $this->shopper->forceFill(['account_status' => 'inactive'])->save();
        $this->app['auth']->forgetGuards(); auth('web')->logout();
        $this->withHeaders(['Origin' => config('app.frontend_url')]);
        $this->postJson('/api/login', ['email' => $this->shopper->email, 'password' => 'password'])->assertForbidden();
        $this->assertGuest('web');
        $this->store->update(['status' => 'inactive']);
        $this->signIn($this->inventoryWorker)->getJson('/api/user')->assertOk();
        $this->getJson('/api/inventory/items')->assertForbidden();
        $this->assertSame('active', $this->inventoryWorker->fresh()->account_status);
    }
}
