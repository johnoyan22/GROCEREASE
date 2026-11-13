<?php

namespace Tests\Feature;

use App\Models\AiRecommendationSetting;
use App\Models\Order;
use App\Models\Product;
use App\Models\StoreCategory;
use App\Services\StockAlerts;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TransactionTestCase;

class AdviserCatalogStockTest extends TransactionTestCase
{
    private function category(): StoreCategory
    {
        return StoreCategory::create(['store_id' => $this->store->store_id, 'name' => 'Drinks', 'name_key' => 'drinks', 'active' => true]);
    }

    private function payload(StoreCategory $category): array
    {
        return ['product_name' => 'Cola', 'barcode' => '0001', 'size' => '1.5 L', 'category_id' => $category->id,
            'selling_unit' => 'bottle', 'selling_price' => '25.00', 'status' => 'active'];
    }

    private function receive(array $changes = []): int
    {
        return $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/receiving', array_replace([
            'kind' => 'receive', 'quantity' => 5, 'received_date' => '2026-10-19', 'expiration_date' => '2026-10-21',
            'batch_reference' => 'DELIVERY-01', 'description' => 'Five physical units received.',
        ], $changes))->assertCreated()->json('id');
    }

    private function approve(int $id): void
    {
        $this->signIn($this->supervisor)->putJson('/api/supervisor/receiving/'.$id.'/decision', ['decision' => 'approved', 'decision_note' => 'Delivery physically verified.'])->assertOk();
    }

    public function test_skus_are_generated_uniquely_and_existing_skus_are_immutable(): void
    {
        $category = $this->category();
        $one = $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items', $this->payload($category))->assertCreated()->json('inventory');
        $two = $this->postJson('/api/inventory/items', $this->payload($category))->assertCreated()->json('inventory');
        $this->assertNotSame($one['sku'], $two['sku']);
        $this->assertStringStartsWith('GE-'.$this->store->store_id.'-', $one['sku']);
        $this->assertSame('bottle', $one['selling_unit']);
        $this->assertSame('0001', $one['barcode']);
        $this->putJson('/api/inventory/items/'.$this->inventory->store_inventory_id, ['selling_price' => '68.00', 'status' => 'active'])->assertOk();
        $this->assertSame('RICE', $this->inventory->product->fresh()->sku);
        $this->putJson('/api/inventory/items/'.$one['store_inventory_id'], $this->payload($category) + ['sku' => 'MANUAL'])->assertUnprocessable()->assertJsonValidationErrors('sku');
        // Database uniqueness is the last guard even for non-HTTP writers.
        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        Product::create(['store_id' => $this->store->store_id, 'product_name' => 'Duplicate', 'sku' => $one['sku'], 'category' => 'Drinks']);
    }

    public function test_categories_keep_ai_filters_and_relationships_when_renamed_or_archived(): void
    {
        $category = $this->category();
        $this->inventory->product->update(['category_id' => $category->id, 'category' => 'Drinks']);
        AiRecommendationSetting::create(['store_id' => $this->store->store_id, 'included_categories' => ['Drinks'], 'excluded_categories' => []]);
        $this->signIn($this->inventoryWorker)->postJson('/api/supervisor/categories', ['name' => 'Unauthorized', 'active' => true])->assertForbidden();
        $this->signIn($this->foreign)->putJson('/api/supervisor/categories/'.$category->id, ['name' => 'Foreign', 'active' => false])->assertNotFound();
        $this->signIn($this->supervisor)->putJson('/api/supervisor/categories/'.$category->id, ['name' => 'Beverages', 'active' => false])->assertOk();
        $this->assertSame('Beverages', $this->inventory->product->fresh()->category);
        $this->assertSame(['Beverages'], AiRecommendationSetting::forStore($this->store->store_id)->included_categories);
        $this->getJson('/api/inventory/categories')->assertOk()->assertJsonPath('categories.0.products_count', 1);
        $this->signIn($this->inventoryWorker)->postJson('/api/inventory/items', $this->payload($category))->assertUnprocessable()->assertJsonValidationErrors('category_id');
        $this->assertDatabaseCount('category_audits', 1);
    }

    public function test_price_changes_are_audited_and_stale_checkout_review_cannot_place_order(): void
    {
        $cart = $this->cart();
        $quote = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        $before = Order::findOrFail($this->orderId)->items->first()->unit_price_centavos;
        $this->signIn($this->inventoryWorker)->putJson('/api/inventory/items/'.$this->inventory->store_inventory_id, ['selling_price' => '70.00', 'status' => 'active'])->assertOk();
        $this->assertDatabaseHas('product_price_changes', ['old_price' => 67, 'new_price' => 70, 'store_id' => $this->store->store_id, 'changed_by_user_id' => $this->inventoryWorker->id]);
        $this->assertSame($before, Order::findOrFail($this->orderId)->items->first()->unit_price_centavos);
        $this->signIn($this->shopper)->postJson('/api/shopper/orders', $cart + ['quote_token' => $quote, 'idempotency_key' => (string) \Illuminate\Support\Str::uuid()])->assertConflict();
        $this->signIn($this->foreign)->getJson('/api/inventory/items/'.$this->inventory->store_inventory_id.'/price-history')->assertNotFound();
    }

    public function test_photo_upload_replace_remove_is_scoped_and_does_not_change_product_or_stock(): void
    {
        Storage::fake('local');
        $photo = fn () => UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
        $before = $this->inventory->fresh()->getAttributes();
        $path = '/api/inventory/items/'.$this->inventory->store_inventory_id.'/photo';
        $this->signIn($this->inventoryWorker)->post($path, ['photo' => $photo()])->assertOk();
        $old = $this->inventory->product->fresh()->image_path;
        $this->post($path, ['photo' => $photo()])->assertOk();
        Storage::disk('local')->assertMissing($old);
        $this->assertSame($before, $this->inventory->fresh()->getAttributes());
        $this->signIn($this->foreign)->get('/api/catalog/products/'.$this->inventory->product_id.'/photo')->assertNotFound();
        $this->signIn($this->shopper)->get('/api/catalog/products/'.$this->inventory->product_id.'/photo')->assertOk();
        $this->signIn($this->inventoryWorker)->deleteJson($path)->assertOk();
        $this->assertNull($this->inventory->product->fresh()->image_path);
        $this->post($path, ['photo' => UploadedFile::fake()->create('code.php', 1)], ['Accept' => 'application/json'])->assertUnprocessable();
    }

    public function test_receiving_requires_supervisor_approval_and_cannot_be_counted_twice(): void
    {
        $id = $this->receive();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->signIn($this->inventoryWorker)->putJson('/api/supervisor/receiving/'.$id.'/decision', ['decision' => 'approved', 'decision_note' => 'No'])->assertForbidden();
        $this->signIn($this->foreign)->putJson('/api/supervisor/receiving/'.$id.'/decision', ['decision' => 'approved', 'decision_note' => 'No'])->assertNotFound();
        $this->approve($id);
        $this->assertSame(105, $this->inventory->fresh()->hard_stock_qty);
        $this->putJson('/api/supervisor/receiving/'.$id.'/decision', ['decision' => 'approved', 'decision_note' => 'Duplicate'])->assertConflict();
        $this->assertDatabaseCount('stock_batches', 1);
        $this->assertDatabaseHas('stock_receiving_requests', ['id' => $id, 'hard_stock_before' => 100, 'hard_stock_after' => 105]);
    }

    public function test_expiry_quarantine_and_disposal_preserve_physical_stock_and_reservations(): void
    {
        $id = $this->receive(); $this->approve($id);
        $batch = DB::table('stock_batches')->first();
        $this->assertSame(103, $this->inventory->fresh()->availableStock());
        $this->travelTo(now()->addDays(3));
        $this->assertSame(98, $this->inventory->fresh()->availableStock());
        $this->assertSame(105, $this->inventory->fresh()->hard_stock_qty);
        $disposal = $this->receive(['kind' => 'dispose', 'batch_reference' => 'DISPOSE-01', 'batch_id' => $batch->id,
            'quantity' => 5, 'received_date' => '2026-10-22', 'expiration_date' => null, 'description' => 'Expired batch physical disposal.']);
        $this->approve($disposal);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(98, $this->inventory->fresh()->availableStock());
        $this->assertSame(0, DB::table('stock_batches')->value('remaining_qty'));
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
    }

    public function test_alerts_are_persistent_acknowledged_per_user_and_deduplicated_by_episode(): void
    {
        $this->inventory->low_stock_threshold = 98; $this->inventory->save();
        app(StockAlerts::class)->scan(); app(StockAlerts::class)->scan();
        $this->assertDatabaseCount('stock_alerts', 1);
        $id = DB::table('stock_alerts')->value('id');
        $this->signIn($this->inventoryWorker)->putJson('/api/inventory/stock-alerts/'.$id.'/read')->assertOk();
        $this->getJson('/api/inventory/stock-alerts')->assertOk()->assertJsonPath('alerts.0.read_at', fn ($value) => $value !== null);
        $this->signIn($this->supervisor)->getJson('/api/inventory/stock-alerts')->assertOk()->assertJsonPath('alerts.0.read_at', null);
        $this->signIn($this->foreign)->getJson('/api/inventory/stock-alerts')->assertOk()->assertJsonCount(0, 'alerts');
        $this->putJson('/api/inventory/stock-alerts/'.$id.'/read')->assertNotFound();
        $this->inventory->hard_stock_qty = 110; $this->inventory->save();
        $this->inventory->hard_stock_qty = 100; $this->inventory->save();
        $this->assertDatabaseCount('stock_alerts', 2);
        $this->assertNotNull(DB::table('stock_alerts')->where('id', $id)->value('recovered_at'));
    }

    public function test_csv_preview_validates_lines_duplicates_and_confirmation_is_bound_to_store(): void
    {
        $csv = "sku,quantity,received_date,expiration_date,batch_reference\r\nRICE,5,2026-10-19,2026-10-21,CSV-1\r\nRICE,5,2026-10-19,,CSV-1\r\nRICE,1.5,2026-10-19,,BAD\r\nFOREIGN,2,2026-10-19,,B\r\n";
        $preview = $this->signIn($this->inventoryWorker)->post('/api/inventory/receiving/preview', ['file' => UploadedFile::fake()->createWithContent('delivery.csv', $csv)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('accepted', 1)->assertJsonPath('rejected', 3)->assertJsonPath('errors.0.line', 3)->json();
        $this->assertDatabaseCount('stock_receiving_requests', 0);
        $this->postJson('/api/inventory/receiving/import', ['preview_token' => $preview['preview_token']])->assertCreated()->assertJsonPath('submitted', 1);
        $this->postJson('/api/inventory/receiving/import', ['preview_token' => $preview['preview_token']])->assertConflict();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertDatabaseCount('stock_receiving_requests', 1);
        $this->inventoryWorker->staffStoreAssignment()->update(['store_id' => $this->otherStore->store_id]);
        $this->signIn($this->inventoryWorker)->postJson('/api/inventory/receiving/import', ['preview_token' => $preview['preview_token']])->assertConflict();
    }

    public function test_unit_is_snapshotted_on_order_and_does_not_change_historically(): void
    {
        $this->inventory->product->update(['selling_unit' => 'pack']);
        $id = $this->placeOrder();
        $this->inventory->product->update(['selling_unit' => 'box']);
        $this->assertSame('pack', Order::findOrFail($id)->items->first()->selling_unit);
        $this->assertNull(Order::findOrFail($this->orderId)->items->first()->selling_unit);
    }

    public function test_fefo_handover_consumes_tracked_safe_batches_once(): void
    {
        $this->approve($this->receive());
        $credential = $this->ready(); $this->cash();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
        $this->assertSame(3, DB::table('stock_batches')->value('remaining_qty'));
        $this->assertSame(103, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(0, $this->inventory->fresh()->soft_stock_qty);
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->assertSame(1, DB::table('stock_batch_events')->where('event', 'handover')->count());
    }

    public function test_unsafe_stock_cannot_be_checked_out_or_handed_over_and_hard_stock_stays_intact(): void
    {
        $credential = $this->ready(); $this->cash();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        DB::table('stock_batches')->insert(['store_id' => $this->store->store_id, 'store_inventory_id' => $this->inventory->store_inventory_id,
            'batch_reference' => 'LEGACY-COUNTED-FIXTURE', 'received_date' => '2026-10-01', 'expiration_date' => '2026-10-18',
            'quantity_received' => 100, 'remaining_qty' => 100, 'status' => 'available', 'received_by_user_id' => $this->inventoryWorker->id,
            'created_at' => now(), 'updated_at' => now()]);
        $this->assertSame(0, $this->inventory->fresh()->availableStock());
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnprocessable();
        $this->signIn($this->supervisor)->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('order_handovers', 0);
    }

    public function test_admin_low_stock_summary_uses_sellable_batch_safety(): void
    {
        $this->inventory->low_stock_threshold = 97; $this->inventory->save();
        $this->approve($this->receive(['quantity' => 100]));
        $this->travelTo(now()->addDays(3));
        // 200 physical - 2 reserved - 100 expired = 98, still above threshold.
        $this->signIn($this->admin)->getJson('/api/dashboard/summary')->assertOk()->assertJsonPath('low_stock_products', 0);
        $this->inventory->low_stock_threshold = 98; $this->inventory->save();
        $this->getJson('/api/dashboard/summary')->assertOk()->assertJsonPath('low_stock_products', 1)->assertJsonPath('low_stock_records.0.available_stock', 98);
    }

    public function test_csv_error_lines_account_for_embedded_newlines(): void
    {
        $csv = "sku,quantity,received_date,expiration_date,batch_reference\nRICE,2,2026-10-19,,\"BAD\nREFERENCE\"\nRICE,1.5,2026-10-19,,OTHER\n";
        $this->signIn($this->inventoryWorker)->post('/api/inventory/receiving/preview', ['file' => UploadedFile::fake()->createWithContent('delivery.csv', $csv)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('errors.0.line', 2)->assertJsonPath('errors.1.line', 4)->assertJsonPath('rejected', 2);
    }
}
