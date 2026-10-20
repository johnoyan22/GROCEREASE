<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        // Provider callbacks have their own signatures; they must still reconcile payments for inactive accounts.
        if (!$request->is('api/payments/paymongo/test/*/webhook') && !$request->is('api/logout')) {
            $signedIn = $request->user('sanctum');
            if ($signedIn) {
                $current = User::find($signedIn->id);
                if (!$current || ($current->account_status ?? 'active') !== 'active') {
                    return response()->json(['message' => 'This account is inactive. Contact an administrator.'], 403);
                }
            }
        }
        return $next($request);
    }
}
