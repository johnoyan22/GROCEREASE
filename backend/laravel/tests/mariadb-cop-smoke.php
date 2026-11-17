<?php

// Test-only isolated database. No arbitrary database names or working-data resets are accepted.
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\CopManagementController;
use App\Models\Order;
use App\Models\Role;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use App\Services\CopPolicy;
use App\Services\CopRestrictions;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php'; $app->make(Kernel::class)->bootstrap();
[$mode, $suffix, $argument] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? '0'];
if (!preg_match('/^[a-f0-9]{12}$/D', $suffix)) throw new RuntimeException('Invalid isolated COP test identifier.');
$database = 'grocerease_cop_test_'.$suffix;
$runtime = realpath(__DIR__.'/../../..').'/tmp/mariadb-cop-'.$suffix.'.json';
$connection = config('database.connections.mysql');
$server = new PDO('mysql:host='.$connection['host'].';port='.$connection['port'].';charset=utf8mb4', $connection['username'], $connection['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ($mode === 'cleanup') {
    $server->exec('DROP DATABASE IF EXISTS `'.$database.'`'); if (is_file($runtime)) unlink($runtime);
    echo json_encode(['cleaned' => true]); exit;
}
if ($mode === 'setup') $server->exec('CREATE DATABASE `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
config(['database.default' => 'mysql', 'database.connections.mysql.database' => $database, 'cache.default' => 'array', 'session.driver' => 'array', 'mail.default' => 'array']);
DB::purge('mysql');
if (DB::connection()->getDatabaseName() !== $database || !str_starts_with($database, 'grocerease_cop_test_')) throw new RuntimeException('Unsafe COP test target.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 10');
CarbonImmutable::setTestNow('2032-05-11 16:01:00 UTC'); \Illuminate\Support\Carbon::setTestNow('2032-05-11 16:01:00 UTC');

function callCop(string $method, array $payload, int $actor, ?int $user = null, ?int $strike = null): array
{
    $request = Request::create('/isolated-cop', 'PUT', $payload); $request->setUserResolver(fn () => User::findOrFail($actor));
    $args = ['request' => $request]; if ($user !== null) $args['user'] = $user; if ($strike !== null) $args['strike'] = $strike;
    $response = app()->call([app(CopManagementController::class), $method], $args);
    return ['status' => $response->getStatusCode(), 'data' => $response->getData(true)];
}
function callCheckout(string $method, array $payload, int $user): array
{
    $request = Request::create('/isolated-checkout', 'POST', $payload); $request->setUserResolver(fn () => User::findOrFail($user));
    $response = app()->call([app(CheckoutController::class), $method], ['request' => $request]);
    return ['status' => $response->getStatusCode(), 'data' => $response->getData(true)];
}
try {
    if ($mode === 'setup') {
        if (Artisan::call('migrate', ['--database' => 'mysql', '--force' => true]) !== 0) throw new RuntimeException(Artisan::output());
        (new Database\Seeders\RoleSeeder)->run();
        $admin = User::factory()->create(['role_id' => Role::where('slug', 'admin')->value('role_id')]);
        $shopper = User::factory()->create(['role_id' => Role::where('slug', 'shopper')->value('role_id')]);
        $store = Store::create(['store_name' => 'Isolated COP QA', 'address' => 'Test only']);
        $store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => '00:00', 'closes_at' => '23:59'])])->save();
        $product = \Tests\Support\CategoryFixture::product(['store_id' => $store->store_id, 'product_name' => 'COP race fixture', 'sku' => 'COP-QA', 'category' => 'Test']);
        $inventory = StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id, 'selling_price' => '10.00', 'hard_stock_qty' => 100, 'soft_stock_qty' => 0, 'status' => 'active']);
        $cart = ['store_id' => $store->store_id, 'items' => [['store_inventory_id' => $inventory->store_inventory_id, 'quantity' => 1]], 'pickup_date' => '2032-05-12', 'pickup_start' => '10:00', 'pickup_end' => '11:00'];
        $orders = [];
        for ($i = 0; $i < 4; $i++) {
            $quote = callCheckout('quote', $cart, $shopper->id)['data']['quote_token'];
            $orders[] = callCheckout('store', $cart + ['quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()], $shopper->id)['data']['order']['order_id'];
        }
        file_put_contents($runtime, json_encode(['admin' => $admin->id, 'shopper' => $shopper->id, 'store' => $store->store_id, 'inventory' => $inventory->store_inventory_id, 'orders' => $orders, 'cart' => $cart]));
        echo json_encode(['status' => 'isolated_schema_ready']); exit;
    }
    $state = json_decode(file_get_contents($runtime), true, flags: JSON_THROW_ON_ERROR);
    $user = $state['shopper']; $admin = $state['admin'];
    $decision = ['expected_version' => (int) $argument, 'reason' => 'Isolated reviewed case '.$mode, 'confirmed' => true];
    if ($mode === 'inspect') {
        $status = app(CopRestrictions::class)->status($user);
        echo json_encode(['status' => $status, 'orders' => Order::count(), 'strikes' => DB::table('cop_strikes')->count(), 'voided' => DB::table('cop_strikes')->whereNotNull('voided_at')->count(),
            'incidents' => DB::table('cop_failed_claims')->count(), 'events' => DB::table('cop_access_events')->count(), 'manual_active' => DB::table('cop_restrictions')->where('source', 'manual')->whereNull('ended_at')->count(),
            'policy_versions' => DB::table('cop_policy_versions')->count(), 'reserved' => StoreInventory::findOrFail($state['inventory'])->soft_stock_qty,
            'notifications' => DB::table('order_notifications')->count()]);
    } elseif ($mode === 'restrict' || $mode === 'restrict-change') {
        echo json_encode(callCop('restrict', $decision + ['kind' => 'until_restored'], $admin, $user));
    } elseif ($mode === 'restore') echo json_encode(callCop('restore', $decision, $admin, $user));
    elseif ($mode === 'ensure-restored') {
        $status = app(CopRestrictions::class)->status($user);
        if ($status['individual_restricted']) callCop('restore', ['expected_version' => $status['version'], 'reason' => 'Isolated setup restoration', 'confirmed' => true], $admin, $user);
        echo json_encode(['status' => 'ready']);
    } elseif ($mode === 'policy-a' || $mode === 'policy-b' || $mode === 'disable') {
        $p = app(CopPolicy::class)->current();
        echo json_encode(callCop('savePolicy', $decision + ['enabled' => $mode !== 'disable', 'maximum_php' => $mode === 'policy-a' ? '600.00' : '700.00', 'temporary_threshold' => 2, 'temporary_days' => 30, 'permanent_threshold' => 3], $admin));
    } elseif ($mode === 'ready') {
        // Test fixture of an already genuinely prepared order. Real preparation/claim regressions run separately.
        $order = Order::findOrFail($state['orders'][(int) $argument]);
        $order->forceFill(['status' => 'ready_for_pickup', 'claim_status' => 'claimable', 'ready_at' => '2032-05-11 01:00:00',
            'pickup_window_start_at' => '2032-05-11 02:00:00', 'pickup_window_end_at' => '2032-05-11 03:00:00', 'scheduled_store_closes_at' => '2032-05-11 15:59:00', 'claim_expires_at' => '2032-05-11 15:59:00'])->save();
        echo json_encode(['status' => 'ready']);
    } elseif ($mode === 'deadline') echo json_encode(['status' => 200, 'result' => app(\App\Services\OrderDeadlines::class)->process()]);
    elseif ($mode === 'correct') {
        $strike = DB::table('cop_strikes')->whereNull('voided_at')->orderBy('id')->value('id');
        echo json_encode(callCop('correct', $decision, $admin, strike: $strike));
    } elseif ($mode === 'prepare-checkout') {
        $quote = callCheckout('quote', $state['cart'], $user)['data']['quote_token'];
        $state['checkout'] = $state['cart'] + ['quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()];
        file_put_contents($runtime, json_encode($state)); echo json_encode(['status' => 'reviewed']);
    } elseif ($mode === 'checkout') echo json_encode(callCheckout('store', $state['checkout'], $user));
    else throw new RuntimeException('Unknown COP test mode.');
} catch (ValidationException $exception) { echo json_encode(['status' => 422]); }
catch (HttpExceptionInterface $exception) { echo json_encode(['status' => $exception->getStatusCode()]); }
