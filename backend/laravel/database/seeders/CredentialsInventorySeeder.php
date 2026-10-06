<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CredentialsInventorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $email = strtolower(trim('inventory@grocerease.com'));
        $password = 'password123';
        $firstName = 'Hal';
        $lastName = 'Jordan';
        $phoneNumber = '09198752311';

        $inventoryRole = Role::where('slug', 'inventory_worker')->firstOrFail();

        $user = User::firstOrNew(['email' => $email]);
        $user->password = $password;
        $user->role()->associate($inventoryRole);
        $user->save();

        $user->profile()->updateOrCreate([], [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone_number' => $phoneNumber,
        ]);
    }
}
