<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProfilePhotoController extends Controller
{
    public function show(Request $request)
    {
        $path = $request->user()->profile?->imagesrc;
        abort_unless(is_string($path) && str_starts_with($path, 'profile-photos/') && ! str_contains($path, '..'), 404);
        abort_unless(Storage::disk('local')->exists($path), 404);
        return response()->file(Storage::disk('local')->path($path), [
            'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'",
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:max_width=4096,max_height=4096'],
            'user_id' => ['prohibited'], 'profile_id' => ['prohibited'], 'imagesrc' => ['prohibited'],
        ]);
        $path = $request->file('photo')->store('profile-photos', 'local');
        abort_unless($path, 503, 'The photo could not be saved. Please try again.');
        try {
            $old = DB::transaction(function () use ($request, $path) {
                $profile = $request->user()->profile()->lockForUpdate()->firstOrFail();
                $old = $profile->imagesrc;
                $profile->update(['imagesrc' => $path]);
                return $old;
            });
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }
        $this->deleteOwnedFile($old);
        return response()->json(['message' => 'Profile photo saved.', 'user' => $request->user()->load(['profile', 'role'])]);
    }

    public function destroy(Request $request)
    {
        $old = DB::transaction(function () use ($request) {
            $profile = $request->user()->profile()->lockForUpdate()->firstOrFail();
            $old = $profile->imagesrc;
            $profile->update(['imagesrc' => null]);
            return $old;
        });
        $this->deleteOwnedFile($old);
        return response()->json(['message' => 'Profile photo removed.', 'user' => $request->user()->load(['profile', 'role'])]);
    }

    private function deleteOwnedFile(?string $path): void
    {
        if ($path && str_starts_with($path, 'profile-photos/') && ! str_contains($path, '..')) {
            Storage::disk('local')->delete($path);
        }
    }
}
