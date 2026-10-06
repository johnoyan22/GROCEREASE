<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;


class CredentialsAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $email = strtolower(trim('admin@grocerease.com'));
        $password = 'password123';
        $firstName = 'Lorem';
        $lastName = 'Ipsum';
        $phoneNumber = '09876312522';

        $adminRole = Role::where('slug', 'admin')->firstOrFail();

        $user = User::firstOrNew(['email' => $email]);
        $user->password = $password;
        $user->role()->associate($adminRole);
        $user->save();

        $user->profile()->updateOrCreate([], [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone_number' => $phoneNumber,
        ]);
    }
}
