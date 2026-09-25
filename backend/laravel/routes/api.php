<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InventoryProductController;
use Illuminate\Support\Facades\Route;

// Public account endpoints
Route::post('/register/shopper', [AuthController::class, 'registerShopper']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/register/staff', [AuthController::class, 'createStaffAccount']);
    Route::get('/inventory/products', [InventoryProductController::class, 'index']);
});
