<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CredentialsSupervisorSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $email = strtolower(trim('supervisor@grocerease.com'));
        $password = 'password123';
        $firstName = 'Miguel';
        $lastName = 'Ohara';
        $phoneNumber = '09198752311';

        $supervisorRole = Role::where('slug', 'supervisor')->firstOrFail();

        $user = User::firstOrNew(['email' => $email]);
        $user->password = $password;
        $user->role()->associate($supervisorRole);
        $user->save();

        $user->profile()->updateOrCreate([], [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone_number' => $phoneNumber,
        ]);
    }
}
