<?php

namespace Tests\Feature;

use App\Models\AiRecommendationSetting;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Support\CategoryFixture;
use Tests\Support\TransactionTestCase;

class CategoryManagementTest extends TransactionTestCase
{
    private function create(string $name = 'Fresh Produce', string $status = 'active'): int
    {
        return $this->signIn($this->supervisor)->postJson('/api/supervisor/categories', compact('name', 'status'))->assertCreated()->json('category.id');
    }
    private function productData(int $category): array
    {
        return ['product_name' => 'New product', 'category_id' => $category, 'selling_unit' => 'piece', 'selling_price' => '12.50', 'status' => 'active'];
    }

    public function test_crud_normalizes_names_rejects_duplicates_and_reuses_inactive_identity(): void
    {
        $id = $this->create('  Fresh   Produce  ');
        $this->assertDatabaseHas('categories', ['id' => $id, 'name' => 'Fresh Produce', 'name_key' => 'fresh produce', 'created_by_user_id' => $this->supervisor->id]);
        foreach (['fresh produce', "FRESH\tPRODUCE", '  Fresh  Produce '] as $name) $this->postJson('/api/supervisor/categories', ['name' => $name, 'status' => 'inactive'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->putJson('/api/supervisor/categories/'.$id, ['name' => 'Fresh Produce', 'status' => 'inactive'])->assertOk();
        $this->postJson('/api/supervisor/categories', ['name' => 'Fresh Produce', 'status' => 'active'])->assertUnprocessable();
        $this->putJson('/api/supervisor/categories/'.$id, ['name' => 'Fruit & Vegetables', 'status' => 'active'])->assertOk()->assertJsonPath('category.id', $id);
        $this->deleteJson('/api/supervisor/categories/'.$id)->assertOk();
        $this->assertDatabaseMissing('categories', ['id' => $id]);
        $this->assertDatabaseHas('category_changes', ['category_id' => $id, 'action' => 'deleted', 'changed_by_user_id' => $this->supervisor->id]);
    }

    public function test_store_scoping_current_authorization_and_worker_write_denial(): void
    {
        $id = $this->create();
        $other = $this->signIn($this->foreign)->postJson('/api/supervisor/categories', ['name' => 'Fresh Produce', 'status' => 'active'])->assertCreated()->json('category.id');
        $this->getJson('/api/staff/categories')->assertOk()->assertJsonCount(1, 'categories')->assertJsonPath('categories.0.id', $other);
        $this->putJson('/api/supervisor/categories/'.$id, ['name' => 'Forged', 'status' => 'active'])->assertNotFound();
        $this->deleteJson('/api/supervisor/categories/'.$id)->assertNotFound();
        $this->signIn($this->inventoryWorker)->getJson('/api/staff/category-options')->assertOk()->assertJsonCount(2, 'categories');
        $this->postJson('/api/supervisor/categories', ['name' => 'No', 'status' => 'active'])->assertForbidden();
        $this->putJson('/api/supervisor/categories/'.$id, ['name' => 'No', 'status' => 'active'])->assertForbidden();
        $this->deleteJson('/api/supervisor/categories/'.$id)->assertForbidden();
        $this->signIn($this->supervisor)->postJson('/api/supervisor/categories', ['name' => 'Override', 'status' => 'active', 'store_id' => $this->otherStore->store_id])->assertUnprocessable();
        $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->otherStore->store_id]);
        $this->putJson('/api/supervisor/categories/'.$id, ['name' => 'Old assignment', 'status' => 'active'])->assertNotFound();
        $this->supervisor->forceFill(['staff_approved_at' => null])->save();
        $this->getJson('/api/staff/categories')->assertForbidden();
        $this->signIn($this->shopper)->getJson('/api/staff/category-options')->assertForbidden();
    }

    public function test_product_dropdown_contract_active_own_store_only_and_unchanged_inactive_edit(): void
    {
        $id = $this->create();
        $foreign = CategoryFixture::id($this->otherStore->store_id, 'Foreign');
        $this->signIn($this->inventoryWorker);
        foreach ([$foreign, 999999] as $wrong) $this->postJson('/api/inventory/items', $this->productData($wrong))->assertUnprocessable()->assertJsonValidationErrors('category_id');
        $this->postJson('/api/inventory/items', [...$this->productData($id), 'category' => 'Forged free text'])->assertUnprocessable()->assertJsonValidationErrors('category');
        $this->postJson('/api/inventory/items', ['product_name' => 'Missing category', 'selling_unit' => 'piece', 'selling_price' => 1, 'status' => 'active'])->assertUnprocessable()->assertJsonValidationErrors('category_id');
        $item = $this->postJson('/api/inventory/items', $this->productData($id))->assertCreated()->json('inventory');
        $this->signIn($this->supervisor)->putJson('/api/supervisor/categories/'.$id, ['name' => 'Fresh Produce', 'status' => 'inactive'])->assertOk();
        $this->signIn($this->inventoryWorker)->getJson('/api/staff/category-options')->assertOk()->assertJsonMissing(['id' => $id]);
        $this->postJson('/api/inventory/items', $this->productData($id))->assertUnprocessable()->assertJsonValidationErrors('category_id');
        $this->putJson('/api/inventory/items/'.$item['store_inventory_id'], [...$this->productData($id), 'selling_price' => '13.50'])->assertOk()->assertJsonPath('inventory.category_status', 'inactive')->assertJsonPath('inventory.status', 'active');
        $this->putJson('/api/inventory/items/'.$this->inventory->store_inventory_id, $this->productData($id))->assertUnprocessable();
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertSame('67.00', $this->inventory->fresh()->selling_price);
    }

    public function test_in_use_or_previously_used_categories_cannot_be_deleted(): void
    {
        $id = $this->inventory->product->category_id;
        $this->signIn($this->supervisor)->deleteJson('/api/supervisor/categories/'.$id)->assertConflict()->assertJsonFragment(['message' => 'This category has been used by products and must be preserved. Set it to Inactive instead.']);
        $replacement = $this->create('Replacement');
        $this->signIn($this->inventoryWorker)->putJson('/api/inventory/items/'.$this->inventory->store_inventory_id, $this->productData($replacement))->assertOk();
        $this->signIn($this->supervisor)->deleteJson('/api/supervisor/categories/'.$id)->assertConflict();
        $this->assertSame(1, Product::count());
    }

    public function test_rename_synchronizes_current_inventory_catalog_ai_filters_but_preserves_order_snapshots(): void
    {
        $id = $this->inventory->product->category_id;
        $before = Order::findOrFail($this->orderId)->items()->firstOrFail()->getAttributes();
        AiRecommendationSetting::create(['store_id' => $this->store->store_id, 'included_categories' => ['Staples'], 'excluded_categories' => [], 'updated_by' => $this->supervisor->id]);
        $this->signIn($this->supervisor)->putJson('/api/supervisor/categories/'.$id, ['name' => 'Rice & Staples', 'status' => 'inactive'])->assertOk();
        $this->getJson('/api/inventory/items?include_batches=0')->assertOk()->assertJsonPath('inventory.0.category', 'Rice & Staples')->assertJsonPath('inventory.0.status', 'active');
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/products')->assertOk()->assertJsonPath('products.0.category', 'Rice & Staples');
        $this->assertSame(['Rice & Staples'], AiRecommendationSetting::where('store_id', $this->store->store_id)->first()->included_categories);
        $this->assertSame($before, Order::findOrFail($this->orderId)->items()->firstOrFail()->getAttributes());
    }

    public function test_search_status_pagination_and_name_validation(): void
    {
        foreach (range(1, 13) as $i) $this->create(sprintf('Category %02d', $i), $i % 2 ? 'active' : 'inactive');
        $this->getJson('/api/staff/categories?page=2')->assertOk()->assertJsonPath('pagination.total', 14)->assertJsonCount(4, 'categories');
        $this->getJson('/api/staff/categories?search=Category&status=inactive')->assertOk()->assertJsonPath('pagination.total', 6);
        $this->getJson('/api/staff/categories?search=absent&page=99')->assertOk()->assertJsonPath('pagination.current_page', 1)->assertJsonCount(0, 'categories');
        foreach (['   ', str_repeat('x', 101), "bad\x01name", ['invalid']] as $name) $this->postJson('/api/supervisor/categories', ['name' => $name, 'status' => 'active'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson('/api/supervisor/categories', ['name' => 'Valid', 'status' => 'unknown'])->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_database_rejects_duplicate_keys_and_foreign_category_links(): void
    {
        $id = $this->inventory->product->category_id;
        try {
            DB::table('categories')->insert(['store_id' => $this->store->store_id, 'name' => 'Other spelling', 'name_key' => 'staples', 'status' => 'active']);
            $this->fail('Duplicate category key accepted.');
        } catch (QueryException) { $this->assertTrue(true); }
        $foreign = CategoryFixture::id($this->otherStore->store_id, 'Foreign');
        try {
            DB::table('products')->where('product_id', $this->inventory->product_id)->update(['category_id' => $foreign]);
            $this->fail('Foreign category accepted.');
        } catch (QueryException) { $this->assertSame($id, $this->inventory->fresh()->product->category_id); }
    }
}
