<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CredentialsShopperSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $email = strtolower(trim('shopper@grocerease.com'));
        $password = 'password123';
        $firstName = 'Antonio';
        $lastName = 'Ilogaena';
        $phoneNumber = '09923145523';

        $shopperRole = Role::where('slug', 'shopper')->firstOrFail();

        $user = User::firstOrNew(['email' => $email]);
        $user->password = $password;
        $user->role()->associate($shopperRole);
        $user->save();

        $user->profile()->updateOrCreate([], [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone_number' => $phoneNumber,
        ]);
    }
}
