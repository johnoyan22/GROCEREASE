<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StoreCategoryController;
use App\Http\Controllers\Api\ProductPhotoController;
use App\Http\Controllers\Api\StockReceivingController;
use App\Http\Controllers\Api\StockAlertController;

Route::get('/public/store-locations', [\App\Http\Controllers\Api\StoreLocationController::class, 'index'])->middleware('throttle:60,1,public-store-locations:');
Route::get('/public/stores/{store}/products', [\App\Http\Controllers\Api\PublicCatalogController::class, 'index'])->whereNumber('store')->middleware('throttle:60,1,public-catalog:');
Route::get('/public/stores/{store}/products/{product}/photo', [ProductPhotoController::class, 'publicShow'])->whereNumber('store')->whereNumber('product')->middleware('throttle:120,1,public-photo:');

Route::middleware(['auth:sanctum', 'role:inventory_worker,supervisor'])->group(function () {
    Route::get('/inventory/categories', [StoreCategoryController::class, 'index']);
    Route::get('/inventory/items/{item}/price-history', [\App\Http\Controllers\Api\StoreInventoryController::class, 'priceHistory'])->whereNumber('item');
    Route::get('/inventory/receiving', [StockReceivingController::class, 'index']);
    Route::get('/inventory/stock-alerts', [StockAlertController::class, 'index']);
    Route::put('/inventory/stock-alerts/{alert}/read', [StockAlertController::class, 'read'])->whereNumber('alert');
});
Route::middleware(['auth:sanctum', 'role:supervisor'])->group(function () {
    Route::get('/supervisor/order-lookup', [\App\Http\Controllers\Api\OrderController::class, 'lookup'])->middleware('throttle:30,1,order-lookup:');
    Route::get('/supervisor/reports/{kind}.pdf', [\App\Http\Controllers\Api\ReportPdfController::class, 'export']);
    Route::get('/supervisor/reports/{kind}', [\App\Http\Controllers\Api\ReportPdfController::class, 'index'])->where('kind', 'orders|stock|low-stock|sales|transactions');
    Route::post('/supervisor/categories', [StoreCategoryController::class, 'save'])->middleware('throttle:30,1,categories:');
    Route::put('/supervisor/categories/{category}', [StoreCategoryController::class, 'save'])->whereNumber('category')->middleware('throttle:30,1,categories:');
    Route::put('/supervisor/receiving/{receiving}/decision', [StockReceivingController::class, 'decide'])->whereNumber('receiving')->middleware('throttle:30,1,receiving-decision:');
    Route::put('/supervisor/batches/{batch}/quarantine', [StockReceivingController::class, 'quarantine'])->whereNumber('batch')->middleware('throttle:30,1,batch-quarantine:');
});

Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin/stores/{store}/map-location', [\App\Http\Controllers\Api\StoreLocationController::class, 'show'])->whereNumber('store');
    Route::put('/admin/stores/{store}/map-location', [\App\Http\Controllers\Api\StoreLocationController::class, 'update'])->whereNumber('store')->middleware('throttle:20,1,store-map-location:');
    Route::get('/admin/reports/{kind}.pdf', [\App\Http\Controllers\Api\ReportPdfController::class, 'export']);
    Route::get('/admin/reports/{kind}', [\App\Http\Controllers\Api\ReportPdfController::class, 'index'])->where('kind', 'orders|stock|low-stock|sales|transactions|cop');
    Route::get('/admin/stores/{store}/invoice-settings', [\App\Http\Controllers\Api\InvoiceController::class, 'settings'])->whereNumber('store');
    Route::put('/admin/stores/{store}/invoice-settings', [\App\Http\Controllers\Api\InvoiceController::class, 'updateSettings'])->whereNumber('store')->middleware('throttle:15,1,invoice-settings:');
});
foreach (['shopper', 'supervisor', 'admin'] as $invoiceRole) {
    Route::middleware(['auth:sanctum', 'role:'.$invoiceRole])->group(function () use ($invoiceRole) {
        Route::post('/'.$invoiceRole.'/orders/{order}/invoice', [\App\Http\Controllers\Api\InvoiceController::class, 'generate'])->whereNumber('order')->middleware('throttle:15,1,invoice-generate:');
        Route::get('/'.$invoiceRole.'/orders/{order}/invoice', [\App\Http\Controllers\Api\InvoiceController::class, 'show'])->whereNumber('order');
        Route::get('/'.$invoiceRole.'/orders/{order}/invoice.pdf', [\App\Http\Controllers\Api\InvoiceController::class, 'pdf'])->whereNumber('order')->middleware('throttle:20,1,invoice-export:');
    });
}
Route::middleware(['auth:sanctum', 'role:inventory_worker'])->group(function () {
    Route::get('/inventory/reports/{kind}.pdf', [\App\Http\Controllers\Api\ReportPdfController::class, 'export']);
    Route::get('/inventory/reports/{kind}', [\App\Http\Controllers\Api\ReportPdfController::class, 'index'])->where('kind', 'stock|low-stock');
    Route::post('/inventory/items/{item}/photo', [ProductPhotoController::class, 'save'])->whereNumber('item')->middleware('throttle:20,1,product-photo:');
    Route::delete('/inventory/items/{item}/photo', [ProductPhotoController::class, 'destroy'])->whereNumber('item');
    Route::post('/inventory/items/{item}/receiving', [StockReceivingController::class, 'store'])->whereNumber('item')->middleware('throttle:30,1,receiving:');
    Route::get('/inventory/receiving/template', [StockReceivingController::class, 'template']);
    Route::post('/inventory/receiving/preview', [StockReceivingController::class, 'preview'])->middleware('throttle:10,1,import-preview:');
    Route::post('/inventory/receiving/import', [StockReceivingController::class, 'import'])->middleware('throttle:10,1,import-submit:');
});
Route::get('/catalog/products/{product}/photo', [ProductPhotoController::class, 'show'])->whereNumber('product')
    ->middleware(['auth:sanctum', 'role:shopper,inventory_worker,supervisor']);
