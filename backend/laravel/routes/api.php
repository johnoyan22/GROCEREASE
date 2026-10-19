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
