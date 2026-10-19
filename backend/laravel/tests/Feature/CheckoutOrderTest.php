<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\Role;
use App\Models\StaffStoreAssignment;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class CheckoutOrderTest extends TestCase
{
    private User $admin;
    private User $shopper;
    private User $otherShopper;
    private User $worker;
    private User $supervisor;
    private User $otherSupervisor;
    private Store $first;
    private Store $second;
    private StoreInventory $rice;
    private StoreInventory $foreign;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame('array', config('mail.default'));
        $this->assertSame(1, (int) DB::selectOne('PRAGMA foreign_keys')->foreign_keys);
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->shopper = $this->account('shopper');
        $this->otherShopper = $this->account('shopper');
        $this->first = Store::create(['store_name' => 'Store A', 'address' => 'A address']);
        $this->second = Store::create(['store_name' => 'Store B', 'address' => 'B address']);
        foreach ([$this->first, $this->second] as $store) $store->forceFill(['operating_hours' => array_fill(1, 7, ['opens_at' => '00:00', 'closes_at' => '23:59'])])->save();
        $this->worker = $this->account('inventory_worker', $this->first);
        $this->supervisor = $this->account('supervisor', $this->first);
        $this->otherSupervisor = $this->account('supervisor', $this->second);
        $this->rice = $this->inventory($this->first);
        $this->foreign = $this->inventory($this->second);
    }

    private function account(string $role, ?Store $store = null): User
    {
        $user = User::factory()->create(['role_id' => Role::where('slug', $role)->firstOrFail()->role_id]);
        if (in_array($role, User::STAFF_ROLES, true)) {
            $user->forceFill(['staff_approved_at' => now(), 'staff_approved_by_user_id' => $this->admin->id])->save();
        }
        if ($store) StaffStoreAssignment::create([
            'user_id' => $user->id, 'store_id' => $store->store_id, 'assigned_by_user_id' => $this->admin->id,
        ]);
        return $user;
    }

    private function inventory(Store $store): StoreInventory
    {
        $product = Product::create(['store_id' => $store->store_id, 'product_name' => $store->store_name.' Rice', 'sku' => 'RICE', 'category' => 'Staples']);
        $inventory = StoreInventory::create([
            'store_id' => $store->store_id, 'product_id' => $product->product_id,
            'selling_price' => '67.25', 'hard_stock_qty' => 100, 'soft_stock_qty' => 15, 'status' => 'active',
        ]);
        $inventory->max_per_order = 4;
        $inventory->save();
        return $inventory->refresh();
    }

    private function signIn(User $user): static
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'web');
    }

    private function cart(int $quantity = 2): array
    {
        return ['pickup_date' => now('Asia/Manila')->addDay()->format('Y-m-d'), 'pickup_start' => '10:00', 'pickup_end' => '11:00', 'store_id' => $this->first->store_id, 'items' => [['store_inventory_id' => $this->rice->store_inventory_id, 'quantity' => $quantity]]];
    }

    private function quote(?array $cart = null): array
    {
        return $this->postJson('/api/shopper/checkout/quote', $cart ?? $this->cart())->assertOk()->json();
    }

    private function place(): int
    {
        $this->signIn($this->shopper);
        $quote = $this->quote();
        return $this->postJson('/api/shopper/orders', array_merge($this->cart(), [
            'quote_token' => $quote['quote_token'], 'idempotency_key' => (string) Str::uuid(),
        ]))->assertCreated()->json('order.order_id');
    }

    public function test_quote_shows_store_prices_without_reserving_or_adding_fees(): void
    {
        $before = $this->rice->fresh()->getAttributes();
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart())
            ->assertOk()->assertJsonPath('quote.subtotal_centavos', 13450)
            ->assertJsonPath('quote.service_fee_centavos', 0)->assertJsonPath('quote.total_centavos', 13450)
            ->assertJsonPath('quote.items.0.unit_price_centavos', 6725)
            ->assertJsonPath('quote.service_fee_policy', 'pending_partner_approval_no_charge');
        $this->assertSame($before, $this->rice->fresh()->getAttributes());
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_order_uses_price_snapshots_and_reserves_only_soft_stock(): void
    {
        $id = $this->place();
        $this->assertDatabaseHas('orders', [
            'order_id' => $id, 'shopper_user_id' => $this->shopper->id, 'store_id' => $this->first->store_id,
            'status' => 'waiting', 'payment_status' => 'unpaid', 'payment_method' => 'cash_on_pickup',
            'subtotal_centavos' => 13450, 'service_fee_centavos' => 0, 'total_centavos' => 13450,
        ]);
        $this->assertDatabaseHas('order_items', ['order_id' => $id, 'quantity' => 2, 'unit_price_centavos' => 6725, 'line_total_centavos' => 13450]);
        $this->assertSame(100, $this->rice->fresh()->hard_stock_qty);
        $this->assertSame(17, $this->rice->fresh()->soft_stock_qty);
        $this->assertSame(1, $this->rice->fresh()->stock_version);
        $this->rice->update(['selling_price' => '70.00']);
        $this->rice->product->update(['product_name' => 'Renamed Rice']);
        $this->getJson('/api/shopper/orders/'.$id)->assertOk()
            ->assertJsonPath('order.items.0.unit_price_centavos', 6725)
            ->assertJsonPath('order.items.0.product_name', 'Store A Rice')
            ->assertJsonCount(1, 'order.history')->assertJsonMissingPath('order.idempotency_key');
    }

    public function test_same_checkout_key_returns_original_order_without_reserving_twice(): void
    {
        $this->signIn($this->shopper);
        $quote = $this->quote();
        $payload = array_merge($this->cart(), ['quote_token' => $quote['quote_token'], 'idempotency_key' => (string) Str::uuid()]);
        $id = $this->postJson('/api/shopper/orders', $payload)->assertCreated()->json('order.order_id');
        $this->getJson('/api/shopper/checkout-attempts/'.$payload['idempotency_key'])->assertOk()
            ->assertJsonPath('order.order_id', $id);
        $this->travel(20)->minutes();
        $this->postJson('/api/shopper/orders', $payload)->assertOk()->assertJsonPath('order.order_id', $id);
        $this->postJson('/api/shopper/orders', array_merge($payload, ['items' => $this->cart(3)['items']]))->assertConflict();
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_status_history', 1);
        $this->assertSame(17, $this->rice->fresh()->soft_stock_qty);
        $this->assertSame(1, $this->rice->fresh()->stock_version);
        $this->signIn($this->otherShopper)->getJson('/api/shopper/checkout-attempts/'.$payload['idempotency_key'])->assertNotFound();
        $this->signIn($this->shopper)->putJson('/api/shopper/orders/'.$id.'/cancellation', ['reason' => 'Cancel original'])->assertOk();
        $this->postJson('/api/shopper/orders', $payload)->assertOk()->assertJsonPath('order.status', 'canceled');
        $this->assertSame(15, $this->rice->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_changed_price_requires_fresh_explicit_review(): void
    {
        $this->signIn($this->shopper);
        $quote = $this->quote();
        $this->rice->update(['selling_price' => '68.00']);
        $this->postJson('/api/shopper/orders', array_merge($this->cart(), [
            'quote_token' => $quote['quote_token'], 'idempotency_key' => (string) Str::uuid(),
        ]))->assertConflict();
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(15, $this->rice->fresh()->soft_stock_qty);
    }

    public function test_expired_tampered_foreign_and_changed_cart_quotes_do_not_create_orders(): void
    {
        $this->signIn($this->shopper);
        $quote = $this->quote();
        $base = array_merge($this->cart(), ['idempotency_key' => (string) Str::uuid()]);
        $this->postJson('/api/shopper/orders', array_merge($base, ['quote_token' => 'tampered']))->assertUnprocessable();
        $this->postJson('/api/shopper/orders', array_merge($base, [
            'quote_token' => $quote['quote_token'], 'items' => $this->cart(3)['items'],
        ]))->assertUnprocessable();
        $this->signIn($this->otherShopper)->postJson('/api/shopper/orders', array_merge($base, ['quote_token' => $quote['quote_token']]))->assertUnprocessable();
        $this->signIn($this->shopper);
        $this->travel(11)->minutes();
        $this->postJson('/api/shopper/orders', array_merge($base, ['quote_token' => $quote['quote_token']]))->assertConflict();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_reservations_or_limits_changed_after_quote_are_revalidated(): void
    {
        $this->signIn($this->shopper);
        $quote = $this->quote();
        $payload = array_merge($this->cart(), ['quote_token' => $quote['quote_token'], 'idempotency_key' => (string) Str::uuid()]);
        $this->rice->update(['soft_stock_qty' => 99]);
        $this->postJson('/api/shopper/orders', $payload)->assertUnprocessable();
        $this->rice->update(['soft_stock_qty' => 15]);
        $this->rice->max_per_order = 1;
        $this->rice->save();
        $this->postJson('/api/shopper/orders', $payload)->assertUnprocessable();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_last_units_cannot_be_reserved_by_two_shoppers(): void
    {
        $this->rice->update(['hard_stock_qty' => 17]);
        $this->signIn($this->shopper);
        $first = $this->quote();
        $this->signIn($this->otherShopper);
        $second = $this->quote();
        $this->signIn($this->shopper)->postJson('/api/shopper/orders', array_merge($this->cart(), [
            'quote_token' => $first['quote_token'], 'idempotency_key' => (string) Str::uuid(),
        ]))->assertCreated();
        $this->signIn($this->otherShopper)->postJson('/api/shopper/orders', array_merge($this->cart(), [
            'quote_token' => $second['quote_token'], 'idempotency_key' => (string) Str::uuid(),
        ]))->assertUnprocessable();
        $this->assertSame(17, $this->rice->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_cop_ceiling_accepts_1500_and_rejects_higher_totals_and_extreme_quantities(): void
    {
        $this->rice->update(['selling_price' => '1500.00']);
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart(1))->assertOk()
            ->assertJsonPath('quote.total_centavos', 150000);
        $this->rice->update(['selling_price' => '1500.01']);
        $this->postJson('/api/shopper/checkout/quote', $this->cart(1))->assertUnprocessable();
        $this->rice->max_per_order = null;
        $this->rice->hard_stock_qty = 2147483647;
        $this->rice->soft_stock_qty = 0;
        $this->rice->selling_price = '99999999.99';
        $this->rice->save();
        $this->postJson('/api/shopper/checkout/quote', $this->cart(2147483647))->assertUnprocessable();
    }

    public function test_foreign_inactive_or_unknown_products_and_stores_are_rejected(): void
    {
        $this->signIn($this->shopper);
        foreach ([$this->foreign->store_inventory_id, 999999] as $id) {
            $this->postJson('/api/shopper/checkout/quote', [
                'store_id' => $this->first->store_id, 'items' => [['store_inventory_id' => $id, 'quantity' => 1]],
            ])->assertUnprocessable();
        }
        $this->rice->update(['status' => 'inactive']);
        $this->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnprocessable();
        $this->first->update(['status' => 'inactive']);
        $this->postJson('/api/shopper/checkout/quote', $this->cart())->assertNotFound();
        $this->postJson('/api/shopper/checkout/quote', array_merge($this->cart(), ['store_id' => 999999]))->assertNotFound();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_unapproved_fee_activation_fails_closed(): void
    {
        config(['checkout.service_fee.enabled' => true]);
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart())->assertStatus(503);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_fake_totals_payment_states_and_item_prices_are_rejected(): void
    {
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', array_merge($this->cart(), [
            'total_centavos' => 1, 'service_fee_centavos' => 999, 'payment_status' => 'paid',
            'status' => 'completed', 'shopper_user_id' => $this->otherShopper->id,
        ]))->assertUnprocessable()->assertJsonValidationErrors(['total_centavos', 'service_fee_centavos', 'payment_status', 'status', 'shopper_user_id']);
        $this->postJson('/api/shopper/checkout/quote', [
            'store_id' => $this->first->store_id,
            'items' => [['store_inventory_id' => $this->rice->store_inventory_id, 'quantity' => 1, 'price' => 1]],
        ])->assertUnprocessable();
    }

    public function test_invalid_and_duplicate_quantities_do_not_create_partial_orders(): void
    {
        $this->signIn($this->shopper);
        foreach ([0, -1, 2147483648] as $quantity) {
            $this->postJson('/api/shopper/checkout/quote', $this->cart($quantity))->assertUnprocessable();
        }
        $fraction = $this->cart();
        $fraction['items'][0]['quantity'] = 1.5;
        $this->postJson('/api/shopper/checkout/quote', $fraction)->assertUnprocessable();
        $duplicates = $this->cart();
        $duplicates['items'][] = $duplicates['items'][0];
        $this->postJson('/api/shopper/checkout/quote', $duplicates)->assertUnprocessable();
        $this->postJson('/api/shopper/orders', $this->cart())->assertUnprocessable()->assertJsonValidationErrors(['quote_token', 'idempotency_key']);
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(15, $this->rice->fresh()->soft_stock_qty);
    }

    public function test_history_failure_rolls_back_order_items_and_reservations(): void
    {
        $this->signIn($this->shopper);
        $quote = $this->quote();
        $this->withoutExceptionHandling();
        OrderStatusHistory::creating(function () { throw new RuntimeException('Simulated order history failure'); });
        try {
            $this->postJson('/api/shopper/orders', array_merge($this->cart(), [
                'quote_token' => $quote['quote_token'], 'idempotency_key' => (string) Str::uuid(),
            ]));
            $this->fail('Expected history failure.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated order history failure', $exception->getMessage());
        } finally {
            OrderStatusHistory::flushEventListeners();
        }
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertSame(15, $this->rice->fresh()->soft_stock_qty);
        $this->assertSame(0, $this->rice->fresh()->stock_version);
    }

    public function test_shopper_reads_only_own_orders_and_staff_reads_only_current_store(): void
    {
        $id = $this->place();
        $this->signIn($this->otherShopper)->getJson('/api/shopper/orders')->assertOk()->assertJsonCount(0, 'orders');
        $this->getJson('/api/shopper/orders/'.$id)->assertNotFound();
        foreach ([$this->worker, $this->supervisor] as $user) {
            $this->signIn($user)->getJson('/api/staff/orders')->assertOk()->assertJsonCount(1, 'orders')
                ->assertJsonPath('orders.0.order_id', $id);
        }
        $this->signIn($this->otherSupervisor)->getJson('/api/staff/orders')->assertOk()->assertJsonCount(0, 'orders');
        $this->getJson('/api/staff/orders?store_id='.$this->first->store_id)->assertUnprocessable();
        $this->putJson('/api/supervisor/orders/'.$id.'/status', ['status' => 'preparing'])->assertNotFound();
    }

    public function test_only_valid_preparation_transitions_are_allowed_and_payment_stays_unpaid(): void
    {
        $id = $this->place();
        $before = $this->rice->fresh()->getAttributes();
        $path = '/api/supervisor/orders/'.$id.'/status';
        $this->signIn($this->supervisor)->putJson($path, ['status' => 'ready_for_pickup'])->assertConflict();
        $this->assignPreparationWorker($id);
        $this->putJson($path, ['status' => 'preparing'])->assertOk();
        $this->putJson($path, ['status' => 'preparing'])->assertConflict();
        $item = Order::findOrFail($id)->items()->firstOrFail();
        $this->putJson('/api/staff/orders/'.$id.'/preparation', ['items' => [['order_item_id' => $item->order_item_id, 'prepared_qty' => $item->quantity]]])->assertOk();
        $this->putJson('/api/supervisor/orders/'.$id.'/preparation-completion', [])->assertOk();
        $this->putJson($path, ['status' => 'ready_for_pickup'])->assertOk()->assertJsonPath('order.payment_status', 'unpaid');
        $this->putJson($path, ['status' => 'completed'])->assertUnprocessable();
        $this->assertSame($before, $this->rice->fresh()->getAttributes());
        $this->signIn($this->shopper)->getJson('/api/shopper/orders/'.$id)->assertOk()
            ->assertJsonPath('order.status', 'ready_for_pickup')->assertJsonCount(3, 'order.history');
    }

    public function test_waiting_cancellation_releases_reservation_once_without_changing_physical(): void
    {
        $id = $this->place();
        $path = '/api/shopper/orders/'.$id.'/cancellation';
        $this->putJson($path, ['reason' => 'Changed my shopping plan'])->assertOk()
            ->assertJsonPath('order.status', 'canceled')->assertJsonPath('order.reservation_status', 'released');
        $this->assertSame(100, $this->rice->fresh()->hard_stock_qty);
        $this->assertSame(15, $this->rice->fresh()->soft_stock_qty);
        $this->assertSame(2, $this->rice->fresh()->stock_version);
        $this->putJson($path, ['reason' => 'Repeat'])->assertConflict();
        $this->assertSame(15, $this->rice->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('order_status_history', 2);
    }

    public function test_cancellation_cannot_touch_another_shopper_or_preparing_order(): void
    {
        $id = $this->place();
        $path = '/api/shopper/orders/'.$id.'/cancellation';
        $this->signIn($this->otherShopper)->putJson($path, ['reason' => 'Not mine'])->assertNotFound();
        $this->assignPreparationWorker($id);
        $this->signIn($this->supervisor)->putJson('/api/supervisor/orders/'.$id.'/status', ['status' => 'preparing'])->assertOk();
        $this->signIn($this->shopper)->putJson($path, ['reason' => 'Too late'])->assertConflict();
        $this->assertSame(17, $this->rice->fresh()->soft_stock_qty);
    }

    public function test_new_order_reservation_invalidates_pending_stock_correction(): void
    {
        $request = $this->signIn($this->worker)->postJson('/api/inventory/items/'.$this->rice->store_inventory_id.'/stock-adjustments', [
            'requested_hard_stock_qty' => 110, 'expected_stock_version' => 0, 'reason' => 'Physical recount',
        ])->assertCreated()->json('adjustment.id');
        $this->place();
        $this->signIn($this->supervisor)->putJson('/api/supervisor/stock-adjustments/'.$request.'/decision', ['decision' => 'approved'])->assertConflict();
        $this->assertSame(100, $this->rice->fresh()->hard_stock_qty);
        $this->assertSame(17, $this->rice->fresh()->soft_stock_qty);
    }

    public function test_guests_unverified_and_wrong_roles_cannot_use_order_operations(): void
    {
        $this->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnauthorized();
        $this->postJson('/api/shopper/orders', [])->assertUnauthorized();
        $this->getJson('/api/shopper/orders')->assertUnauthorized();
        $this->getJson('/api/staff/orders')->assertUnauthorized();
        $this->putJson('/api/supervisor/orders/1/status', [])->assertUnauthorized();
        foreach ([$this->worker, $this->supervisor, $this->admin] as $user) {
            $this->signIn($user)->postJson('/api/shopper/checkout/quote', $this->cart())->assertForbidden();
            $this->getJson('/api/shopper/orders')->assertForbidden();
        }
        $unverified = User::factory()->unverified()->create(['role_id' => $this->shopper->role_id]);
        $this->signIn($unverified)->postJson('/api/shopper/checkout/quote', $this->cart())->assertForbidden();
        $this->signIn($this->shopper)->getJson('/api/staff/orders')->assertForbidden();
        $this->putJson('/api/supervisor/orders/1/status', [])->assertForbidden();
        $this->signIn($this->worker)->putJson('/api/supervisor/orders/1/status', [])->assertForbidden();
    }

    private function assignPreparationWorker(int $id): void
    {
        $worker = \App\Models\Worker::create(['store_id' => $this->first->store_id, 'full_name' => 'Test Packer',
            'work_type' => 'picker_packer', 'created_by_user_id' => $this->supervisor->id]);
        $this->signIn($this->supervisor)->putJson('/api/supervisor/orders/'.$id.'/worker', ['worker_id' => $worker->worker_id])->assertOk();
    }

    public static function deniedStaffStates(): array
    {
        return [['unapproved'], ['unassigned'], ['inactive'], ['transferred']];
    }

    #[DataProvider('deniedStaffStates')]
    public function test_status_operations_use_current_approval_store_and_placement(string $state): void
    {
        $id = $this->place();
        $this->supervisor->load('staffStoreAssignment.store');
        if ($state === 'unapproved') $this->supervisor->forceFill(['staff_approved_at' => null])->save();
        elseif ($state === 'unassigned') $this->supervisor->staffStoreAssignment()->delete();
        elseif ($state === 'inactive') $this->first->update(['status' => 'inactive']);
        else $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->second->store_id]);
        $expected = $state === 'transferred' ? 404 : 403;
        $this->signIn($this->supervisor)->putJson('/api/supervisor/orders/'.$id.'/status', ['status' => 'preparing'])->assertStatus($expected);
        $this->assertSame('waiting', Order::findOrFail($id)->status);
    }
}
