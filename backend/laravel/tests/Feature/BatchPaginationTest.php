<?php

namespace Tests\Feature;

use App\Models\InventoryBatch;
use App\Models\Product;
use App\Models\StoreInventory;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class BatchPaginationTest extends TransactionTestCase
{
    private function fixture(int $count = 100): StoreInventory
    {
        $product = \Tests\Support\CategoryFixture::product(['store_id' => $this->store->store_id, 'product_name' => 'Paged bottles', 'sku' => 'PAGED', 'category' => 'QA', 'selling_unit' => 'bottle']);
        $inventory = StoreInventory::create(['store_id' => $this->store->store_id, 'product_id' => $product->product_id,
            'hard_stock_qty' => $count, 'soft_stock_qty' => 0, 'selling_price' => '1.00', 'status' => 'active']);
        $inventory->forceFill(['batches_initialized' => true, 'low_stock_threshold' => $count - 2])->save();
        for ($i = 1; $i <= $count; $i++) {
            InventoryBatch::create(['store_inventory_id' => $inventory->store_inventory_id, 'reference' => 'GE-B-FIXTURE-'.$i,
                'quantity_received' => 1, 'remaining_quantity' => 1, 'received_date' => '2026-01-01',
                'expiry_date' => $i === 3 ? null : ($i === 1 ? '2026-02-01' : '2027-12-31'),
                'status' => $i === 2 ? 'on_hold' : 'active', 'description' => 'QA receipt '.$i]);
        }
        return $inventory;
    }

    private function url(StoreInventory $inventory): string { return '/api/inventory/items/'.$inventory->store_inventory_id.'/batches'; }

    public function test_twenty_pages_include_all_remaining_stock_and_keep_totals_and_references(): void
    {
        $inventory = $this->fixture();
        $before = $inventory->fresh()->getAttributes();
        $saved = InventoryBatch::where('store_inventory_id', $inventory->store_inventory_id)->get()->keyBy('id');
        $ids = [];
        $this->signIn($this->inventoryWorker);
        for ($page = 1; $page <= 20; $page++) {
            $result = $this->getJson($this->url($inventory).'?page='.$page)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
                ->assertJsonCount(5, 'batches')->assertJsonPath('pagination.total', 100)->assertJsonPath('pagination.last_page', 20)
                ->assertJsonPath('pagination.current_page', $page)->assertJsonPath('pagination.from', ($page - 1) * 5 + 1)->json();
            foreach ($result['batches'] as $batch) {
                $ids[] = $batch['id'];
                $this->assertSame('B-'.str_pad($batch['id'], 6, '0', STR_PAD_LEFT), $batch['batch_no']);
                $this->assertSame($saved[$batch['id']]->reference, $batch['reference']);
            }
            if ($page === 1) {
                $this->assertSame('expired', $result['batches'][0]['status']);
                $this->assertSame('on_hold', $result['batches'][1]['status']);
            }
            if ($page === 20) $this->assertNull($result['batches'][4]['expiry_date']);
        }
        $this->assertCount(100, array_unique($ids));
        $this->assertSame($before, $inventory->fresh()->getAttributes());
        $this->assertSame(98, $inventory->fresh()->availableStock());
        $this->assertFalse($inventory->fresh()->isLowStock());
        $this->getJson('/api/inventory/items?include_batches=0')->assertOk()
            ->assertJsonMissingPath('inventory.1.batches')->assertJsonPath('inventory.1.hard_stock_qty', 100)
            ->assertJsonPath('inventory.1.available_stock', 98)->assertJsonPath('inventory.1.nearest_expiry', '2027-12-31')
            ->assertJsonPath('inventory.1.expiry_received_dates.0', '2026-01-01');
        $this->getJson('/api/inventory/items')->assertOk()->assertJsonCount(100, 'inventory.1.batches');
    }

    public function test_filtering_clamps_changed_last_page_and_handles_zero_matches(): void
    {
        $inventory = $this->fixture(7);
        $this->signIn($this->inventoryWorker);
        $this->getJson($this->url($inventory).'?page=2')->assertOk()->assertJsonCount(2, 'batches')->assertJsonPath('pagination.last_page', 2);
        $batch = $inventory->batches()->firstOrFail();
        $number = $batch->publicData()['batch_no'];
        InventoryBatch::where('store_inventory_id', $inventory->store_inventory_id)->where('id', '!=', $batch->id)->update(['remaining_quantity' => 0]);
        $inventory->hard_stock_qty = 1; $inventory->save();
        $this->getJson($this->url($inventory).'?page=2')->assertOk()->assertJsonCount(1, 'batches')
            ->assertJsonPath('pagination.current_page', 1)->assertJsonPath('pagination.last_page', 1)->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('batches.0.batch_no', $number);
        $this->getJson($this->url($inventory).'?page=2&include_empty=1')->assertOk()->assertJsonCount(2, 'batches')->assertJsonPath('pagination.total', 7);
        $batch->remaining_quantity = 0; $batch->save();
        $this->getJson($this->url($inventory).'?page=99')->assertOk()->assertJsonCount(0, 'batches')
            ->assertJsonPath('pagination.current_page', 1)->assertJsonPath('pagination.last_page', 1)
            ->assertJsonPath('pagination.total', 0)->assertJsonPath('pagination.from', null)->assertJsonPath('pagination.to', null);
        $this->assertSame($number, $batch->fresh()->publicData()['batch_no']);
    }

    public function test_store_role_approval_and_parameter_authorization(): void
    {
        $inventory = $this->fixture(6); $url = $this->url($inventory);
        $this->signIn($this->foreign)->getJson($url)->assertNotFound();
        $this->signIn($this->shopper)->getJson($url)->assertForbidden();
        $this->signIn($this->admin)->getJson($url)->assertForbidden();
        $this->signIn($this->supervisor)->getJson($url)->assertOk()->assertJsonCount(5, 'batches');
        $this->signIn($this->inventoryWorker)->getJson($this->url($this->inventory))->assertOk()->assertJsonCount(1, 'batches');
        foreach (['page=0', 'page=-1', 'page=1.5', 'page=bad', 'page=2147483648', 'include_empty=yes', 'per_page=100', 'store_id=2'] as $query) {
            $this->getJson($url.'?'.$query)->assertUnprocessable();
        }
        $this->inventoryWorker->forceFill(['staff_approved_at' => null])->save();
        $this->getJson($url)->assertForbidden();
        $this->store->status = 'inactive'; $this->store->save();
        $this->signIn($this->supervisor)->getJson($url)->assertForbidden();
    }

    public function test_picking_and_details_use_the_same_alias_without_rewriting_saved_reference(): void
    {
        $batch = $this->inventory->batches()->firstOrFail();
        $before = DB::table('inventory_batches')->where('id', $batch->id)->first();
        $details = $this->signIn($this->inventoryWorker)->getJson($this->url($this->inventory))->assertOk()->json('batches.0');
        $picking = $this->getJson('/api/staff/orders')->assertOk()->json('orders.0.items.0.picking_batches.0');
        $this->assertSame($details['batch_no'], $picking['batch_no']);
        $this->assertSame($details['reference'], $picking['reference']);
        $this->assertEquals($before, DB::table('inventory_batches')->where('id', $batch->id)->first());
        $this->assertSame('B-654321', InventoryBatch::displayNumber(1, 'B-654321'));
        $this->assertSame('B-000001', InventoryBatch::displayNumber(1, null));
    }
}
