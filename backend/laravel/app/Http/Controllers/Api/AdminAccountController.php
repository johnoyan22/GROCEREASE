<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class AdminAccountController extends Controller
{
    private function requireSchema(): void
    {
        abort_unless(Schema::hasColumn('users', 'account_status') && Schema::hasTable('account_status_logs'), 503, 'Account activation controls await the reviewed account-status migration.');
    }

    public function index(): JsonResponse
    {
        $this->requireSchema();
        return response()->json(['accounts' => User::with('role')->orderBy('id')->get()->map(fn ($user) => [
            'id' => $user->id, 'email' => $user->email, 'role' => $user->role?->name, 'account_status' => $user->account_status,
        ])])->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, int $user): JsonResponse
    {
        $this->requireSchema();
        $validated = $request->validate(['account_status' => ['required', Rule::in(['active', 'inactive'])],
            'reason' => ['required', 'string', 'max:500', 'regex:/\S/u'], 'role_id' => ['prohibited'], 'store_id' => ['prohibited'],
            'staff_approved_at' => ['prohibited'], 'changed_by_user_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $user, $validated) {
            // Serializes simultaneous cross-admin deactivation and always keeps an active administrator.
            $admins = User::whereHas('role', fn ($q) => $q->where('slug', 'admin'))->orderBy('id')->lockForUpdate()->get();
            $actor = $admins->firstWhere('id', $request->user()->id);
            abort_unless($actor && $actor->account_status === 'active', 403);
            abort_if($user === $actor->id && $validated['account_status'] === 'inactive', 422, 'You cannot deactivate your own administrator account.');
            $target = User::whereKey($user)->lockForUpdate()->firstOrFail();
            $before = $target->account_status;
            if ($before === $validated['account_status']) return response()->json(['message' => 'Account status is already current.']);
            $target->account_status = $validated['account_status']; $target->save();
            DB::table('account_status_logs')->insert(['user_id' => $target->id, 'changed_by_user_id' => $actor->id,
                'previous_status' => $before, 'new_status' => $target->account_status, 'reason' => trim($validated['reason']), 'created_at' => now(), 'updated_at' => now()]);
            if ($target->account_status === 'inactive') {
                if (Schema::hasTable('personal_access_tokens')) DB::table('personal_access_tokens')
                    ->where('tokenable_type', $target->getMorphClass())->where('tokenable_id', $target->id)->delete();
                if (Schema::hasTable('sessions')) DB::table('sessions')->where('user_id', $target->id)->delete();
            }
            return response()->json(['message' => 'Account '.$target->account_status.'. Store status, staff approval and COP eligibility are separate.']);
        }, 3);
    }
}
