<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminStaffController extends Controller
{
    public function index(): JsonResponse
    {
        $staff = User::query()
            ->with(['role', 'profile'])
            ->whereHas('role', fn ($query) => $query->whereIn(
                'slug',
                User::STAFF_ROLES
            ))
            ->orderBy('id')
            ->get()
            ->map(fn (User $user): array => $this->staffData($user));

        return response()->json(['staff' => $staff]);
    }

    public function store(Request $request): JsonResponse
    {
        $input = $request->all();

        if (is_string($input['phone_number'] ?? null)
            && str_starts_with($input['phone_number'], '09')) {
            $input['phone_number'] = '+63'.substr($input['phone_number'], 1);
        }

        $validated = Validator::make($input, [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => [
                'required',
                'string',
                'regex:/^\+639\d{9}$/',
                'unique:profiles,phone_number',
            ],
            'address' => ['nullable', 'string', 'max:255'],
            'role' => ['required', 'string', Rule::in(User::STAFF_ROLES)],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'role_id' => ['prohibited'],
            'store_id' => ['prohibited'],
            'email_verified_at' => ['prohibited'],
            'staff_approved_at' => ['prohibited'],
            'staff_approved_by_user_id' => ['prohibited'],
        ])->validate();

        if (strlen($validated['password']) > 72) {
            throw ValidationException::withMessages([
                'password' => 'Use a password no longer than 72 bytes.',
            ]);
        }

        $role = Role::where('slug', $validated['role'])->first();
        abort_unless($role, 503, 'Staff role configuration is unavailable.');

        try {
            $staff = DB::transaction(function () use ($request, $validated, $role) {
                $staff = new User([
                    'email' => $validated['email'],
                    'password' => $validated['password'],
                ]);

                $staff->role()->associate($role);

                $staff->forceFill([
                    'staff_approved_at' => now(),
                    'staff_approved_by_user_id' => $request->user()->id,
                ]);

                $staff->save();

                $staff->profile()->create([
                    'first_name' => $validated['first_name'],
                    'last_name' => $validated['last_name'],
                    'phone_number' => $validated['phone_number'],
                    'address' => $validated['address'] ?? null,
                ]);

                return $staff;
            }, 3);
        } catch (UniqueConstraintViolationException $exception) {
            // Handle a duplicate created after request validation.
            throw ValidationException::withMessages([
                'email' => 'The email or phone number is already registered.',
                'phone_number' => 'The email or phone number is already registered.',
            ]);
        }

        return response()->json([
            'message' => 'Staff account created and approved.',
            'staff' => $this->staffData($staff),
        ], 201);
    }

    public function approve(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'user_id' => ['prohibited'],
            'role' => ['prohibited'],
            'role_id' => ['prohibited'],
            'store_id' => ['prohibited'],
            'email_verified_at' => ['prohibited'],
            'staff_approved_at' => ['prohibited'],
            'staff_approved_by_user_id' => ['prohibited'],
        ]);

        $staff = DB::transaction(function () use ($request, $user) {
            $staff = User::query()
                ->with('role')
                ->lockForUpdate()
                ->findOrFail($user->id);

            if (! in_array($staff->role?->slug, User::STAFF_ROLES, true)) {
                throw ValidationException::withMessages([
                    'user' => 'Only Inventory Workers and Supervisors can receive staff approval.',
                ]);
            }

            if (! $staff->isApprovedStaff()) {
                $staff->forceFill([
                    'staff_approved_at' => now(),
                    'staff_approved_by_user_id' => $request->user()->id,
                ])->save();
            }

            return $staff;
        }, 3);

        return response()->json([
            'message' => 'Staff account approved.',
            'staff' => $this->staffData($staff),
        ]);
    }

    private function staffData(User $user): array
    {
        $user->loadMissing(['role', 'profile']);

        return [
            'id' => $user->id,
            'email' => $user->email,
            'role' => $user->role->slug,
            'profile' => $user->profile?->only([
                'first_name', 'last_name', 'phone_number', 'address',
            ]),
            'approved' => $user->isApprovedStaff(),
            'approved_at' => $user->staff_approved_at?->toIso8601String(),
            'approved_by_user_id' => $user->staff_approved_by_user_id,
        ];
    }
}