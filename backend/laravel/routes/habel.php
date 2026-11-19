<?php

use App\Http\Controllers\Api\ShopperAiRecommendationController;
use App\Http\Controllers\Api\SupervisorAiRecommendationController;
use Illuminate\Support\Facades\Route;

// Habel's AI only. Existing preparation, worker and transaction routes remain authoritative.
Route::middleware(['auth:sanctum', 'verified', 'role:shopper'])->group(function () {
    Route::put('/shopper/selected-store', [ShopperAiRecommendationController::class, 'selectStore'])->middleware('throttle:60,1,shopper-store:');
    Route::prefix('shopper/stores/{store}/ai-recommendations')->whereNumber('store')->group(function () {
        Route::get('/', [ShopperAiRecommendationController::class, 'index'])->middleware('throttle:60,1,ai-list:');
        Route::post('/ask', [ShopperAiRecommendationController::class, 'ask'])->middleware('throttle:15,1,ai-ask:');
        Route::post('/image', [ShopperAiRecommendationController::class, 'image'])->middleware('throttle:5,1,ai-image:');
        Route::post('/items/{item}/cart-check', [ShopperAiRecommendationController::class, 'cartCheck'])->whereNumber('item')->middleware('throttle:30,1,ai-cart-check:');
        Route::get('/alternatives/{item}', [ShopperAiRecommendationController::class, 'alternatives'])->whereNumber('item')->middleware('throttle:60,1,ai-alternatives:');
    });
});
Route::middleware(['auth:sanctum', 'role:supervisor'])->prefix('supervisor/ai-recommendation')->group(function () {
    Route::get('/settings', [SupervisorAiRecommendationController::class, 'show']);
    Route::put('/settings', [SupervisorAiRecommendationController::class, 'update'])->middleware('throttle:20,1,ai-settings:');
});
