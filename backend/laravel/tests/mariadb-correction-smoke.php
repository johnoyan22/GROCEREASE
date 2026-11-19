<?php

// Isolated-process concurrency QA. Only the fixed random test database may be created/dropped.
use App\Http\Controllers\Api\StockReceiptController;
use App\Http\Controllers\Api\StoreInventoryController;
use App\Models\InventoryBatch;
use App\Models\StockAdjustment;
use App\Models\Order;
use App\Models\Worker;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\WorkerAssignmentController;
use App\Http\Controllers\Api\PickupController;
use App\Models\Product;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\StockReceipt;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$mode = $argv[1] ?? ''; $suffix = $argv[2] ?? '';
if (!preg_match('/^[a-f0-9]{12}$/D', $suffix)) throw new RuntimeException('Invalid isolated test identifier.');
$database = 'grocerease_correction_test_'.$suffix;
$runtime = realpath(__DIR__.'/../../..').'/tmp/correction-'.$suffix.'.json';
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
if (DB::connection()->getDatabaseName() !== $database || !str_starts_with($database, 'grocerease_correction_test_')) throw new RuntimeException('Unsafe database target.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 10');
function invoke(string $class, string $method, array $payload, int $userId, array $arguments = []): array
{
    $request = Request::create('/isolated-receiving-qa', 'POST', $payload);
    $request->setUserResolver(fn () => User::findOrFail($userId));
    $response = app()->call([app($class), $method], ['request' => $request, ...$arguments]);
    return ['status' => $response->getStatusCode(), 'data' => $response->getData(true)];
}

function countPayload(array $state, int $batch, int $actual, string $operation): array
{
    return ['inventory_batch_id' => $batch, 'requested_remaining_quantity' => $actual, 'operation_id' => $operation,
        'expected_stock_version' => StoreInventory::findOrFail($state['inventory'])->stock_version, 'reason' => 'Isolated count evidence.'];
}
function decideCount(array $state, int $id, string $decision, int $index = 0): array
{
    return invoke(StockAdjustmentController::class, 'decide', ['decision' => $decision, 'decision_note' => $decision === 'rejected' ? 'QA resubmission.' : null],
        $state['supervisors'][$index % 2], ['adjustment' => $id]);
}
function verifyTotals(array $state): void
{
    $inventory = StoreInventory::findOrFail($state['inventory']);
    if ($inventory->hard_stock_qty !== (int) $inventory->batches()->sum('remaining_quantity') || $inventory->soft_stock_qty < 0) throw new RuntimeException('Batch/product invariant failed.');
    $reserved = (int) DB::table('order_batch_allocations')->where('status', 'reserved')->sum('quantity');
    if ($reserved !== $inventory->soft_stock_qty) throw new RuntimeException('Reservation totals changed incorrectly.');
    foreach (InventoryBatch::all() as $batch) {
        $allocated = (int) DB::table('order_batch_allocations')->where('inventory_batch_id', $batch->id)->where('status', 'reserved')->sum('quantity');
        if ($batch->remaining_quantity < $allocated) throw new RuntimeException('Correction consumed allocated stock.');
    }
}
try {
    if ($mode === 'setup') {
        if (Artisan::call('migrate', ['--database' => 'mysql', '--force' => true]) !== 0) throw new RuntimeException(Artisan::output());
        (new Database\Seeders\RoleSeeder)->run();
        $admin = User::factory()->create(['role_id' => Role::where('slug', 'admin')->value('role_id')]);
        $store = Store::create(['store_name' => 'Isolated correction QA', 'address' => 'Test only']);
        $store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => '00:00', 'closes_at' => '23:59'])])->save();
        $state = ['workers' => [], 'supervisors' => [], 'operation' => (string) Str::uuid(), 'race_operations' => [(string) Str::uuid(), (string) Str::uuid()]];
        foreach (['inventory_worker' => 'workers', 'supervisor' => 'supervisors'] as $role => $key) foreach ([0, 1] as $i) {
            $user = User::factory()->create(['role_id' => Role::where('slug', $role)->value('role_id'), 'staff_approved_at' => now(), 'staff_approved_by_user_id' => $admin->id]);
            StaffStoreAssignment::create(['store_id' => $store->store_id, 'user_id' => $user->id, 'assigned_by_user_id' => $admin->id]);
            $state[$key][] = $user->id;
        }
        $product = invoke(StoreInventoryController::class, 'store', ['product_name' => 'Coke', 'category' => 'Drinks', 'selling_price' => '1.00',
            'status' => 'active', 'selling_unit' => 'bottle'], $state['workers'][0])['data']['inventory'];
        $state['inventory'] = $product['store_inventory_id']; $state['store'] = $store->store_id;
        foreach ([100, 50] as $i => $quantity) {
            $receipt = invoke(StockReceiptController::class, 'store', ['operation_id' => (string) Str::uuid(), 'quantity' => $quantity,
                'received_date' => now('Asia/Manila')->format('Y-m-d'), 'expiry_date' => $i ? '2028-02-01' : '2028-01-01', 'description' => 'Original receiving evidence.'],
                $state['workers'][0], ['item' => $state['inventory']]);
            invoke(StockReceiptController::class, 'decide', ['decision' => 'approved'], $state['supervisors'][0], ['receipt' => $receipt['data']['receipt']['id']]);
        }
        $state['a'] = InventoryBatch::orderBy('id')->firstOrFail()->id; $state['b'] = InventoryBatch::orderByDesc('id')->firstOrFail()->id;
        $state['version'] = StoreInventory::findOrFail($state['inventory'])->stock_version;
        file_put_contents($runtime, json_encode($state)); echo json_encode(['status' => 'ready']);
    } else {
        $state = json_decode(file_get_contents($runtime), true, 512, JSON_THROW_ON_ERROR);
        $index = (int) ($argv[3] ?? 0);
        $args = ['item' => $state['inventory']];
        if ($mode === 'duplicate' || $mode === 'race-submit') {
            $payload = countPayload($state, $state['b'], 40, $mode === 'duplicate' ? $state['operation'] : $state['race_operations'][$index]);
            $payload['expected_stock_version'] = $state['version'];
            $result = invoke(StockAdjustmentController::class, 'store', $payload, $state['workers'][$mode === 'duplicate' ? 0 : $index], $args);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'reject') {
            $id = StockAdjustment::where('status', 'pending')->value('id');
            echo json_encode(['status' => decideCount($state, $id, 'rejected')['status']]);
        } elseif ($mode === 'approve') {
            $record = StockAdjustment::where('status', 'pending')->first() ?? StockAdjustment::orderByDesc('id')->firstOrFail();
            echo json_encode(['status' => decideCount($state, $record->id, 'approved', $index)['status']]);
        } elseif ($mode === 'verify-initial') {
            verifyTotals($state);
            if (InventoryBatch::count() !== 2 || InventoryBatch::find($state['a'])->remaining_quantity !== 100 || InventoryBatch::find($state['b'])->remaining_quantity !== 40
                || StockAdjustment::count() !== 2 || DB::table('batch_correction_logs')->count() !== 1) throw new RuntimeException('Exact selected-batch race failed.');
            echo json_encode(['status' => 'passed']);
        } elseif ($mode === 'receipt-setup') {
            invoke(StockAdjustmentController::class, 'store', countPayload($state, $state['b'], 45, (string) Str::uuid()), $state['workers'][0], $args);
            $state['receipt'] = invoke(StockReceiptController::class, 'store', ['operation_id' => (string) Str::uuid(), 'quantity' => 10,
                'received_date' => now('Asia/Manila')->format('Y-m-d'), 'expiry_date' => '2028-03-01', 'description' => 'Racing delivery.'], $state['workers'][0], $args)['data']['receipt']['id'];
            file_put_contents($runtime, json_encode($state)); echo json_encode(['status' => 'ready']);
        } elseif ($mode === 'receipt') {
            $result = invoke(StockReceiptController::class, 'decide', ['decision' => 'approved'], $state['supervisors'][1], ['receipt' => $state['receipt']]);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'reservation-setup') {
            verifyTotals($state);
            foreach (StockAdjustment::where('status', 'pending')->get() as $record) decideCount($state, $record->id, 'rejected');
            invoke(StockAdjustmentController::class, 'store', countPayload($state, $state['a'], 1, (string) Str::uuid()), $state['workers'][0], $args);
            $shopper = User::factory()->create(['role_id' => Role::where('slug', 'shopper')->value('role_id')]); $state['shopper'] = $shopper->id;
            $cart = ['store_id' => $state['store'], 'items' => [['store_inventory_id' => $state['inventory'], 'quantity' => 2]],
                'pickup_date' => now('Asia/Manila')->addDay()->format('Y-m-d'), 'pickup_start' => '10:00', 'pickup_end' => '11:00'];
            $state['cart'] = $cart;
            $quote = invoke(CheckoutController::class, 'quote', $cart, $shopper->id)['data']['quote_token'];
            $state['placement'] = [...$cart, 'quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()];
            file_put_contents($runtime, json_encode($state)); echo json_encode(['status' => 'ready']);
        } elseif ($mode === 'reserve') {
            $result = invoke(CheckoutController::class, 'store', $state['placement'], $state['shopper']);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'handover-setup') {
            verifyTotals($state);
            foreach (StockAdjustment::where('status', 'pending')->get() as $record) decideCount($state, $record->id, 'rejected');
            if (!Order::count()) {
                $quote = invoke(CheckoutController::class, 'quote', $state['cart'], $state['shopper'])['data']['quote_token'];
                invoke(CheckoutController::class, 'store', [...$state['cart'], 'quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()], $state['shopper']);
            }
            $order = Order::firstOrFail(); $state['order'] = $order->order_id; $orderArgs = ['order' => $order->order_id]; $supervisor = $state['supervisors'][0];
            $worker = Worker::create(['store_id' => $state['store'], 'full_name' => 'QA Picker', 'work_type' => 'picker_packer', 'created_by_user_id' => $supervisor]);
            invoke(WorkerAssignmentController::class, 'assign', ['worker_id' => $worker->worker_id], $supervisor, $orderArgs);
            invoke(OrderController::class, 'updateStatus', ['status' => 'preparing'], $supervisor, $orderArgs);
            $item = $order->items()->firstOrFail();
            invoke(WorkerAssignmentController::class, 'prepare', ['items' => [['order_item_id' => $item->order_item_id, 'prepared_qty' => 2]]], $supervisor, $orderArgs);
            invoke(WorkerAssignmentController::class, 'complete', [], $supervisor, $orderArgs);
            invoke(OrderController::class, 'updateStatus', ['status' => 'ready_for_pickup'], $supervisor, $orderArgs);
            $secret = invoke(PickupController::class, 'shopperPickup', [], $state['shopper'], $orderArgs)['data']['credential'];
            invoke(PickupController::class, 'confirmCash', ['cashier_name' => 'QA Cashier', 'evidence_reference' => 'QA-ONLY', 'cash_collected' => true], $supervisor, $orderArgs);
            invoke(PickupController::class, 'verify', ['method' => 'pin', 'credential' => $secret['pin'], 'claimant_name' => 'QA Shopper', 'identity_checked' => true], $supervisor, $orderArgs);
            invoke(StockAdjustmentController::class, 'store', countPayload($state, $state['b'], InventoryBatch::find($state['b'])->remaining_quantity + 5, (string) Str::uuid()), $state['workers'][0], $args);
            file_put_contents($runtime, json_encode($state)); echo json_encode(['status' => 'ready']);
        } elseif ($mode === 'handover') {
            $result = invoke(PickupController::class, 'handover', ['physically_handed_over' => true], $state['supervisors'][0], ['order' => $state['order']]);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'verify') {
            verifyTotals($state);
            $batch = InventoryBatch::find($state['b']);
            if (InventoryBatch::count() !== 3 || $batch->quantity_received !== 50 || $batch->expiry_date->format('Y-m-d') !== '2028-02-01'
                || DB::table('order_handovers')->count() !== 1 || StoreInventory::find($state['inventory'])->soft_stock_qty !== 0) throw new RuntimeException('Final race invariant failed.');
            echo json_encode(['status' => 'passed']);
        } elseif ($mode === 'search') {
            $batch = InventoryBatch::find($state['b']);
            $result = invoke(StockAdjustmentController::class, 'batches', ['search' => InventoryBatch::displayNumber($batch->id, $batch->reference)], $state['workers'][0]);
            if ($result['data']['pagination']['total'] !== 1 || $result['data']['batches'][0]['id'] !== $batch->id) throw new RuntimeException('MariaDB stable batch number search failed.');
            echo json_encode(['status' => 'passed']);
        } else throw new RuntimeException('Unsupported isolated action.');
    }
} catch (\Illuminate\Validation\ValidationException $error) {
    echo json_encode(['status' => 422, 'errors' => $error->errors()]);
} catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) {
    echo json_encode(['status' => $error->getStatusCode(), 'message' => $error->getMessage()]);
}
