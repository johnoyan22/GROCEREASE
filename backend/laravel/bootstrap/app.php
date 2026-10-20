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
        $middleware->statefulApi();
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
