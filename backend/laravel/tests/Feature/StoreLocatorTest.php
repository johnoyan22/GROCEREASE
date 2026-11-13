<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\TransactionTestCase;

class StoreLocatorTest extends TransactionTestCase
{
    private function payload(array $extra = []): array
    {
        // Coordinates are synthetic test fixtures, not claimed real stores.
        return [...['latitude' => 10.3, 'longitude' => 123.9, 'verified' => true,
            'expected_address' => $this->store->address, 'verification_note' => 'Authorized test address fixture.'], ...$extra];
    }

    private function endpoint(): string { return '/api/admin/stores/'.$this->store->store_id.'/map-location'; }

    public function test_public_locator_exposes_only_verified_active_registered_stores_and_public_fields(): void
    {
        $this->signIn($this->admin)->putJson($this->endpoint(), $this->payload())->assertOk();
        $this->app['auth']->forgetGuards(); $this->app['auth']->guard('web')->logout();
        $response = $this->getJson('/api/public/store-locations')->assertOk()->assertJsonPath('available', true)->assertJsonCount(1, 'stores');
        $this->assertSame(['store_id', 'store_name', 'address', 'latitude', 'longitude'], array_keys($response->json('stores.0')));
        $this->assertSame($this->store->store_id, $response->json('stores.0.store_id'));
        $this->store->forceFill(['status' => 'inactive'])->save();
        $this->getJson('/api/public/store-locations')->assertOk()->assertJsonCount(0, 'stores');
    }

    public function test_admin_saves_audited_location_without_changing_store_inventory_or_order(): void
    {
        $before = [$this->store->fresh()->getAttributes(), $this->inventory->fresh()->getAttributes(), DB::table('orders')->get()->toJson()];
        $this->signIn($this->admin)->putJson($this->endpoint(), $this->payload())->assertOk()->assertJsonPath('location.verified', true);
        $this->assertSame($before, [$this->store->fresh()->getAttributes(), $this->inventory->fresh()->getAttributes(), DB::table('orders')->get()->toJson()]);
        $this->assertDatabaseHas('store_locations', ['store_id' => $this->store->store_id, 'verified_by_user_id' => $this->admin->id]);
        $this->assertDatabaseHas('store_location_audits', ['store_id' => $this->store->store_id, 'actor_user_id' => $this->admin->id]);
        $this->putJson($this->endpoint(), $this->payload(['verified' => false]))->assertOk()->assertJsonPath('location.verified', false);
        $this->getJson('/api/public/store-locations')->assertOk()->assertJsonCount(0, 'stores');
        $this->assertDatabaseCount('store_location_audits', 2);
    }

    public function test_changed_addresses_hide_pins_and_stale_verification_cannot_publish_them(): void
    {
        $this->signIn($this->admin)->putJson($this->endpoint(), $this->payload())->assertOk();
        $this->store->forceFill(['address' => 'A new pickup address'])->save();
        $this->getJson('/api/public/store-locations')->assertOk()->assertJsonCount(0, 'stores');
        $this->getJson($this->endpoint())->assertOk()->assertJsonPath('location.address_changed', true)->assertJsonPath('location.verified', false);
        $this->putJson($this->endpoint(), $this->payload(['expected_address' => 'A']))->assertStatus(409);
        $this->assertDatabaseCount('store_location_audits', 1);
        $this->putJson($this->endpoint(), $this->payload())->assertOk();
        $this->getJson('/api/public/store-locations')->assertOk()->assertJsonCount(1, 'stores');
    }

    public function test_coordinates_notes_and_actor_are_validated(): void
    {
        $this->signIn($this->admin);
        foreach ([['latitude' => 90.1], ['longitude' => -180.1], ['latitude' => null], ['longitude' => 'bad'], ['verification_note' => ''], ['verified_by_user_id' => $this->shopper->id], ['store_id' => $this->otherStore->store_id]] as $invalid) {
            $this->putJson($this->endpoint(), $this->payload($invalid))->assertUnprocessable();
        }
        $this->assertDatabaseCount('store_locations', 0);
        $this->assertDatabaseCount('store_location_audits', 0);
    }

    public function test_location_management_requires_admin_and_unknown_ids_are_not_created(): void
    {
        foreach ([$this->shopper, $this->supervisor, $this->inventoryWorker] as $user) {
            $this->signIn($user)->getJson($this->endpoint())->assertForbidden();
            $this->putJson($this->endpoint(), $this->payload())->assertForbidden();
        }
        $this->app['auth']->forgetGuards(); $this->app['auth']->guard('web')->logout();
        $this->putJson($this->endpoint(), $this->payload())->assertUnauthorized();
        $this->signIn($this->admin)->putJson('/api/admin/stores/999999/map-location', $this->payload())->assertNotFound();
        $this->assertDatabaseCount('store_locations', 0);
    }

    public function test_location_migration_is_additive_and_missing_setup_remains_friendly(): void
    {
        $migration = require database_path('migrations/2026_11_13_000021_create_verified_store_locations.php');
        $migration->down();
        $snapshots = [];
        foreach (Schema::getTableListing() as $table) if ($table !== 'sqlite_sequence') $snapshots[$table] = DB::table($table)->get()->toJson();
        $this->getJson('/api/public/store-locations')->assertOk()->assertJsonPath('available', false)->assertJsonCount(0, 'stores');
        $this->signIn($this->admin)->getJson($this->endpoint())->assertStatus(503)->assertJsonPath('message', 'Store locator setup is pending. Existing store management remains available.');
        $this->getJson('/api/admin/stores')->assertOk();
        $migration->up();
        foreach ($snapshots as $table => $before) $this->assertSame($before, DB::table($table)->get()->toJson(), $table.' changed');
        $this->assertDatabaseCount('store_locations', 0); $this->assertDatabaseCount('store_location_audits', 0);
    }
}
