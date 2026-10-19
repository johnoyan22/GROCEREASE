<?php

namespace Tests\Support;

use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use App\Models\Worker;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

abstract class TransactionTestCase extends TestCase
{
    protected User $admin;
    protected User $shopper;
    protected User $other;
    protected User $supervisor;
    protected User $foreign;
    protected User $inventoryWorker;
    protected StoreInventory $inventory;
    protected Store $store;
    protected Store $otherStore;
    protected int $orderId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('mail.default'));
        $this->travelTo(now()->setDate(2026, 10, 19)->setTime(8, 0));
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->shopper = $this->account('shopper');
        $this->other = $this->account('shopper');
        $this->store = Store::create(['store_name' => 'Store A', 'address' => 'A']);
        $this->otherStore = Store::create(['store_name' => 'Store B', 'address' => 'B']);
        foreach ([$this->store, $this->otherStore] as $store) {
            $store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => '00:00', 'closes_at' => '23:59'])])->save();
        }
        $this->supervisor = $this->account('supervisor', $this->store, $this->admin);
        $this->foreign = $this->account('supervisor', $this->otherStore, $this->admin);
        $this->inventoryWorker = $this->account('inventory_worker', $this->store, $this->admin);
        $product = Product::create(['store_id' => $this->store->store_id, 'product_name' => 'Rice', 'sku' => 'RICE', 'category' => 'Staples']);
        $this->inventory = StoreInventory::create(['store_id' => $this->store->store_id, 'product_id' => $product->product_id,
            'selling_price' => '67.00', 'hard_stock_qty' => 100, 'soft_stock_qty' => 0, 'status' => 'active']);
        $this->orderId = $this->placeOrder();
    }

    protected function account(string $role, ?Store $store = null, ?User $admin = null): User
    {
        $user = User::factory()->create(['role_id' => Role::where('slug', $role)->firstOrFail()->role_id]);
        if ($store) {
            $user->forceFill(['staff_approved_at' => now(), 'staff_approved_by_user_id' => $admin->id])->save();
            StaffStoreAssignment::create(['user_id' => $user->id, 'store_id' => $store->store_id, 'assigned_by_user_id' => $admin->id]);
        }
        return $user;
    }

    protected function signIn(User $user): static
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'web');
    }

    protected function path(string $action, ?int $id = null): string { return '/api/supervisor/orders/'.($id ?? $this->orderId).'/'.$action; }
    protected function shopperPath(string $action): string { return '/api/shopper/orders/'.$this->orderId.'/'.$action; }

    protected function cart(?array $schedule = null): array
    {
        return array_merge(['store_id' => $this->store->store_id,
            'items' => [['store_inventory_id' => $this->inventory->store_inventory_id, 'quantity' => 2]],
            'pickup_date' => now('Asia/Manila')->addDay()->format('Y-m-d'), 'pickup_start' => '10:00', 'pickup_end' => '11:00'], $schedule ?? []);
    }

    protected function placeOrder(?array $schedule = null): int
    {
        $this->signIn($this->shopper);
        $cart = $this->cart($schedule);
        $quote = $this->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        return $this->postJson('/api/shopper/orders', array_merge($cart, ['quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()]))
            ->assertCreated()->json('order.order_id');
    }

    protected function assignWorker(?int $id = null, ?Worker $worker = null): Worker
    {
        $worker ??= Worker::create(['store_id' => $this->store->store_id, 'full_name' => 'Test Worker', 'work_type' => 'picker_packer', 'created_by_user_id' => $this->supervisor->id]);
        $this->signIn($this->supervisor)->putJson($this->path('worker', $id), ['worker_id' => $worker->worker_id])->assertOk();
        return $worker;
    }

    protected function prepare(?int $id = null): void
    {
        $id ??= $this->orderId;
        $this->assignWorker($id);
        $this->signIn($this->supervisor)->putJson($this->path('status', $id), ['status' => 'preparing'])->assertOk();
        $items = [];
        foreach (Order::findOrFail($id)->items as $item) $items[] = ['order_item_id' => $item->order_item_id, 'prepared_qty' => $item->quantity];
        $this->signIn($this->inventoryWorker)->putJson('/api/staff/orders/'.$id.'/preparation', ['items' => $items])->assertOk();
        $this->signIn($this->supervisor)->putJson($this->path('preparation-completion', $id), [])->assertOk();
    }

    protected function ready(?int $id = null): array
    {
        $id ??= $this->orderId;
        $this->prepare($id);
        $this->signIn($this->supervisor)->putJson($this->path('status', $id), ['status' => 'ready_for_pickup'])->assertOk();
        return $this->signIn($this->shopper)->getJson('/api/shopper/orders/'.$id.'/pickup')->assertOk()->json('credential');
    }

    protected function identity(array $credential): array
    {
        return ['method' => 'pin', 'credential' => $credential['pin'], 'claimant_name' => 'Claiming Shopper',
            'identity_checked' => true, 'claimant_check_note' => 'In-person claimant checked under store procedure'];
    }

    protected function cash(): void
    {
        $this->signIn($this->supervisor)->putJson($this->path('cash-payment'), [
            'cashier_name' => 'Test Cashier', 'evidence_reference' => 'Fixture receipt 001', 'cash_collected' => true,
        ])->assertOk();
    }

    protected function recordProviderPayment(): void
    {
        // Test-only trusted-provider fixture. There is intentionally no public "mark digital paid" endpoint.
        $order = Order::findOrFail($this->orderId);
        $order->payment_method = 'digital';
        $order->payment_status = 'paid';
        $order->save();
        DB::table('order_payments')->insert(['order_id' => $order->order_id, 'method' => 'digital',
            'verification_source' => 'provider', 'provider' => 'test_provider', 'provider_reference' => (string) Str::uuid(),
            'amount_centavos' => $order->total_centavos, 'evidence_type' => 'provider_callback',
            'evidence_reference' => \Illuminate\Support\Facades\Crypt::encryptString('Test verified callback'),
            'confirmed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
    }
}
