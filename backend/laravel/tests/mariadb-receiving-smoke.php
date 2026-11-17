<?php

// Isolated-process concurrency QA. Only the fixed random test database may be created/dropped.
use App\Http\Controllers\Api\StockReceiptController;
use App\Http\Controllers\Api\StoreInventoryController;
use App\Models\InventoryBatch;
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
$database = 'grocerease_receiving_test_'.$suffix;
$runtime = realpath(__DIR__.'/../../..').'/tmp/receiving-'.$suffix.'.json';
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
if (DB::connection()->getDatabaseName() !== $database || !str_starts_with($database, 'grocerease_receiving_test_')) throw new RuntimeException('Unsafe database target.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 10');
function invoke(string $class, string $method, array $payload, int $userId, array $arguments = []): array
{
    $request = Request::create('/isolated-receiving-qa', 'POST', $payload);
    $request->setUserResolver(fn () => User::findOrFail($userId));
    $response = app()->call([app($class), $method], ['request' => $request, ...$arguments]);
    return ['status' => $response->getStatusCode(), 'data' => $response->getData(true)];
}
try {
    if ($mode === 'setup') {
        if (Artisan::call('migrate', ['--database' => 'mysql', '--force' => true]) !== 0) throw new RuntimeException(Artisan::output());
        (new Database\Seeders\RoleSeeder)->run();
        $admin = User::factory()->create(['role_id' => Role::where('slug', 'admin')->value('role_id')]);
        $store = Store::create(['store_name' => 'Isolated receiving QA', 'address' => 'Test only']);
        $workers = []; $supervisors = [];
        foreach (['inventory_worker', 'supervisor'] as $role) {
            foreach ([0, 1] as $i) {
                $user = User::factory()->create(['role_id' => Role::where('slug', $role)->value('role_id'), 'staff_approved_at' => now(), 'staff_approved_by_user_id' => $admin->id]);
                StaffStoreAssignment::create(['store_id' => $store->store_id, 'user_id' => $user->id, 'assigned_by_user_id' => $admin->id]);
                if ($role === 'inventory_worker') $workers[] = $user->id; else $supervisors[] = $user->id;
            }
        }
        $product = invoke(StoreInventoryController::class, 'store', ['product_name' => 'Coke', 'category_id' => \Tests\Support\CategoryFixture::id($store->store_id, 'Drinks'), 'selling_price' => '1.00',
            'status' => 'active', 'size_amount' => 1.5, 'size_unit' => 'L', 'selling_unit' => 'bottle'], $workers[0])['data']['inventory'];
        file_put_contents($runtime, json_encode(['workers' => $workers, 'supervisors' => $supervisors, 'product' => $product, 'operation' => (string) Str::uuid()]));
        echo json_encode(['status' => 'ready']);
    } else {
        $state = json_decode(file_get_contents($runtime), true, 512, JSON_THROW_ON_ERROR);
        $index = (int) ($argv[3] ?? 0);
        if ($mode === 'create') {
            $result = invoke(StoreInventoryController::class, 'store', ['product_name' => 'Concurrent product '.$index, 'category_id' => $state['product']['category_id'], 'selling_price' => '1.00',
                'status' => 'active', 'selling_unit' => 'piece'], $state['workers'][$index % 2]);
            echo json_encode(['status' => $result['status'], 'sku' => $result['data']['inventory']['sku']]);
        } elseif ($mode === 'submit') {
            $result = invoke(StockReceiptController::class, 'store', ['operation_id' => $state['operation'], 'quantity' => 100,
                'received_date' => now('Asia/Manila')->format('Y-m-d'), 'expiry_date' => '2027-12-31', 'description' => 'Concurrent delivery.'],
                $state['workers'][0], ['item' => $state['product']['store_inventory_id']]);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'approve') {
            $receipt = StockReceipt::where('operation_id', $state['operation'])->firstOrFail();
            $result = invoke(StockReceiptController::class, 'decide', ['decision' => 'approved'], $state['supervisors'][$index % 2], ['receipt' => $receipt->id]);
            echo json_encode(['status' => $result['status']]);
        } elseif ($mode === 'verify') {
            $inventory = StoreInventory::findOrFail($state['product']['store_inventory_id']);
            if ($inventory->hard_stock_qty !== 100 || $inventory->soft_stock_qty !== 0 || InventoryBatch::count() !== 1 || StockReceipt::count() !== 1) throw new RuntimeException('Duplicate receiving invariant failed.');
            if ($inventory->product->sku !== $state['product']['sku'] || Product::count() !== 9 || Product::distinct()->count('sku') !== 9) throw new RuntimeException('SKU invariant failed.');
            if ((int) InventoryBatch::sum('remaining_quantity') !== 100) throw new RuntimeException('Batch balance invariant failed.');
            echo json_encode(['status' => 'all_invariants_passed']);
        } else throw new RuntimeException('Unsupported isolated test action.');
    }
} catch (\Illuminate\Validation\ValidationException $error) {
    echo json_encode(['status' => 422, 'errors' => $error->errors()]);
} catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) {
    echo json_encode(['status' => $error->getStatusCode()]);
}
