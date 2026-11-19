<?php

use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $trustedProxies = array_values(array_filter(array_map('trim', explode(',', (string) env('GROCEREASE_TRUSTED_PROXIES', '')))));
        foreach ($trustedProxies as $proxy) { if (!filter_var($proxy, FILTER_VALIDATE_IP)) throw new RuntimeException('GROCEREASE_TRUSTED_PROXIES must contain exact trusted proxy IPs, never wildcards.'); }
        $middleware->trustProxies(at: $trustedProxies, headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PORT | Request::HEADER_X_FORWARDED_PROTO);
        $middleware->statefulApi();
        $middleware->trimStrings(except: ['credential']);
        $middleware->api(append: [\App\Http\Middleware\EnsureAccountActive::class]);

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);

        $middleware->redirectGuestsTo(
            fn (Request $request) =>
                rtrim(config('app.frontend_url'), '/')
                .'/login?verification=required'
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Pickup secrets and order documents must not be cached, including failures.
        $exceptions->respond(function ($response) {
            if (request()->is('api/admin/financial/*', 'api/payments/xendit/*', 'api/shopper/orders/*/payment-session', 'api/admin/cop/*', 'api/admin/cop-strikes*', 'api/admin/cop-strikes/*', 'api/shopper/cop-status', 'api/reports', 'api/reports/*', 'api/supervisor/pickup/*', 'api/supervisor/orders/*/claim', 'api/*/orders/*/summary', 'api/*/orders/*/receipt', 'api/supervisor/order-reference')) {
                $response->headers->set('Cache-Control', 'no-store, private');
                $response->headers->set('Pragma', 'no-cache');
            }
            return $response;
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, \Throwable $exception) =>
                $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(
            function (HttpException $exception, Request $request) {
                if (! $request->routeIs('verification.verify')
                    || $exception->getStatusCode() !== 403) {
                    return null;
                }

                if ($request->expectsJson()) {
                    return response()->json([
                        'message' => 'This verification link is invalid, expired, or does not belong to your account.',
                    ], 403);
                }

                return redirect()->away(
                    rtrim(config('app.frontend_url'), '/')
                    .'/verify-email?status=invalid'
                );
            }
        );
    })->create();
