<?php

use App\Http\Controllers\Api\SupervisorController;
use Illuminate\Support\Facades\Route;

// Include this file once from routes/api.php after team approval.
Route::middleware('auth:sanctum')->prefix('supervisor')->group(function () {
    Route::get('/dashboard', [SupervisorController::class, 'dashboard']);
    Route::get('/orders', [SupervisorController::class, 'orders']);
    Route::patch('/orders/{order}', [SupervisorController::class, 'updateOrder']);
    Route::post('/orders/{order}/assign-worker', [SupervisorController::class, 'assignWorker']);
    Route::get('/workers', [SupervisorController::class, 'workers']);
    Route::get('/payments', [SupervisorController::class, 'payments']);
    Route::get('/returns', [SupervisorController::class, 'returns']);
    Route::patch('/returns/{returnRequest}', [SupervisorController::class, 'updateReturn']);
    Route::get('/inventory', [SupervisorController::class, 'inventory']);
    Route::get('/stock-requests', [SupervisorController::class, 'stockRequests']);
    Route::patch('/stock-requests/{stockRequest}', [SupervisorController::class, 'updateStockRequest']);
    Route::get('/sales', [SupervisorController::class, 'sales']);
    Route::get('/profile', [SupervisorController::class, 'profile']);
    Route::patch('/profile', [SupervisorController::class, 'updateProfile']);
});
