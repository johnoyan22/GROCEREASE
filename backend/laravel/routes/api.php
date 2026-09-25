<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;

// Public Account Management Endpoints
Route::post('/register/shopper', [AuthController::class, 'registerShopper']);
Route::post('/register/staff', [AuthController::class, 'createStaffAccount']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');