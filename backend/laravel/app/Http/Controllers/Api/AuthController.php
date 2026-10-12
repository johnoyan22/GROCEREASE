<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json([
                'message' => 'The email or password is incorrect'
            ], 401);
        }

        $request->session()->regenerate();

        $user = $request->user()->load(['role', 'profile']);

        return response()->json([
            'user' => $user,
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                'unique:users,email',
            ],
            'phone_number' => [
                'required',
                'string',
                'regex:/^(09\d{9}|\+639\d{9})$/',
            ],
            'address' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'agree_to_terms' => ['required', 'accepted'],
            'role' => ['prohibited'],
            'role_id' => ['prohibited'],
            'email_verified_at' => ['prohibited'],
        ]);

        if (str_starts_with($validated['phone_number'], '09')) {
            $validated['phone_number'] = '+63' . substr($validated['phone_number'],1);
        }

        Validator::make(
        [
            'phone_number' => $validated['phone_number'],
        ],
        [
            'phone_number' => ['unique:profiles,phone_number'],
        ],
        [
            'phone_number.unique' => 'This phone number is already registered.',
        ]
        )->validate();

        $shopperRole = Role::where('slug' , 'shopper')->first();

        if ($shopperRole === null) {
            abort(500, 'Registration is currently unavailable.');
        };

        $user = DB::transaction(function () use ($validated, $shopperRole ) {
            $user = new User([
                'email' => $validated['email'],
                'password' => $validated['password'],
            ]);

            $user->role()->associate($shopperRole);
            $user->save();

            $user->profile()->create([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'phone_number' => $validated['phone_number'],
                'address' => $validated['address'] ?? null,
            ]);

            return $user;
        });

             $verificationEmailSent = true;

        try {
            event(new Registered($user));
        } catch (\Throwable $exception) {
            $verificationEmailSent = false;

            Log::warning('Registration saved, but verification notification failed.', [
                'user_id' => $user->id,
                'exception_class' => $exception::class,
            ]);
        }

        return response()->json([
            'message' => $verificationEmailSent
                ? 'Account created successfully. Please sign in and verify your email.'
                : 'Account created successfully, but the verification email could not be sent. Please sign in and request another link.',
            'user' => $user->load(['role', 'profile']),
            'email_verification_required' => true,
            'verification_email_sent' => $verificationEmailSent,
        ], 201);

    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logged out successfully.'
        ]);
    }
}
