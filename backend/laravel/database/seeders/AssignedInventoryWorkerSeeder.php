<?php

namespace Database\Seeders;

use App\Models\AssignedInventoryWorker;
use App\Models\Profile;
use App\Models\Store;
use App\Models\SuperAdmin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AssignedInventoryWorkerSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            // Find the existing system administrator.
            $admin = SuperAdmin::query()
                ->where('role_type', 'Admin')
                ->firstOrFail();

            // Create the store owner's profile if it does not exist.
            $ownerProfile = Profile::query()->firstOrCreate(
                [
                    'email' => 'owner@grocerease.com',
                ],
                [
                    'first_name' => 'Roberto',
                    'last_name' => 'Owner',
                    'phone_number' => '09123456785',
                ]
            );

            // Create the owner record if it does not exist.
            $ownerId = DB::table('owners')
                ->where('profile_id', $ownerProfile->profile_id)
                ->value('owner_id');

            if (! $ownerId) {
                $ownerId = DB::table('owners')->insertGetId([
                    'profile_id' => $ownerProfile->profile_id,
                    'business_permit_no' => 'BP-2026-0001',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Create the store that the AIW will manage.
            $store = Store::query()->firstOrCreate(
                [
                    'store_name' => 'GrocerEase Main Store',
                ],
                [
                    'admin_id' => $admin->admin_id,
                    'owner_id' => $ownerId,
                    'address' => 'Talisay City, Cebu',
                ]
            );

            // Create the AIW profile if it does not exist.
            $inventoryWorkerProfile = Profile::query()->firstOrCreate(
                [
                    'email' => 'inventory@grocerease.com',
                ],
                [
                    'first_name' => 'Angela',
                    'last_name' => 'Inventory',
                    'phone_number' => '09123456786',
                ]
            );

            // Create the AIW login account.
            AssignedInventoryWorker::query()->firstOrCreate(
                [
                    'profile_id' => $inventoryWorkerProfile->profile_id,
                ],
                [
                    'store_id' => $store->store_id,
                    'password_hash' => Hash::make('password123'),
                    'status' => 'Active',
                ]
            );
        });
    }
}