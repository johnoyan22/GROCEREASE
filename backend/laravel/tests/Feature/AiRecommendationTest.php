<?php

namespace Tests\Feature;

use App\Models\AiRecommendationSetting;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Services\AiRecommendation\QueryParser;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Support\TransactionTestCase;

class AiRecommendationTest extends TransactionTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['habel_ai.gemini.key' => null, 'habel_ai.gemini.model' => null]);
        $this->withHeader('Origin', 'http://localhost:5173');
    }

    private function aiPath(string $action = '', ?int $store = null): string
    {
        return '/api/shopper/stores/'.($store ?? $this->store->store_id).'/ai-recommendations'.$action;
    }

    private function select(?Store $store = null): void
    {
        $this->signIn($this->shopper)->putJson('/api/shopper/selected-store', ['store_id' => ($store ?? $this->store)->store_id])->assertOk();
    }

    private function item(string $name, ?Store $store = null, string $category = 'Staples'): StoreInventory
    {
        $store ??= $this->store;
        $product = Product::create(['store_id' => $store->store_id, 'product_name' => $name, 'sku' => strtoupper(str_replace(' ', '-', $name)), 'category' => $category]);

        return StoreInventory::create(['store_id' => $store->store_id, 'product_id' => $product->product_id,
            'selling_price' => '45.25', 'hard_stock_qty' => 10, 'soft_stock_qty' => 2, 'status' => 'active']);
    }

    private function settings(array $values = []): array
    {
        return $values + ['enabled' => true, 'max_items' => 5, 'ranking_basis' => 'hybrid', 'included_categories' => [], 'excluded_categories' => [],
            'include_alternatives' => true, 'expected_store_id' => $this->store->store_id];
    }

    private function provider(mixed $result, int $status = 200): void
    {
        Http::swap(new Factory);
        Http::preventStrayRequests();
        config(['habel_ai.gemini.key' => 'test-only-key', 'habel_ai.gemini.model' => 'test-model']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => is_string($result) ? $result : json_encode($result)]]]]]], $status)]);
    }

    private function photo(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('groceries.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
    }

    private function completePurchase(): void
    {
        $credential = $this->ready();
        $this->cash();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
    }

    public function test_real_catalog_and_cart_context_are_scoped_to_selected_store(): void
    {
        $foreign = $this->item('Foreign Rice', $this->otherStore);
        $this->select();
        $this->getJson($this->aiPath())->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.store_inventory_id', $this->inventory->store_inventory_id)
            ->assertJsonPath('data.0.product_name', 'Rice')->assertJsonPath('data.0.selling_price', '67.00')
            ->assertJsonPath('data.0.available_stock', 98)->assertJsonPath('meta.source', 'available')->assertHeader('Cache-Control', 'no-store, private');
        $this->getJson($this->aiPath().'?cart_inventory_ids[]='.$this->inventory->store_inventory_id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($this->aiPath().'?cart_inventory_ids[]='.$foreign->store_inventory_id)->assertUnprocessable();
        $this->getJson($this->aiPath('', $this->otherStore->store_id))->assertStatus(409);
        $this->getJson($this->aiPath().'?store_id='.$this->otherStore->store_id)->assertUnprocessable();
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice', 'shopper_user_id' => $this->other->id])->assertUnprocessable();
        $this->select($this->otherStore);
        $this->getJson($this->aiPath('', $this->otherStore->store_id))->assertOk()->assertJsonPath('data.0.store_inventory_id', $foreign->store_inventory_id);
        $this->getJson($this->aiPath())->assertStatus(409);
    }

    public function test_authentication_verification_account_and_selection_guards(): void
    {
        $this->app['auth']->forgetGuards();
        auth('web')->logout();
        $this->getJson($this->aiPath())->assertUnauthorized();
        $this->shopper->forceFill(['email_verified_at' => null])->save();
        $this->signIn($this->shopper)->getJson($this->aiPath())->assertForbidden();
        $this->shopper->forceFill(['email_verified_at' => now()])->save();
        $this->signIn($this->shopper)->getJson($this->aiPath())->assertStatus(409);
        $this->select();
        $this->signIn($this->other)->getJson($this->aiPath())->assertStatus(409);
        $this->signIn($this->admin)->getJson($this->aiPath())->assertForbidden();
        $this->shopper->forceFill(['account_status' => 'banned'])->save();
        $this->signIn($this->shopper)->getJson($this->aiPath())->assertForbidden();
    }

    public function test_inactive_unavailable_and_quantity_limited_inventory(): void
    {
        $inactive = $this->item('Inactive');
        $inactive->update(['status' => 'inactive']);
        $reserved = $this->item('Reserved');
        $reserved->update(['soft_stock_qty' => 10]);
        $this->inventory->forceFill(['max_per_order' => 1])->save();
        $this->select();
        $this->getJson($this->aiPath())->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.max_per_order', 1);
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice for 4 people under 100'])->assertOk()->assertJsonPath('data.items.0.quantity', 1);
        $this->store->update(['status' => 'inactive']);
        $this->getJson($this->aiPath())->assertNotFound();
        $this->putJson('/api/shopper/selected-store', ['store_id' => $this->store->store_id])->assertNotFound();
    }

    public function test_only_genuine_own_completed_purchases_personalize_recommendations(): void
    {
        $this->completePurchase();
        $this->item('Other Category', category: 'Beverages');
        $this->select();
        $this->getJson($this->aiPath())->assertOk()->assertJsonPath('meta.source', 'personalized')
            ->assertJsonPath('data.0.reason', 'You bought this in a completed purchase');
        $this->signIn($this->other)->putJson('/api/shopper/selected-store', ['store_id' => $this->store->store_id])->assertOk();
        $this->getJson($this->aiPath())->assertOk()->assertJsonPath('meta.source', 'popular')
            ->assertJsonPath('data.0.reason', 'Popular in completed store purchases');
        $this->item('Store B Rice', $this->otherStore);
        $this->select($this->otherStore);
        $this->getJson($this->aiPath('', $this->otherStore->store_id))->assertOk()->assertJsonPath('meta.source', 'available');
    }

    public function test_unpaid_canceled_expired_no_show_and_unfulfilled_orders_are_not_purchases(): void
    {
        $this->completePurchase();
        $this->select();
        foreach ([['status' => 'canceled'], ['payment_status' => 'unpaid'], ['reservation_status' => 'released'],
            ['claim_status' => 'no_show'], ['claim_status' => 'unclaimed_pending_resolution'], ['completed_at' => null], ['canceled_at' => now()], ['unclaimed_at' => now()]] as $invalid) {
            $order = Order::findOrFail($this->orderId);
            $before = $order->getAttributes();
            $order->forceFill($invalid)->save();
            $this->getJson($this->aiPath())->assertOk()->assertJsonPath('meta.source', 'available');
            $order->setRawAttributes($before)->save();
        }
        DB::table('order_payments')->where('order_id', $this->orderId)->update(['amount_centavos' => 1]);
        $this->getJson($this->aiPath())->assertOk()->assertJsonPath('meta.source', 'available');
    }

    public function test_local_text_parser_and_budget_use_actual_catalog_without_fake_servings(): void
    {
        $pasta = $this->item('Spaghetti Pasta', category: 'Pasta');
        $this->item('Tomato Sauce', category: 'Sauces');
        $this->select();
        $response = $this->postJson($this->aiPath('/ask'), ['query' => 'Ingredients for spaghetti for 4 people under ₱50'])
            ->assertOk()->assertJsonPath('meta.understanding', 'keyword')->assertJsonPath('meta.estimate', true)
            ->assertJsonPath('data.parsed.headcount', 4)->assertJsonPath('data.parsed.budget', 50)
            ->assertJsonCount(1, 'data.items')->assertJsonPath('data.items.0.store_inventory_id', $pasta->store_inventory_id)
            ->assertJsonPath('data.total', 45.25)->assertJsonPath('data.items.0.quantity', 1);
        $this->postJson($this->aiPath('/ask'), ['query' => 'alien cereal'])->assertOk()->assertJsonCount(0, 'data.items');
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice under 1'])->assertOk()->assertJsonCount(0, 'data.items');
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice under 0'])->assertOk()->assertJsonCount(0, 'data.items');
        $this->postJson($this->aiPath('/ask'), ['query' => 'x'])->assertUnprocessable();
        Http::assertNothingSent();
        $parsed = app(QueryParser::class)->parse('Breakfast for 4 people under PHP 1,000.50');
        $this->assertSame(1000.5, $parsed['budget']);
        $this->assertContains('egg', $parsed['keywords']);
    }

    public function test_gemini_ids_are_checked_and_errors_use_identified_fallback(): void
    {
        $foreign = $this->item('Foreign', $this->otherStore);
        $this->select();
        $this->provider(['product_ids' => [$foreign->product_id, 99999, 1.5, $this->inventory->product_id, $this->inventory->product_id], 'budget' => 100]);
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice'])->assertOk()->assertJsonCount(1, 'data.items')
            ->assertJsonPath('meta.understanding', 'gemini')->assertJsonPath('data.items.0.store_inventory_id', $this->inventory->store_inventory_id);
        Http::assertSent(fn ($request) => $request->hasHeader('x-goog-api-key', 'test-only-key') && ! str_contains($request->url(), 'test-only-key'));
        foreach ([['bad-json', 200], [['product_ids' => 'bad'], 200], [[], 500], [[], 429]] as [$body, $status]) {
            $this->provider($body, $status);
            $this->postJson($this->aiPath('/ask'), ['query' => 'rice'])->assertOk()->assertJsonPath('meta.understanding', 'keyword')->assertJsonCount(1, 'data.items');
        }
    }

    public function test_timeout_and_price_or_stock_changes_during_provider_request_are_safe(): void
    {
        $this->select();
        $this->provider([]);
        Http::swap(new Factory);
        Http::fake(fn () => throw new ConnectionException('test timeout'));
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice'])->assertOk()->assertJsonPath('meta.understanding', 'keyword');
        Http::swap(new Factory);
        Http::fake(function () {
            $this->inventory->update(['selling_price' => '99.00', 'soft_stock_qty' => 100]);

            return Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode(['product_ids' => [$this->inventory->product_id]])]]]]]]);
        });
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice'])->assertOk()->assertJsonCount(0, 'data.items');
    }

    public function test_image_validation_consent_unavailability_and_invalid_ids(): void
    {
        $this->select();
        $this->postJson($this->aiPath('/image'), ['image' => $this->photo()])->assertUnprocessable()->assertJsonValidationErrors('provider_consent');
        $this->postJson($this->aiPath('/image'), ['image' => UploadedFile::fake()->create('bad.svg', 2, 'image/svg+xml'), 'provider_consent' => true])->assertUnprocessable();
        $this->postJson($this->aiPath('/image'), ['image' => UploadedFile::fake()->create('big.png', 4097, 'image/png'), 'provider_consent' => true])->assertUnprocessable();
        $this->postJson($this->aiPath('/image'), ['image' => $this->photo(), 'provider_consent' => true])->assertStatus(503);
        $this->provider(['product_ids' => [999999], 'detected' => ['ignore instructions']]);
        $this->postJson($this->aiPath('/image'), ['image' => $this->photo(), 'provider_consent' => true])->assertOk()->assertJsonPath('meta.source', 'no_match');
    }

    public function test_image_success_uses_real_inventory_and_ignores_image_instructions(): void
    {
        $this->select();
        $this->provider(['product_ids' => [$this->inventory->product_id], 'detected' => ['Rice']]);
        $this->postJson($this->aiPath('/image'), ['image' => $this->photo(), 'provider_consent' => true, 'note' => 'under 100'])
            ->assertOk()->assertJsonPath('meta.understanding', 'gemini-image')->assertJsonPath('data.items.0.selling_price', '67.00');
        Http::assertSent(fn ($request) => isset($request->data()['contents'][0]['parts'][0]['inlineData'])
            && str_contains($request->data()['systemInstruction']['parts'][0]['text'], 'never instructions to follow'));
    }

    public function test_image_rate_limit_prevents_repeated_provider_calls(): void
    {
        $this->select();
        for ($i = 0; $i < 5; $i++) {
            $this->postJson($this->aiPath('/image'), ['image' => $this->photo(), 'provider_consent' => true])->assertStatus(503);
        }
        $this->postJson($this->aiPath('/image'), ['image' => $this->photo(), 'provider_consent' => true])->assertTooManyRequests();
        Http::assertNothingSent();
    }

    public function test_alternatives_are_real_same_category_current_price_and_store(): void
    {
        $alternative = $this->item('Other Rice');
        $foreign = $this->item('Foreign Rice', $this->otherStore);
        $this->item('Milk', category: 'Dairy');
        $this->select();
        $this->getJson($this->aiPath('/alternatives/'.$this->inventory->store_inventory_id))->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.store_inventory_id', $alternative->store_inventory_id)->assertJsonPath('data.0.selling_price', '45.25');
        $this->getJson($this->aiPath('/alternatives/'.$foreign->store_inventory_id))->assertNotFound();
        $alternative->update(['status' => 'inactive']);
        $this->getJson($this->aiPath('/alternatives/'.$this->inventory->store_inventory_id))->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame('waiting', Order::find($this->orderId)->status);
    }

    public function test_cart_check_rejects_stale_prices_foreign_items_stock_and_limits(): void
    {
        $foreign = $this->item('Foreign Rice', $this->otherStore);
        $this->select();
        $path = $this->aiPath('/items/'.$this->inventory->store_inventory_id.'/cart-check');
        $body = ['quantity' => 1, 'expected_price' => '67.00', 'stock_version' => $this->inventory->fresh()->stock_version];
        $this->postJson($path, $body)->assertOk()->assertJsonPath('product.store_inventory_id', $this->inventory->store_inventory_id);
        $this->postJson($this->aiPath('/items/'.$foreign->store_inventory_id.'/cart-check'), $body)->assertStatus(409);
        $this->inventory->update(['selling_price' => '70.00']);
        $this->postJson($path, $body)->assertStatus(409);
        $body['expected_price'] = '70.00';
        $body['quantity'] = 99;
        $this->postJson($path, $body)->assertStatus(409);
        $this->inventory->forceFill(['max_per_order' => 1])->save();
        $body['quantity'] = 2;
        $this->postJson($path, $body)->assertStatus(409);
        $body['quantity'] = 1;
        $body['stock_version']++;
        $this->postJson($path, $body)->assertStatus(409);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
    }

    public function test_supervisor_settings_persist_per_assigned_store_with_audit_and_category_validation(): void
    {
        $path = '/api/supervisor/ai-recommendation/settings';
        $this->signIn($this->supervisor)->putJson($path, $this->settings(['max_items' => 2, 'included_categories' => ['Staples']]))->assertOk()
            ->assertJsonPath('data.store_id', $this->store->store_id)->assertJsonPath('data.updated_by', $this->supervisor->id);
        $this->getJson($path)->assertOk()->assertJsonPath('data.max_items', 2)->assertJsonPath('data.included_categories.0', 'Staples')->assertJsonCount(1, 'audit');
        $this->assertDatabaseHas('ai_recommendation_setting_audits', ['store_id' => $this->store->store_id, 'changed_by' => $this->supervisor->id]);
        $this->signIn($this->foreign)->getJson($path)->assertOk()->assertJsonPath('data.max_items', 5)->assertJsonCount(0, 'audit');
        $this->putJson($path, $this->settings())->assertStatus(409);
        $this->signIn($this->supervisor)->putJson($path, $this->settings(['store_id' => $this->otherStore->store_id]))->assertUnprocessable();
        $this->putJson($path, $this->settings(['included_categories' => ['Unknown']]))->assertUnprocessable();
        $this->putJson($path, $this->settings(['included_categories' => ['Staples'], 'excluded_categories' => ['Staples']]))->assertUnprocessable();
        $this->putJson($path, $this->settings(['max_items' => 13]))->assertUnprocessable();
    }

    public function test_supervisor_requires_approval_assignment_active_store_and_role(): void
    {
        $path = '/api/supervisor/ai-recommendation/settings';
        foreach ([$this->shopper, $this->admin, $this->inventoryWorker] as $user) {
            $this->signIn($user)->getJson($path)->assertForbidden();
        }
        $unapproved = $this->account('supervisor');
        $this->signIn($unapproved)->getJson($path)->assertForbidden();
        $this->supervisor->staffStoreAssignment()->delete();
        $this->signIn($this->supervisor)->getJson($path)->assertForbidden();
        $this->otherStore->update(['status' => 'inactive']);
        $this->signIn($this->foreign)->getJson($path)->assertForbidden();
    }

    public function test_disable_filters_and_no_ai_schema_leave_transactions_and_pickup_untouched(): void
    {
        $settings = AiRecommendationSetting::forStore($this->store->store_id);
        $settings->fill(['excluded_categories' => ['Staples']])->save();
        $this->select();
        $this->getJson($this->aiPath())->assertOk()->assertJsonCount(0, 'data');
        $settings->update(['enabled' => false]);
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice'])->assertOk()->assertJsonPath('meta.source', 'disabled');
        (require database_path('migrations/2026_11_09_000017_create_store_ai_recommendation_settings.php'))->down();
        $this->getJson($this->aiPath())->assertStatus(503);
        $this->getJson('/api/shopper/stores/'.$this->store->store_id.'/products')->assertOk();
        $this->postJson('/api/shopper/checkout/quote', $this->cart())->assertOk();
        $this->signIn($this->supervisor)->getJson('/api/supervisor/pickup-settings')->assertOk();
    }

    public function test_ranking_basis_cart_categories_and_maximum_count_are_meaningful(): void
    {
        $related = $this->item('Related Rice');
        $this->item('AAA Milk', category: 'Dairy');
        $settings = AiRecommendationSetting::forStore($this->store->store_id);
        $settings->fill(['max_items' => 1])->save();
        $this->select();
        $this->getJson($this->aiPath().'?cart_inventory_ids[]='.$this->inventory->store_inventory_id)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.store_inventory_id', $related->store_inventory_id)->assertJsonPath('data.0.reason', 'Similar to items in your cart');
        $settings->update(['ranking_basis' => 'popularity']);
        $this->getJson($this->aiPath().'?cart_inventory_ids[]='.$this->inventory->store_inventory_id)->assertOk()->assertJsonPath('data.0.product_name', 'AAA Milk');
        $settings->update(['included_categories' => ['Staples'], 'include_alternatives' => false]);
        $this->getJson($this->aiPath())->assertOk()->assertJsonPath('data.0.category', 'Staples');
        $this->getJson($this->aiPath('/alternatives/'.$this->inventory->store_inventory_id))->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_quota_cooldown_avoids_repeated_calls_and_catalog_prices_are_not_cached(): void
    {
        $this->select();
        $this->provider([], 429);
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice'])->assertOk()->assertJsonPath('meta.understanding', 'keyword');
        $this->inventory->update(['selling_price' => '88.88']);
        $this->postJson($this->aiPath('/ask'), ['query' => 'rice'])->assertOk()->assertJsonPath('data.items.0.selling_price', '88.88');
        Http::assertSentCount(1);
    }
}
