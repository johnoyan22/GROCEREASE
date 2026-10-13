<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ShopperProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'address' => ['present', 'nullable', 'string', 'max:255'],

            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'profile_id' => ['prohibited'],
            'role' => ['prohibited'],
            'role_id' => ['prohibited'],
            'email' => ['prohibited'],
            'email_verified_at' => ['prohibited'],
            'phone_number' => ['prohibited'],
            'password' => ['prohibited'],
            'imagesrc' => ['prohibited'],
        ]);

        $user = $request->user();

        $profile = $user->profile()->firstOrFail();

        $profile->update([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'address' => $validated['address'],
        ]);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user->load(['role', 'profile']),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string', 'current_password:web',],
            'password' => ['required', 'string', 'min:8', 'confirmed',],
            'password_confirmation' => ['required', 'string',],
        ], ['current_password.current_password' => 'Your current password is incorrect.',
        ]);

        if (strlen($validated['password']) > 72) {
            throw ValidationException::withMessages([
                'password' => [
                    'This password is too long. Use a shorter password.',
                ],
            ]);
        }

        $user = $request->user();

        $user->password = Hash::make($validated['password']);
        $user->remember_token = Str::random(60);
        $user->save();

        $request->session()->regenerate();

        return response()->json([
            'message' => 'Password changed successfully.',
        ]);
    }
}