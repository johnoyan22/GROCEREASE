<?php

use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\StorePickupSettingsController;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use App\Services\CheckoutPricing;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$mode = $argv[1] ?? ''; $suffix = $argv[2] ?? '';
if (!preg_match('/^[a-f0-9]{12}$/D', $suffix)) throw new RuntimeException('Invalid isolated test identifier.');
$database = 'grocerease_windows_test_'.$suffix;
$runtime = realpath(__DIR__.'/../../..').'/tmp/windows-'.$suffix.'.json';
$connection = config('database.connections.mysql');
$server = new PDO('mysql:host='.$connection['host'].';port='.$connection['port'].';charset=utf8mb4', $connection['username'], $connection['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ($mode === 'cleanup') {
    $server->exec('DROP DATABASE IF EXISTS `'.$database.'`');
    if (is_file($runtime)) unlink($runtime);
    echo json_encode(['cleaned' => true]); exit;
}
if ($mode === 'setup') $server->exec('CREATE DATABASE `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
config(['database.default' => 'mysql', 'database.connections.mysql.database' => $database, 'cache.default' => 'array', 'session.driver' => 'array', 'mail.default' => 'array']);
DB::purge('mysql');
if (DB::connection()->getDatabaseName() !== $database || !str_starts_with($database, 'grocerease_windows_test_')) throw new RuntimeException('Unsafe database target.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 10');
\Carbon\CarbonImmutable::setTestNow('2026-11-17 01:00:00 UTC');
\Carbon\Carbon::setTestNow('2026-11-17 01:00:00 UTC');
function invoke(string $class, string $method, array $payload, int $user): array
{
    $request = Request::create('/isolated-windows-qa', 'POST', $payload);
    $request->setUserResolver(fn () => User::findOrFail($user));
    $response = app()->call([app($class), $method], ['request' => $request]);
    return ['status' => $response->getStatusCode(), 'data' => $response->getData(true)];
}
try {
    if ($mode === 'setup') {
        if (Artisan::call('migrate', ['--database' => 'mysql', '--force' => true]) !== 0) throw new RuntimeException(Artisan::output());
        (new Database\Seeders\RoleSeeder)->run();
        $admin = User::factory()->create(['role_id' => Role::where('slug', 'admin')->value('role_id')]);
        $store = Store::create(['store_name' => 'Isolated pickup windows QA', 'address' => 'Test only']);
        if ($store->fresh()->pickup_preparation_minutes !== 60 || $store->fresh()->pickup_window_minutes !== 60) throw new RuntimeException('Migration defaults failed.');
        $hours = array_fill(1, 7, ['opens_at' => '08:00', 'closes_at' => '18:00']);
        $store->forceFill(['operating_hours' => $hours, 'pickup_service_hours' => $hours])->save();
        $supervisor = User::factory()->create(['role_id' => Role::where('slug', 'supervisor')->value('role_id'), 'staff_approved_at' => now(), 'staff_approved_by_user_id' => $admin->id]);
        StaffStoreAssignment::create(['store_id' => $store->store_id, 'user_id' => $supervisor->id, 'assigned_by_user_id' => $admin->id]);
        $shopper = User::factory()->create(['role_id' => Role::where('slug', 'shopper')->value('role_id')]);
        $product = \Tests\Support\CategoryFixture::product(['store_id' => $store->store_id, 'product_name' => 'Rice', 'category' => 'Staples', 'selling_unit' => 'bag']);
        $item = StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id, 'hard_stock_qty' => 100, 'soft_stock_qty' => 0, 'selling_price' => '50.00', 'status' => 'active']);
        $state = ['supervisor' => $supervisor->id, 'shopper' => $shopper->id, 'store' => $store->store_id, 'item' => $item->store_inventory_id, 'hours' => $hours];
        file_put_contents($runtime, json_encode($state)); echo json_encode(['status' => 'ready']);
    } else {
        $state = json_decode(file_get_contents($runtime), true, 512, JSON_THROW_ON_ERROR);
        if (in_array($mode, ['reset', 'update'], true)) {
            $result = invoke(StorePickupSettingsController::class, 'supervisorUpdate', ['operating_hours' => $state['hours'], 'pickup_service_hours' => $state['hours'], 'paid_order_holding_hours' => null,
                'pickup_preparation_minutes' => $mode === 'reset' ? 180 : 30, 'pickup_window_minutes' => $mode === 'reset' ? 60 : 120], $state['supervisor']);
            echo json_encode(['status' => $result['status']]);
        } elseif (in_array($mode, ['quote', 'place'], true)) {
            $payload = ['store_id' => $state['store'], 'items' => [['store_inventory_id' => $state['item'], 'quantity' => 2]], 'pickup_date' => '2026-11-17', 'pickup_start' => '10:00', 'pickup_end' => '11:00'];
            if ($mode === 'place') {
                $cart = app(CheckoutPricing::class)->validatedCart(Request::create('/', 'POST', $payload));
                $payload += ['idempotency_key' => (string) Str::uuid(), 'quote_token' => Crypt::encryptString(json_encode(['shopper_user_id' => $state['shopper'], 'cart_hash' => app(CheckoutPricing::class)->cartHash($cart), 'price_hash' => str_repeat('a', 64), 'expires_at' => now()->addMinutes(5)->timestamp]))];
            }
            $result = invoke(CheckoutController::class, $mode === 'quote' ? 'quote' : 'store', $payload, $state['shopper']);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'verify') {
            $item = StoreInventory::findOrFail($state['item']); $store = Store::findOrFail($state['store']);
            if (DB::table('orders')->count() || DB::table('payment_checkout_attempts')->count() || $item->soft_stock_qty !== 0 || $item->hard_stock_qty !== 100
                || $store->pickup_preparation_minutes !== 30 || $store->pickup_window_minutes !== 120) throw new RuntimeException('Atomic policy or rejection invariant failed.');
            echo json_encode(['status' => 'passed']);
        } else throw new RuntimeException('Unsupported isolated action.');
    }
} catch (\Illuminate\Validation\ValidationException $error) {
    echo json_encode(['status' => 422, 'errors' => $error->errors()]);
} catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) {
    echo json_encode(['status' => $error->getStatusCode()]);
}
