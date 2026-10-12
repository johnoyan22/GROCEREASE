<?php

use App\Http\Controllers\Api\SupervisorStockApprovalsController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('supervisor/stock-approvals')->group(function () {
    Route::get('/', [SupervisorStockApprovalsController::class, 'index']);
    Route::patch('/{id}', [SupervisorStockApprovalsController::class, 'update'])->whereNumber('id');
});
