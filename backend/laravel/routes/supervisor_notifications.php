<?php

use App\Http\Controllers\Api\SupervisorNotificationController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')
    ->prefix('supervisor/notifications')
    ->group(function () {
        Route::get('/', [SupervisorNotificationController::class, 'index']);
        Route::get('/unread-count', [SupervisorNotificationController::class, 'unreadCount']);
        Route::patch('/read-all', [SupervisorNotificationController::class, 'markAllRead']);
        Route::patch('/{notification}/read', [SupervisorNotificationController::class, 'markRead'])
            ->whereNumber('notification');
    });