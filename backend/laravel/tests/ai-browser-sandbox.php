<?php

use App\Models\Product;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Console\Kernel;

// Disposable acceptance fixtures only. Never point this script at the working database.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$expected = realpath(storage_path('app')).DIRECTORY_SEPARATOR.'ai-acceptance.sqlite';
if (! app()->environment('ai_acceptance') || config('database.default') !== 'sqlite'
    || config('database.connections.sqlite.database') !== $expected || ! is_file($expected) || filesize($expected) !== 0) {
    throw new RuntimeException('Requires a new empty storage/app/ai-acceptance.sqlite and APP_ENV=ai_acceptance.');
}
foreach (glob(database_path('migrations/*.php')) as $path) {
    // The unrelated pending foundation changes are not needed for AI acceptance.
    if (str_contains($path, '000015_') || str_contains($path, '000016_')) {
        continue;
    }
    (require $path)->up();
}
(new RoleSeeder)->run();
$users = [];
foreach (['admin', 'supervisor', 'shopper'] as $index => $role) {
    $user = User::factory()->create(['email' => 'ai-'.$role.'@example.test', 'password' => 'SandboxPass123!',
        'role_id' => Role::where('slug', $role)->value('role_id')]);
    $user->profile()->create(['first_name' => 'AI Sandbox', 'last_name' => ucfirst($role),
        'phone_number' => '+63900000000'.($index + 1)]);
    $users[$role] = $user;
}
foreach (['A', 'B'] as $letter) {
    $store = Store::create(['store_name' => 'AI Test Store '.$letter, 'address' => 'Disposable acceptance fixture']);
    $store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => '00:00', 'closes_at' => '23:59'])])->save();
    foreach (['Rice', 'Brown Rice', 'Spaghetti Pasta', 'Tomato Sauce', 'Milk', 'Eggs'] as $index => $name) {
        $product = Product::create(['store_id' => $store->store_id, 'product_name' => $letter.' '.$name, 'sku' => 'AI-'.$index,
            'category' => $index < 2 ? 'Staples' : ($index < 4 ? 'Pasta' : 'Breakfast'), 'size' => 'Test pack']);
        $inventory = StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id,
            'selling_price' => $letter === 'A' ? '45.25' : '99.00', 'hard_stock_qty' => 10, 'soft_stock_qty' => 0, 'status' => 'active']);
        $inventory->forceFill(['max_per_order' => 3])->save();
    }
    if ($letter === 'A') {
        $users['supervisor']->forceFill(['staff_approved_at' => now(), 'staff_approved_by_user_id' => $users['admin']->id])->save();
        StaffStoreAssignment::create(['user_id' => $users['supervisor']->id, 'store_id' => $store->store_id, 'assigned_by_user_id' => $users['admin']->id]);
    }
}
echo "Created disposable AI acceptance fixture. Pending 000015/000016 skipped; no provider calls configured.\n";
