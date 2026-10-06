<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user || !$user->role || !in_array($user->role->slug, $roles, true)) {
            return response()->json([
                'message' => 'You do not have permission to access this resourcec.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
