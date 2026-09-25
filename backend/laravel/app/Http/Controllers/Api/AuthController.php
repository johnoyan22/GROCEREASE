<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Create Account (Shopper Registration)
     */
    public function registerShopper(Request $request)
    {
        $validated = $request->validate([
            'first_name'   => 'required|string|max:100',
            'last_name'    => 'required|string|max:100',
            'email'        => 'required|email|unique:profiles,email',
            'phone_number' => 'required|string|max:20',
            'password'     => 'required|string|min:6',
            'address'      => 'nullable|string|max:255',
        ]);

        return DB::transaction(function () use ($validated) {
            $profileId = DB::table('profiles')->insertGetId([
                'first_name'   => $validated['first_name'],
                'last_name'    => $validated['last_name'],
                'email'        => $validated['email'],
                'phone_number' => $validated['phone_number'],
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);

            $userId = DB::table('users')->insertGetId([
                'profile_id'    => $profileId,
                'password_hash' => Hash::make($validated['password']),
                'address'       => $validated['address'] ?? null,
                'date_created'  => now(),
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);

            return response()->json([
                'message' => 'Shopper account created successfully.',
                'user_id' => $userId,
                'profile_id' => $profileId,
            ], 201);
        });
    }

    /**
     * Module: Create Account (Admin creating Worker or Supervisor)
     */
    public function createStaffAccount(Request $request)
    {
        $validated = $request->validate([
            'role'         => 'required|in:worker,supervisor,admin',
            'first_name'   => 'required|string|max:100',
            'last_name'    => 'required|string|max:100',
            'email'        => 'required|email|unique:profiles,email',
            'phone_number' => 'required|string|max:20',
            'password'     => 'required|string|min:6',
        ]);

        return DB::transaction(function () use ($validated) {
            $profileId = DB::table('profiles')->insertGetId([
                'first_name'   => $validated['first_name'],
                'last_name'    => $validated['last_name'],
                'email'        => $validated['email'],
                'phone_number' => $validated['phone_number'],
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);

            $hashedPassword = Hash::make($validated['password']);

            if ($validated['role'] === 'worker') {
                $staffId = DB::table('workers')->insertGetId([
                    'profile_id'        => $profileId,
                    'worker_incentives' => 0.00,
                    'order_handled'     => 0,
                    'created_at'        => now(),
                    'updated_at'        => now(),
                ]);
            } else {
                $roleType = $validated['role'] === 'admin' ? 'Admin' : 'Supervisor';
                $staffId = DB::table('super_admins')->insertGetId([
                    'profile_id'    => $profileId,
                    'password_hash' => $hashedPassword,
                    'role_type'     => $roleType,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ]);
            }

            return response()->json([
                'message'    => ucfirst($validated['role']) . ' account created successfully.',
                'staff_id'   => $staffId,
                'profile_id' => $profileId,
                'role'       => $validated['role'],
            ], 201);
        });
    }

    /**
     * Module: Login / Sign In (Supports Shopper, Worker, Supervisor, Admin)
     */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $profile = DB::table('profiles')->where('email', $request->email)->first();

        if (!$profile) {
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }

        // Determine user role and verify password
        $role = null;
        $account = null;

        // Check SuperAdmin / Supervisor
        $admin = DB::table('super_admins')->where('profile_id', $profile->profile_id)->first();
        if ($admin && Hash::check($request->password, $admin->password_hash)) {
            $role = strtolower($admin->role_type); // 'admin' or 'supervisor'
            $account = $admin;
        }

        // Check Worker
        if (!$role) {
            $worker = DB::table('workers')->where('profile_id', $profile->profile_id)->first();
            // Workers default to matching default password if using profile login
            if ($worker && Hash::check($request->password, Hash::make('password123'))) {
                $role = 'worker';
                $account = $worker;
            }
        }

        // Check Shopper
        if (!$role) {
            $shopper = DB::table('users')->where('profile_id', $profile->profile_id)->first();
            if ($shopper && Hash::check($request->password, $shopper->password_hash)) {
                $role = 'shopper';
                $account = $shopper;
            }
        }

        if (!$role) {
            throw ValidationException::withMessages(['password' => ['Invalid email or password.']]);
        }

        return response()->json([
            'message' => 'Login successful',
            'role'    => $role,
            'profile' => [
                'profile_id'   => $profile->profile_id,
                'first_name'   => $profile->first_name,
                'last_name'    => $profile->last_name,
                'email'        => $profile->email,
                'phone_number' => $profile->phone_number,
            ],
            'account' => $account,
        ]);
    }
}