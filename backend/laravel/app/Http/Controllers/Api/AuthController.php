<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GrocerUser;
use App\Models\Profile;
use App\Models\SuperAdmin;
use App\Models\Worker;
use App\Models\AssignedInventoryWorker;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function registerShopper(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:profiles,email'],
            'phone_number' => ['required', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:6'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $shopper = DB::transaction(function () use ($validated): GrocerUser {
            $profile = Profile::create([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => Str::lower($validated['email']),
                'phone_number' => $validated['phone_number'],
            ]);

            return GrocerUser::create([
                'profile_id' => $profile->profile_id,
                'password_hash' => Hash::make($validated['password']),
                'address' => $validated['address'] ?? null,
                'date_created' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Shopper account created successfully.',
            'user_id' => $shopper->user_id,
            'profile_id' => $shopper->profile_id,
        ], 201);
    }

    public function createStaffAccount(Request $request): JsonResponse
    {
        $authenticatedAccount = $request->user();

        if (! $authenticatedAccount instanceof SuperAdmin || $authenticatedAccount->role_type !== 'Admin') {
            abort(403, 'Only administrators can create staff accounts.');
        }

        $this->normalizeEmail($request);

        $validated = $request->validate([
            'role' => ['required', 'in:worker,supervisor,admin'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:profiles,email'],
            'phone_number' => ['required', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        [$staffId, $profileId] = DB::transaction(function () use ($validated): array {
            $profile = Profile::create([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => Str::lower($validated['email']),
                'phone_number' => $validated['phone_number'],
            ]);

            $attributes = [
                'profile_id' => $profile->profile_id,
                'password_hash' => Hash::make($validated['password']),
            ];

            if ($validated['role'] === 'worker') {
                $staff = Worker::create($attributes + [
                    'worker_incentives' => 0,
                    'order_handled' => 0,
                ]);
            } else {
                $staff = SuperAdmin::create($attributes + [
                    'role_type' => $validated['role'] === 'admin' ? 'Admin' : 'Supervisor',
                ]);
            }

            return [$staff->getKey(), $profile->profile_id];
        });

        return response()->json([
            'message' => ucfirst($validated['role']).' account created successfully.',
            'staff_id' => $staffId,
            'profile_id' => $profileId,
            'role' => $validated['role'],
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);

        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $profile = Profile::query()
            ->whereRaw('LOWER(email) = ?', [Str::lower($validated['email'])])
            ->first();

        if (! $profile) {
            $this->invalidCredentials();
        }

        $account = $this->findAccount($profile, $validated['password']);

        if (! $account) {
            $this->invalidCredentials();
        }

        $role = $this->roleFor($account);
        $token = $account->createToken('grocerease-web', ["role:{$role}"])->plainTextToken;

        return response()->json($this->authenticatedUserPayload($account, $profile) + [
            'message' => 'Login successful.',
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        $account = $request->user();

        return response()->json($this->authenticatedUserPayload($account, $account->profile));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    private function findAccount(Profile $profile, string $password): ?Model
    {
        $accounts = [
            SuperAdmin::where('profile_id', $profile->profile_id)->first(),
            Worker::where('profile_id', $profile->profile_id)->first(),
            GrocerUser::where('profile_id', $profile->profile_id)->first(),
            AssignedInventoryWorker::where('profile_id', $profile->profile_id)
                ->where('status', 'Active')    
                ->first()
        ];

        foreach ($accounts as $account) {
            if ($account && $account->password_hash && Hash::check($password, $account->password_hash)) {
                return $account;
            }
        }

        return null;
    }

    private function roleFor(Model $account): string
    {
        return match (true) {
            $account instanceof SuperAdmin => Str::lower($account->role_type),
            $account instanceof Worker => 'worker',
            $account instanceof GrocerUser => 'shopper',
            $account instanceof AssignedInventoryWorker => 'inventory_worker'
        };
    }

    private function authenticatedUserPayload(Model $account, Profile $profile): array
    {
        return [
            'role' => $this->roleFor($account),
            'profile' => [
                'profile_id' => $profile->profile_id,
                'first_name' => $profile->first_name,
                'last_name' => $profile->last_name,
                'email' => $profile->email,
                'phone_number' => $profile->phone_number,
            ],
            'account' => match (true) {
                $account instanceof SuperAdmin => [
                    'admin_id' => $account->admin_id,
                    'role_type' => $account->role_type,
                ],
                $account instanceof AssignedInventoryWorker => [
                    'inventory_worker_id' => $account->inventory_worker_id,
                    'store_id' => $account->store_id,
                    'status' => $account->status,
                ],
                $account instanceof Worker => [
                    'worker_id' => $account->worker_id,
                    'worker_incentives' => $account->worker_incentives,
                    'order_handled' => $account->order_handled,
                ],
                $account instanceof GrocerUser => [
                    'user_id' => $account->user_id,
                    'address' => $account->address,
                    'photo' => $account->photo,
                ],
            },
        ];
    }

    private function invalidCredentials(): never
    {
        throw ValidationException::withMessages([
            'email' => ['Invalid email or password.'],
        ]);
    }

    private function normalizeEmail(Request $request): void
    {
        if (is_string($request->input('email'))) {
            $request->merge(['email' => Str::lower(trim($request->input('email')))]);
        }
    }
}
