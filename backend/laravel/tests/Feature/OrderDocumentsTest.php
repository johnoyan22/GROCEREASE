<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Services\OrderReference;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class OrderDocumentsTest extends TransactionTestCase
{
    public function test_reference_is_deterministic_canonical_and_does_not_truncate_large_ids(): void
    {
        foreach (['1', '123', '12345678901', '9223372036854775807', '18446744073709551615'] as $id) {
            $reference = OrderReference::format($id);
            $this->assertSame($id, OrderReference::parse($reference));
            $this->assertStringEndsWith($id, $reference);
        }
        foreach (['GE-ORD-00000000', 'GE-ORD-1', 'GE-ORD-000000001', 'GE-ORD-18446744073709551616', '123', 'ge-ord-00000001', "GE-ORD-00000001\n"] as $bad) $this->assertNull(OrderReference::parse($bad));
        $this->signIn($this->shopper)->getJson('/api/shopper/orders/'.$this->orderId)->assertOk()->assertJsonPath('order.order_reference', OrderReference::format($this->orderId));
    }

    public function test_unpaid_summary_uses_saved_snapshots_and_reprints_do_not_mutate_anything(): void
    {
        $before = Order::findOrFail($this->orderId)->getRawOriginal();
        $this->store->update(['store_name' => 'Changed current store']);
        $this->shopper->update(['first_name' => 'Changed']);
        $this->inventory->update(['selling_price' => '99.00']);
        $this->signIn($this->shopper);
        for ($i = 0; $i < 2; $i++) {
            $response = $this->getJson($this->shopperPath('summary'))->assertOk()->assertHeader('Cache-Control', 'no-store, private')
                ->assertJsonPath('summary.order.store_name', 'Store A')->assertJsonPath('summary.order.payment_status', 'unpaid')
                ->assertJsonPath('summary.order.payment_confirmed', false)->assertJsonPath('summary.order.items.0.unit_price_centavos', 6700);
            foreach (['shopper_user_id', 'store_inventory_id', 'history', 'assignments', 'secret_payload', 'claimant_check_note', 'evidence_reference'] as $hidden) $this->assertStringNotContainsString($hidden, $response->getContent());
        }
        $this->getJson($this->shopperPath('receipt'))->assertConflict();
        $this->assertSame($before, Order::findOrFail($this->orderId)->getRawOriginal());
        $this->assertDatabaseCount('order_payments', 0); $this->assertDatabaseCount('order_handovers', 0);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_summary_can_truthfully_show_pending_digital_without_fake_payment(): void
    {
        Order::findOrFail($this->orderId)->update(['payment_method' => 'digital', 'payment_status' => 'unpaid']);
        $this->signIn($this->shopper)->getJson($this->shopperPath('summary'))->assertOk()
            ->assertJsonPath('summary.order.payment_display_status', 'Pending / Unpaid')->assertJsonPath('summary.order.payment_confirmed', false);
        $this->assertDatabaseCount('order_payments', 0);
    }

    public function test_document_access_is_owner_or_current_store_and_receipt_admin_oversight_only(): void
    {
        $this->signIn($this->other)->getJson($this->shopperPath('summary'))->assertNotFound();
        $this->signIn($this->foreign)->getJson($this->path('summary'))->assertNotFound();
        $this->signIn($this->inventoryWorker)->getJson($this->path('summary'))->assertForbidden();
        $this->signIn($this->admin)->getJson($this->path('summary'))->assertForbidden();
        $this->signIn($this->supervisor)->getJson($this->path('summary'))->assertOk();
        $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->otherStore->store_id]);
        $this->getJson($this->path('summary'))->assertNotFound();
    }

    public function test_completed_receipt_retains_historical_number_actual_claimant_and_no_secret_evidence(): void
    {
        $secret = $this->ready(); $this->cash();
        $this->postJson($this->path('claim'), ['method' => 'pin', 'credential' => $secret['pin'], 'claiming_as' => 'representative',
            'claimant_name' => 'Actual Person', 'identity_checked' => true, 'physically_handed_over' => true])->assertOk();
        $handover = DB::table('order_handovers')->first();
        foreach ([$this->supervisor, $this->shopper, $this->admin] as $user) {
            $role = $user->role->slug;
            $response = $this->signIn($user)->getJson('/api/'.$role.'/orders/'.$this->orderId.'/receipt')->assertOk()
                ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('receipt.receipt_number', 'GE-'.$this->orderId.'-'.$handover->id)
                ->assertJsonPath('receipt.claimant_name', 'Actual Person')->assertJsonPath('receipt.order.payment_confirmed', true);
            foreach ([$secret['pin'], $secret['qr_token'], 'cashier_name', 'evidence_reference', 'claimant_check_note', 'shopper_user_id'] as $hidden) $this->assertStringNotContainsString($hidden, $response->getContent());
        }
        $this->assertDatabaseCount('order_payments', 1); $this->assertDatabaseCount('order_handovers', 1);
        $this->signIn($this->other)->getJson($this->shopperPath('receipt'))->assertNotFound();
        $this->signIn($this->foreign)->getJson($this->path('receipt'))->assertNotFound();
    }
}
