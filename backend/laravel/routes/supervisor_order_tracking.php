<?php
use App\Http\Controllers\Api\SupervisorOrderTrackingController;
use Illuminate\Support\Facades\Route;

// Keep existing supervisor.php routes unchanged. New endpoints use /order-tracking to avoid conflicts.
Route::middleware('auth:sanctum')->prefix('supervisor/order-tracking')->group(function () {
    Route::get('/orders', [SupervisorOrderTrackingController::class, 'index']);
    Route::patch('/orders/{order}', [SupervisorOrderTrackingController::class, 'update'])->whereNumber('order');
    Route::get('/orders/{order}/history', [SupervisorOrderTrackingController::class, 'history'])->whereNumber('order');
});
