<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\ShopperProfileController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register'])
    ->middleware('throttle:6,1,registration:');
Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth:sanctum');

Route::get('/user', function (Request $request) {
    return response()->json(
            $request->user()->accountData()
        );
    })->middleware('auth:sanctum');

Route::post('/email/verification-notification',[EmailVerificationController::class, 'resend'])
    ->middleware([
        'auth:sanctum',
        'role:shopper',
        'throttle:1,1,email-resend:',
    ])
    ->name('verification.send');

Route::put('/shopper/profile', [ShopperProfileController::class, 'update'])
    ->middleware([
        'auth:sanctum',
        'verified',
        'role:shopper',
    ])
    ->name('shopper.profile.update');

Route::put('/shopper/password',[ShopperProfileController::class, 'updatePassword'])
    ->middleware([
        'auth:sanctum',
        'verified',
        'role:shopper',
        'throttle:6,1,shopper-password:',
    ])
    ->name('shopper.password.update');

Route::put('/supervisor/password', [ShopperProfileController::class, 'updatePassword'])
    ->middleware([
        'auth:sanctum',
        'role:supervisor',
        'throttle:6,1,supervisor-password:',
    ])
    ->name('supervisor.password.update');