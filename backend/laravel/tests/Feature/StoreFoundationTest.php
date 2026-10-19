<?php

namespace Tests\Feature;

use App\Models\Store;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StoreFoundationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Stop before migrations if the test environment is unsafe.
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
    }

    public function test_store_persists_with_its_custom_primary_key(): void
    {
        $store = Store::create([
            'store_name' => 'Test Grocery',
            'address' => 'Test Address, Cebu City',
        ]);

        $this->assertSame('store_id', $store->getKeyName());
        $this->assertNotNull($store->getKey());
        $this->assertSame(
            $store->store_id,
            Store::findOrFail($store->store_id)->store_id
        );
        $this->assertSame(Store::STATUS_ACTIVE, $store->fresh()->status);
        $this->assertNotNull($store->fresh()->created_at);
        $this->assertDatabaseHas('stores', [
            'store_id' => $store->store_id,
            'store_name' => 'Test Grocery',
        ]);
    }

    public function test_same_named_branches_have_separate_identities(): void
    {
        $first = Store::create([
            'store_name' => 'Shared Grocery Name',
            'address' => 'Branch A Address',
        ]);

        $second = Store::create([
            'store_name' => 'Shared Grocery Name',
            'address' => 'Branch B Address',
        ]);

        $this->assertNotSame($first->store_id, $second->store_id);
        $this->assertSame(
            'Branch A Address',
            $first->fresh()->address
        );
        $this->assertSame(
            'Branch B Address',
            $second->fresh()->address
        );
        $this->assertDatabaseCount('stores', 2);
    }

    public function test_deactivation_preserves_the_store_record(): void
    {
        $active = Store::create([
            'store_name' => 'Active Grocery',
            'address' => 'Active Address',
        ]);

        $inactive = Store::create([
            'store_name' => 'Other Grocery',
            'address' => 'Other Address',
        ]);

        $inactive->update(['status' => Store::STATUS_INACTIVE]);

        $this->assertDatabaseCount('stores', 2);
        $this->assertSame(
            Store::STATUS_INACTIVE,
            Store::findOrFail($inactive->store_id)->status
        );
        $this->assertSame(
            [$active->store_id],
            Store::active()->pluck('store_id')->all()
        );
    }

    public function test_database_rejects_an_unknown_store_status(): void
    {
        $this->expectException(QueryException::class);

        Store::create([
            'store_name' => 'Invalid Grocery',
            'address' => 'Test Address',
            'status' => 'unknown',
        ]);
    }
}