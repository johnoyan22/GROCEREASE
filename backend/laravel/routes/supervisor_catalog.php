
<?php

use App\Http\Controllers\Api\SupervisorProductCatalogController;
use Illuminate\Support\Facades\Route;

// Supervisor Product Catalog API
Route::middleware('auth:sanctum')
    ->prefix('supervisor')
    ->group(function () {

        // Module 1: Browse Product Catalog
        // Module 2: Search / Filter Products
        Route::get(
            '/products',
            [SupervisorProductCatalogController::class, 'index']
        );

        // Module 3: View Product Details
        Route::get(
            '/products/{product}',
            [SupervisorProductCatalogController::class, 'show']
        );
    });
