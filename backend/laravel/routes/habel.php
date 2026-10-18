<?php

use App\Http\Controllers\Api\ShopperAiRecommendationController;
use App\Http\Controllers\Api\SupervisorAiRecommendationController;
use Illuminate\Support\Facades\Route;

// ===== John Paul Habel: AI Recommendation + Order Preparation =====
// Loaded from routes/api.php, so the /api prefix and api middleware apply.

Route::middleware(['auth:sanctum', 'verified', 'role:shopper'])
    ->prefix('shopper/ai-recommendations')
    ->group(function () {
        Route::get('/', [ShopperAiRecommendationController::class, 'index']);
        Route::post('/ask', [ShopperAiRecommendationController::class, 'ask']);
        Route::get('/alternatives/{product}', [ShopperAiRecommendationController::class, 'alternatives'])
            ->whereNumber('product');
    });

Route::middleware(['auth:sanctum', 'role:supervisor'])
    ->prefix('supervisor/ai-recommendation')
    ->group(function () {
        Route::get('/settings', [SupervisorAiRecommendationController::class, 'show']);
        Route::put('/settings', [SupervisorAiRecommendationController::class, 'update']);
    });