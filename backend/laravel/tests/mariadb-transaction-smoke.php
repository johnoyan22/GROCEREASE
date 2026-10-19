<?php

// Invoked by mariadb-transaction-smoke.mjs. Never accepts an arbitrary database name.
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PickupController;
use App\Http\Controllers\Api\WorkerAssignmentController;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$mode = $argv[1] ?? '';
$suffix = $argv[2] ?? '';
if (!preg_match('/^[a-f0-9]{12}$/D', $suffix)) throw new RuntimeException('Invalid isolated test identifier.');
$database = 'grocerease_sprint_test_'.$suffix;
$runtime = realpath(__DIR__.'/../../..').'/tmp/mariadb-sprint-'.$suffix.'.json';
$connection = config('database.connections.mysql');
$server = new PDO('mysql:host='.$connection['host'].';port='.$connection['port'].';charset=utf8mb4', $connection['username'], $connection['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ($mode === 'cleanup') {
    // The identifier is constructed from the fixed test-only prefix and a validated random suffix.
    $server->exec('DROP DATABASE IF EXISTS `'.$database.'`');
    if (is_file($runtime)) unlink($runtime);
    echo json_encode(['cleaned' => true]);
    exit;
}
if ($mode === 'setup') {
    if (is_file($runtime)) throw new RuntimeException('Isolated test already exists.');
    $server->exec('CREATE DATABASE `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
}
config(['database.default' => 'mysql', 'database.connections.mysql.database' => $database,
    'cache.default' => 'array', 'session.driver' => 'array', 'mail.default' => 'array']);
DB::purge('mysql');
if (DB::connection()->getDatabaseName() !== $database || !str_starts_with($database, 'grocerease_sprint_test_')) throw new RuntimeException('Unsafe database target.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 10');

function invokeController(string $class, string $method, array $payload, int $userId, ?int $orderId = null): array
{
    $request = Request::create('/isolated-test', 'POST', $payload);
    $request->setUserResolver(function () use ($userId) { return User::findOrFail($userId); });
    $arguments = ['request' => $request];
    if ($orderId !== null) $arguments['order'] = $orderId;
    $response = app()->call([app($class), $method], $arguments);
    return ['status' => $response->getStatusCode(), 'data' => $response->getData(true)];
}

try {
    if ($mode === 'setup') {
        if (Artisan::call('migrate', ['--database' => 'mysql', '--force' => true]) !== 0) throw new RuntimeException(Artisan::output());
        (new Database\Seeders\RoleSeeder)->run();
        $admin = User::factory()->create(['role_id' => Role::where('slug', 'admin')->firstOrFail()->role_id]);
        $supervisor = User::factory()->create(['role_id' => Role::where('slug', 'supervisor')->firstOrFail()->role_id,
            'staff_approved_at' => now(), 'staff_approved_by_user_id' => $admin->id]);
        $store = Store::create(['store_name' => 'Isolated concurrency test', 'address' => 'Test only']);
        $store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => '00:00', 'closes_at' => '23:59'])])->save();
        StaffStoreAssignment::create(['store_id' => $store->store_id, 'user_id' => $supervisor->id, 'assigned_by_user_id' => $admin->id]);
        $worker = Worker::create(['store_id' => $store->store_id, 'full_name' => 'Isolated Worker', 'work_type' => 'picker_packer', 'created_by_user_id' => $supervisor->id]);
        $attempts = [];
        $inventoryIds = [];
        foreach ([1, 2] as $number) {
            $product = Product::create(['store_id' => $store->store_id, 'product_name' => 'Test product '.$number, 'sku' => 'TEST'.$number, 'category' => 'Test']);
            $inventoryIds[] = StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id,
                'selling_price' => '10.00', 'hard_stock_qty' => 1, 'soft_stock_qty' => 0, 'status' => 'active'])->store_inventory_id;
        }
        foreach ([1, 2] as $number) {
            $shopper = User::factory()->create(['role_id' => Role::where('slug', 'shopper')->firstOrFail()->role_id]);
            $cart = ['store_id' => $store->store_id, 'items' => [['store_inventory_id' => $inventoryIds[0], 'quantity' => 1]],
                'pickup_date' => now('Asia/Manila')->addDay()->format('Y-m-d'), 'pickup_start' => '10:00', 'pickup_end' => '11:00'];
            $quote = invokeController(CheckoutController::class, 'quote', $cart, $shopper->id);
            $attempts[] = ['user_id' => $shopper->id, 'payload' => array_merge($cart, ['quote_token' => $quote['data']['quote_token'], 'idempotency_key' => (string) Str::uuid()])];
        }
        file_put_contents($runtime, json_encode(['attempts' => $attempts, 'supervisor_id' => $supervisor->id, 'worker_id' => $worker->worker_id, 'inventory_ids' => $inventoryIds]));
        echo json_encode(['status' => 'isolated_schema_ready']);
    } else {
        $state = json_decode(file_get_contents($runtime), true, 512, JSON_THROW_ON_ERROR);
        if ($mode === 'reserve') {
            $attempt = $state['attempts'][(int) ($argv[3] ?? 0)];
            $result = invokeController(CheckoutController::class, 'store', $attempt['payload'], $attempt['user_id']);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'second-order') {
            if (Order::count() !== 1 || (int) DB::table('store_inventory')->where('store_inventory_id', $state['inventory_ids'][0])->value('soft_stock_qty') !== 1) throw new RuntimeException('Concurrent reservation invariant failed.');
            $attempt = $state['attempts'][1];
            $cart = $attempt['payload']; unset($cart['quote_token'], $cart['idempotency_key']);
            $cart['items'][0]['store_inventory_id'] = $state['inventory_ids'][1];
            $quote = invokeController(CheckoutController::class, 'quote', $cart, $attempt['user_id']);
            invokeController(CheckoutController::class, 'store', array_merge($cart, ['quote_token' => $quote['data']['quote_token'], 'idempotency_key' => (string) Str::uuid()]), $attempt['user_id']);
            $state['order_ids'] = Order::orderBy('order_id')->pluck('order_id')->all();
            file_put_contents($runtime, json_encode($state));
            echo json_encode(['status' => 'second_order_ready']);
        } elseif ($mode === 'assign') {
            $result = invokeController(WorkerAssignmentController::class, 'assign', ['worker_id' => $state['worker_id']], $state['supervisor_id'], $state['order_ids'][(int) ($argv[3] ?? 0)]);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'prepare') {
            if (DB::table('active_worker_assignments')->count() !== 1) throw new RuntimeException('Concurrent assignment invariant failed.');
            $orderId = (int) DB::table('active_worker_assignments')->value('order_id');
            $userId = $state['supervisor_id'];
            invokeController(OrderController::class, 'updateStatus', ['status' => 'preparing'], $userId, $orderId);
            $item = Order::findOrFail($orderId)->items()->firstOrFail();
            invokeController(WorkerAssignmentController::class, 'prepare', ['items' => [['order_item_id' => $item->order_item_id, 'prepared_qty' => 1]]], $userId, $orderId);
            invokeController(WorkerAssignmentController::class, 'complete', [], $userId, $orderId);
            invokeController(OrderController::class, 'updateStatus', ['status' => 'ready_for_pickup'], $userId, $orderId);
            $order = Order::findOrFail($orderId);
            $secret = invokeController(PickupController::class, 'shopperPickup', [], $order->shopper_user_id, $orderId)['data']['credential'];
            invokeController(PickupController::class, 'confirmCash', ['cashier_name' => 'Isolated Cashier', 'evidence_reference' => 'TEST-ONLY', 'cash_collected' => true], $userId, $orderId);
            invokeController(PickupController::class, 'verify', ['method' => 'pin', 'credential' => $secret['pin'], 'claimant_name' => 'Isolated Claimant', 'identity_checked' => true], $userId, $orderId);
            $state['completion_order_id'] = $orderId;
            $state['completion_inventory_id'] = $item->store_inventory_id;
            file_put_contents($runtime, json_encode($state));
            echo json_encode(['status' => 'ready_for_concurrent_handover']);
        } elseif ($mode === 'handover') {
            $result = invokeController(PickupController::class, 'handover', ['physically_handed_over' => true], $state['supervisor_id'], $state['completion_order_id']);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'verify') {
            $inventory = StoreInventory::findOrFail($state['completion_inventory_id']);
            if ($inventory->hard_stock_qty !== 0 || $inventory->soft_stock_qty !== 0 || DB::table('order_handovers')->count() !== 1 || DB::table('order_payments')->count() !== 1) throw new RuntimeException('Concurrent completion invariant failed.');
            echo json_encode(['status' => 'all_invariants_passed']);
        } else throw new RuntimeException('Unsupported isolated test action.');
    }
} catch (ValidationException $exception) {
    echo json_encode(['status' => 422]);
} catch (HttpExceptionInterface $exception) {
    echo json_encode(['status' => $exception->getStatusCode()]);
}
