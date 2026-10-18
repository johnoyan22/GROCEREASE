<?php

use App\Http\Controllers\Api\SupervisorAiRecommendationController;
use Illuminate\Support\Facades\Route;

// ===== John Paul Habel: AI Recommendation + Order Preparation =====
// Loaded from routes/api.php, so the /api prefix and api middleware apply.

Route::middleware(['auth:sanctum', 'role:supervisor'])
    ->prefix('supervisor/ai-recommendation')
    ->group(function () {
        Route::get('/settings', [SupervisorAiRecommendationController::class, 'show']);
        Route::put('/settings', [SupervisorAiRecommendationController::class, 'update']);
    });