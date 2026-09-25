<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $defaultPassword = Hash::make('password123');

        // 1. inventory worker Profile og Account
        $workerProfileId = DB::table('profiles')->insertGetId([
            'first_name' => 'Juan',
            'last_name' => 'Worker',
            'email' => 'worker@grocerease.com',
            'phone_number' => '09123456781',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('workers')->insert([
            'profile_id' => $workerProfileId,
            'password_hash' => $defaultPassword,
            'worker_incentives' => 0.00,
            'order_handled' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. shopper profile og Account
        $shopperProfileId = DB::table('profiles')->insertGetId([
            'first_name' => 'Maria',
            'last_name' => 'Shopper',
            'email' => 'shopper@grocerease.com',
            'phone_number' => '09123456782',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('grocer_users')->insert([
            'profile_id' => $shopperProfileId,
            'password_hash' => $defaultPassword,
            'address' => 'Talisay City, Cebu',
            'date_created' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. supervisor profile og Account
        $supervisorProfileId = DB::table('profiles')->insertGetId([
            'first_name' => 'Carlos',
            'last_name' => 'Supervisor',
            'email' => 'supervisor@grocerease.com',
            'phone_number' => '09123456783',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('super_admins')->insert([
            'profile_id' => $supervisorProfileId,
            'password_hash' => $defaultPassword,
            'role_type' => 'Supervisor',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 4. admin profile og Account
        $adminProfileId = DB::table('profiles')->insertGetId([
            'first_name' => 'Admin',
            'last_name' => 'System',
            'email' => 'admin@grocerease.com',
            'phone_number' => '09123456784',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('super_admins')->insert([
            'profile_id' => $adminProfileId,
            'password_hash' => $defaultPassword,
            'role_type' => 'Admin',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->call(AssignedInventoryWorkerSeeder::class);
        $this->call(ProductSeeder::class);
    }
}
