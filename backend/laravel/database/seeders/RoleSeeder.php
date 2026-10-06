<?php

namespace Database\Seeders;
use App\Models\Role;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            [
                'name' => 'Shopper',
                'slug' => 'shopper',
                'description' => 'Customer account.',
            ],
            [
                'name' => 'Inventory Worker',
                'slug' => 'inventory_worker',
                'description' => 'Manages inventory.',
            ],
            [
                'name' => 'Supervisor',
                'slug' => 'supervisor',
                'description' => 'Supervise online store operation.',
            ],
            [
                'name' => 'Admin',
                'slug' => 'admin',
                'description' => 'System Administrators.',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['slug' => $role['slug']],
                $role
            );
        }
    }
}
