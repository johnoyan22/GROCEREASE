<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\ShopperProfileController;
use App\Http\Controllers\Api\AdminStaffController;
use App\Http\Controllers\Api\AdminStoreController;
use App\Http\Controllers\Api\StaffStoreAssignmentController;
use App\Http\Controllers\Api\StoreInventoryController;
use App\Http\Controllers\Api\StockReportingController;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\ShopperCatalogController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\WorkerController;
use App\Http\Controllers\Api\PickupController;
use App\Http\Controllers\Api\StorePickupSettingsController;
use App\Http\Controllers\Api\WorkerAssignmentController;
use App\Http\Controllers\Api\OrderResolutionController;
use App\Http\Controllers\Api\CopMonitoringController;
use App\Http\Controllers\Api\TransactionRecordsController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register'])
    ->middleware('throttle:6,1,registration:');
Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth:sanctum');

Route::get('/user', function (Request $request) {
    return response()->json(
            $request->user()->accountData()
        );
    })->middleware('auth:sanctum');

Route::post('/email/verification-notification',[EmailVerificationController::class, 'resend'])
    ->middleware([
        'auth:sanctum',
        'role:shopper',
        'throttle:1,1,email-resend:',
    ])
    ->name('verification.send');

Route::put('/shopper/profile', [ShopperProfileController::class, 'update'])
    ->middleware([
        'auth:sanctum',
        'verified',
        'role:shopper',
    ])
    ->name('shopper.profile.update');

Route::put('/shopper/password',[ShopperProfileController::class, 'updatePassword'])
    ->middleware([
        'auth:sanctum',
        'verified',
        'role:shopper',
        'throttle:6,1,shopper-password:',
    ])
    ->name('shopper.password.update');

Route::put('/supervisor/password', [ShopperProfileController::class, 'updatePassword'])
    ->middleware([
        'auth:sanctum',
        'role:supervisor',
        'throttle:6,1,supervisor-password:',
    ])
    ->name('supervisor.password.update');

Route::put('/inventory/password', [ShopperProfileController::class, 'updatePassword'])
    ->middleware([
        'auth:sanctum',
        'role:inventory_worker',
        'throttle:6,1,inventory-password:',
    ])
    ->name('inventory.password.update');

Route::put('/admin/password', [ShopperProfileController::class, 'updatePassword'])
    ->middleware([
        'auth:sanctum',
        'role:admin',
        'throttle:6,1,admin-password:',
    ])
    ->name('admin.password.update');

Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin/transactions', [TransactionRecordsController::class, 'adminIndex']);
    Route::get('/admin/orders/{order}/receipt', [TransactionRecordsController::class, 'receipt'])->whereNumber('order');
    Route::get('/admin/cop-strikes', [CopMonitoringController::class, 'adminIndex']);
    Route::put('/admin/cop-strikes/{strike}/correction', [CopMonitoringController::class, 'correct'])->whereNumber('strike')->middleware('throttle:20,1,cop-correction:');
    Route::get('/admin/stores/{store}/pickup-settings', [StorePickupSettingsController::class, 'show'])->whereNumber('store');
    Route::get('/admin/stores', [AdminStoreController::class, 'index'])
        ->name('admin.stores.index');
    Route::post('/admin/stores', [AdminStoreController::class, 'store'])
        ->middleware('throttle:20,1,admin-store-create:')
        ->name('admin.stores.store');
    Route::put('/admin/stores/{store}', [AdminStoreController::class, 'update'])
        ->whereNumber('store')
        ->middleware('throttle:30,1,admin-store-update:')
        ->name('admin.stores.update');
    Route::put('/admin/stores/{store}/status', [AdminStoreController::class, 'updateStatus'])
        ->whereNumber('store')
        ->middleware('throttle:20,1,admin-store-status:')
        ->name('admin.stores.status');

    Route::get('/admin/staff', [
        AdminStaffController::class, 'index',
    ])->name('admin.staff.index');

    Route::post('/admin/staff', [
        AdminStaffController::class, 'store',
    ])->middleware('throttle:10,1,admin-staff-create:')
        ->name('admin.staff.store');

    Route::put('/admin/staff/{user}/approval', [
        AdminStaffController::class, 'approve',
    ])->middleware('throttle:20,1,admin-staff-approve:')
        ->name('admin.staff.approve');
});

Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin/staff-store-assignments', [
        StaffStoreAssignmentController::class, 'adminIndex',
    ])->name('admin.staff-store-assignments.index');

    Route::put('/admin/staff/{user}/store-assignment', [
        StaffStoreAssignmentController::class, 'adminUpdate',
    ])->middleware('throttle:20,1,admin-store-assignment:')
        ->name('admin.staff-store-assignments.update');
});

Route::middleware(['auth:sanctum', 'role:supervisor'])->group(function () {
    Route::get('/supervisor/pickup-settings', [StorePickupSettingsController::class, 'supervisorShow']);
    Route::get('/supervisor/pickup-hours', [StorePickupSettingsController::class, 'supervisorAvailable']);
    Route::put('/supervisor/pickup-settings', [StorePickupSettingsController::class, 'supervisorUpdate'])->middleware('throttle:20,1,pickup-settings:');
    Route::post('/supervisor/pickup-closures', [StorePickupSettingsController::class, 'supervisorCloseDate'])->middleware('throttle:20,1,pickup-suspension:');
    Route::get('/supervisor/staff', [
        StaffStoreAssignmentController::class, 'supervisorIndex',
    ])->name('supervisor.staff.index');

    Route::put('/supervisor/staff/{user}/store-assignment', [
        StaffStoreAssignmentController::class, 'supervisorAssign',
    ])->middleware('throttle:20,1,supervisor-store-assignment:')
        ->name('supervisor.staff.assign');
});

Route::get('/staff/store', [
    StaffStoreAssignmentController::class, 'showMine',
])->middleware([
    'auth:sanctum',
    'role:inventory_worker,supervisor',
])->name('staff.store.show');

Route::middleware(['auth:sanctum', 'role:inventory_worker'])->group(function () {
    Route::post('/inventory/items', [StoreInventoryController::class, 'store'])
        ->middleware('throttle:30,1,inventory-item-create:')
        ->name('inventory.items.store');
    Route::put('/inventory/items/{item}', [StoreInventoryController::class, 'update'])
        ->whereNumber('item')
        ->middleware('throttle:30,1,inventory-item-update:')
        ->name('inventory.items.update');
});

Route::get('/inventory/items', [StoreInventoryController::class, 'index'])
    ->middleware(['auth:sanctum', 'role:inventory_worker,supervisor'])
    ->name('inventory.items.index');

Route::middleware(['auth:sanctum', 'role:inventory_worker,supervisor'])->group(function () {
    Route::get('/inventory/low-stock-reports', [StockReportingController::class, 'index'])
        ->name('inventory.low-stock-reports.index');
    Route::get('/inventory/availability-history', [StockReportingController::class, 'availabilityHistory'])
        ->name('inventory.availability-history.index');
});

Route::post('/inventory/items/{item}/low-stock-reports', [StockReportingController::class, 'store'])
    ->whereNumber('item')
    ->middleware(['auth:sanctum', 'role:inventory_worker', 'throttle:20,1,low-stock-report:'])
    ->name('inventory.low-stock-reports.store');

Route::get('/inventory/stock-adjustments', [StockAdjustmentController::class, 'index'])
    ->middleware(['auth:sanctum', 'role:inventory_worker,supervisor'])
    ->name('inventory.stock-adjustments.index');
Route::post('/inventory/items/{item}/stock-adjustments', [StockAdjustmentController::class, 'store'])
    ->whereNumber('item')
    ->middleware(['auth:sanctum', 'role:inventory_worker', 'throttle:20,1,stock-adjustment-create:'])
    ->name('inventory.stock-adjustments.store');
Route::put('/supervisor/stock-adjustments/{adjustment}/decision', [StockAdjustmentController::class, 'decide'])
    ->whereNumber('adjustment')
    ->middleware(['auth:sanctum', 'role:supervisor', 'throttle:30,1,stock-adjustment-decision:'])
    ->name('supervisor.stock-adjustments.decide');
Route::put('/supervisor/inventory/items/{item}/policy', [StockAdjustmentController::class, 'updatePolicy'])
    ->whereNumber('item')
    ->middleware(['auth:sanctum', 'role:supervisor', 'throttle:30,1,stock-policy-update:'])
    ->name('supervisor.inventory.policy');

Route::middleware(['auth:sanctum', 'verified', 'role:shopper'])->group(function () {
    Route::get('/shopper/cop-status', [CopMonitoringController::class, 'shopperStatus']);
    Route::get('/shopper/order-notifications', [CopMonitoringController::class, 'notifications']);
    Route::put('/shopper/order-notifications/{notification}/read', [CopMonitoringController::class, 'readNotification'])->whereNumber('notification');
    Route::get('/shopper/stores', [ShopperCatalogController::class, 'stores'])
        ->name('shopper.stores.index');
    Route::get('/shopper/stores/{store}/products', [ShopperCatalogController::class, 'products'])
        ->whereNumber('store')->name('shopper.products.index');
    Route::get('/shopper/stores/{store}/pickup-hours', [StorePickupSettingsController::class, 'available'])->whereNumber('store');
    Route::post('/shopper/checkout/quote', [CheckoutController::class, 'quote'])
        ->middleware('throttle:30,1,checkout-quote:')->name('shopper.checkout.quote');
    Route::get('/shopper/checkout-attempts/{key}', [CheckoutController::class, 'findAttempt'])
        ->whereUuid('key')->name('shopper.checkout.attempt');
    Route::post('/shopper/orders', [CheckoutController::class, 'store'])
        ->middleware('throttle:10,1,checkout-order:')->name('shopper.orders.store');
    Route::get('/shopper/orders', [OrderController::class, 'shopperIndex'])->name('shopper.orders.index');
    Route::get('/shopper/orders/{order}', [OrderController::class, 'shopperShow'])
        ->whereNumber('order')->name('shopper.orders.show');
    Route::put('/shopper/orders/{order}/cancellation', [OrderController::class, 'cancel'])
        ->whereNumber('order')->middleware('throttle:10,1,order-cancel:')->name('shopper.orders.cancel');
    Route::get('/shopper/orders/{order}/pickup', [PickupController::class, 'shopperPickup'])
        ->whereNumber('order')->name('shopper.orders.pickup');
    Route::get('/shopper/orders/{order}/receipt', [TransactionRecordsController::class, 'receipt'])->whereNumber('order');
});

Route::get('/staff/orders', [OrderController::class, 'staffIndex'])
    ->middleware(['auth:sanctum', 'role:inventory_worker,supervisor'])->name('staff.orders.index');
Route::put('/staff/orders/{order}/preparation', [WorkerAssignmentController::class, 'prepare'])
    ->whereNumber('order')->middleware(['auth:sanctum', 'role:inventory_worker,supervisor', 'throttle:30,1,preparation:']);
Route::put('/supervisor/orders/{order}/worker', [WorkerAssignmentController::class, 'assign'])
    ->whereNumber('order')->middleware(['auth:sanctum', 'role:supervisor', 'throttle:20,1,delegation:']);
Route::put('/supervisor/orders/{order}/preparation-completion', [WorkerAssignmentController::class, 'complete'])
    ->whereNumber('order')->middleware(['auth:sanctum', 'role:supervisor', 'throttle:20,1,preparation-review:']);
Route::put('/supervisor/orders/{order}/status', [OrderController::class, 'updateStatus'])
    ->whereNumber('order')->middleware(['auth:sanctum', 'role:supervisor', 'throttle:30,1,order-status:'])
    ->name('supervisor.orders.status');

Route::middleware(['auth:sanctum', 'role:supervisor'])->group(function () {
    Route::get('/supervisor/transactions', [TransactionRecordsController::class, 'supervisorIndex']);
    Route::get('/supervisor/orders/{order}/receipt', [TransactionRecordsController::class, 'receipt'])->whereNumber('order');
    Route::put('/supervisor/orders/{order}/pickup-schedule', [OrderResolutionController::class, 'reschedule'])->whereNumber('order')->middleware('throttle:20,1,reschedule:');
    Route::put('/supervisor/orders/{order}/resale-disposition', [OrderResolutionController::class, 'resale'])->whereNumber('order')->middleware('throttle:20,1,resale:');
    Route::put('/supervisor/orders/{order}/refund-review', [OrderResolutionController::class, 'requestRefundReview'])->whereNumber('order')->middleware('throttle:20,1,refund-review:');
    Route::put('/supervisor/orders/{order}/cash-payment', [PickupController::class, 'confirmCash'])
        ->whereNumber('order')->middleware('throttle:10,1,order-cash:')->name('supervisor.orders.cash');
    Route::post('/supervisor/orders/{order}/pickup-verification', [PickupController::class, 'verify'])
        ->whereNumber('order')->middleware('throttle:5,1,pickup-verification:')->name('supervisor.orders.verify');
    Route::put('/supervisor/orders/{order}/handover', [PickupController::class, 'handover'])
        ->whereNumber('order')->middleware('throttle:10,1,order-handover:')->name('supervisor.orders.handover');
    Route::get('/supervisor/workers', [WorkerController::class, 'index'])->name('supervisor.workers.index');
    Route::post('/supervisor/workers', [WorkerController::class, 'store'])
        ->middleware('throttle:20,1,store-worker-create:')->name('supervisor.workers.store');
    Route::put('/supervisor/workers/{worker}', [WorkerController::class, 'update'])
        ->whereNumber('worker')->middleware('throttle:30,1,store-worker-update:')->name('supervisor.workers.update');
});
