<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseSchemaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Always isolate schema tests from the developer's MySQL database.
        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.url' => null,
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.foreign_key_constraints' => true,
        ]);
        DB::purge('sqlite');

        $this->artisan('migrate', ['--no-interaction' => true])->assertSuccessful();
    }

    public function test_foreign_keys_reference_existing_columns_and_migrations_can_be_reversed(): void
    {
        foreach (Schema::getTableListing('main', schemaQualified: false) as $table) {
            foreach (Schema::getForeignKeys($table) as $key) {
                $this->assertTrue(
                    Schema::hasColumns($key['foreign_table'], $key['foreign_columns']),
                    "The foreign key in {$table} references missing columns."
                );
            }
        }

        $this->artisan('migrate:rollback', ['--no-interaction' => true])->assertSuccessful();
        $this->assertSame(['migrations'], Schema::getTableListing('main', schemaQualified: false));
        $this->artisan('migrate', ['--no-interaction' => true])->assertSuccessful();
        $this->assertTrue(Schema::hasTable('orders'));
    }

    public function test_cop_restrictions_require_an_existing_shopper(): void
    {
        $profileId = DB::table('profiles')->insertGetId([
            'first_name' => 'Test',
            'last_name' => 'Shopper',
            'email' => 'shopper@example.test',
            'phone_number' => '0000000000',
        ]);
        $shopperId = DB::table('grocer_users')->insertGetId([
            'profile_id' => $profileId,
            'password_hash' => password_hash('test-password', PASSWORD_BCRYPT),
        ]);

        DB::table('cop_restrictions')->insert(['user_id' => $shopperId]);
        $this->assertDatabaseHas('cop_restrictions', ['user_id' => $shopperId]);
        $this->assertDatabaseCount('users', 0);

        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23000');
        DB::table('cop_restrictions')->insert(['user_id' => $shopperId + 1]);
    }
}
