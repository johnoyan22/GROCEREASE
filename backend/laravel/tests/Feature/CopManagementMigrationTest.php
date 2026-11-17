<?php

namespace Tests\Feature;

use App\Services\CopRestrictions;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class CopManagementMigrationTest extends TransactionTestCase
{
    public function test_additive_cutover_preserves_original_orders_strikes_corrections_and_restriction_expiry(): void
    {
        $second = $this->placeOrder(); $third = $this->placeOrder();
        $migration = require database_path('migrations/2026_11_17_000005_add_cop_management.php');
        $migration->down();
        $times = ['2026-10-01 01:00:00', '2026-10-02 02:00:00', '2026-10-03 03:00:00'];
        foreach ([$this->orderId, $second, $third] as $i => $id) {
            DB::table('cop_strikes')->insert(['order_id' => $id, 'shopper_user_id' => $this->shopper->id, 'store_id' => $this->store->store_id,
                'strike_number_at_issue' => $i + 1, 'issued_at' => $times[$i], 'voided_at' => $i === 2 ? '2026-10-04 04:00:00' : null,
                'voided_by_user_id' => $i === 2 ? $this->admin->id : null, 'correction_reason' => $i === 2 ? 'Actual legacy correction' : null, 'created_at' => $times[$i], 'updated_at' => $times[$i]]);
            DB::table('orders')->where('order_id', $id)->update(['claim_status' => $i === 0 ? 'canceled' : 'no_show', 'unclaimed_at' => $times[$i], 'unclaimed_reason' => 'Preserved legacy incident']);
        }
        DB::table('order_dispositions')->insert(['order_id' => $this->orderId, 'resolved_by_user_id' => $this->supervisor->id,
            'disposition' => 'all_items_confirmed_suitable_for_resale', 'reason' => 'Actual historical disposition', 'created_at' => '2026-10-05 01:00:00', 'updated_at' => '2026-10-05 01:00:00']);
        $oldOrders = DB::table('orders')->orderBy('order_id')->get()->map(fn ($r) => (array) $r)->all();
        $oldStrikes = DB::table('cop_strikes')->orderBy('id')->get()->map(fn ($r) => (array) $r)->all();
        $migration->up();
        $orders = DB::table('orders')->orderBy('order_id')->get();
        foreach ($oldOrders as $i => $old) $this->assertSame($old, array_intersect_key((array) $orders[$i], $old));
        $strikes = DB::table('cop_strikes')->orderBy('id')->get();
        foreach ($oldStrikes as $i => $old) $this->assertSame($old, array_intersect_key((array) $strikes[$i], $old));
        $status = app(CopRestrictions::class)->status($this->shopper->id);
        $this->assertSame('2026-11-01T02:00:00+00:00', $status['disabled_until']);
        $this->assertSame(2, $status['lifetime_strike_count']); $this->assertFalse($status['allowed']);
        $this->assertDatabaseCount('cop_policy_versions', 1); $this->assertDatabaseCount('cop_failed_claims', 3); $this->assertDatabaseCount('cop_access_events', 0);
        $this->assertDatabaseHas('cop_policy_versions', ['actor_user_id' => null, 'effective_at' => null, 'maximum_centavos' => 150000]);
        $this->assertDatabaseHas('orders', ['order_id' => $second, 'cop_policy_version_id' => 1]);
        $this->assertDatabaseHas('cop_failed_claims', ['order_id' => $this->orderId, 'incident_at' => $times[0], 'classification' => 'no_show']);
        $this->assertDatabaseHas('cop_restrictions', ['strike_id' => $strikes[1]->id, 'original_expires_at' => '2026-11-01 02:00:00', 'effective_expires_at' => '2026-11-01 02:00:00']);
        $this->assertDatabaseCount('order_notifications', 0);
    }
}
