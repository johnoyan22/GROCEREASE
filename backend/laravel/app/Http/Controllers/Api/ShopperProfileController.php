<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}