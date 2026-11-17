<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cop_policy_versions', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled');
            $table->unsignedInteger('maximum_centavos');
            $table->unsignedSmallInteger('temporary_threshold');
            $table->unsignedSmallInteger('temporary_days');
            $table->unsignedSmallInteger('permanent_threshold');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('reason', 500);
            // NULL means the legacy policy; no historical Admin action is invented.
            $table->dateTime('effective_at')->nullable();
        });
        Schema::create('cop_policy', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->foreignId('version_id')->constrained('cop_policy_versions')->restrictOnDelete();
        });
        Schema::create('cop_cycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shopper_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('number');
            $table->dateTime('started_at')->nullable();
            $table->dateTime('closed_at')->nullable();
            $table->unique(['shopper_user_id', 'number']);
        });
        Schema::create('cop_accounts', function (Blueprint $table) {
            $table->foreignId('shopper_user_id')->primary()->constrained('users')->restrictOnDelete();
            $table->foreignId('cycle_id')->constrained('cop_cycles')->restrictOnDelete();
            $table->unsignedInteger('version')->default(0);
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('cop_policy_version_id')->nullable()->constrained('cop_policy_versions')->restrictOnDelete();
            $table->json('cop_policy_snapshot')->nullable();
        });
        Schema::table('cop_strikes', function (Blueprint $table) {
            $table->foreignId('policy_version_id')->nullable()->constrained('cop_policy_versions')->restrictOnDelete();
            $table->foreignId('cycle_id')->nullable()->constrained('cop_cycles')->restrictOnDelete();
            $table->index(['shopper_user_id', 'cycle_id', 'issued_at']);
        });
        Schema::create('cop_restrictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shopper_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('cycle_id')->constrained('cop_cycles')->restrictOnDelete();
            $table->foreignId('strike_id')->nullable()->unique()->constrained('cop_strikes')->restrictOnDelete();
            $table->string('source', 20);
            // Original outcome is immutable. Effective fields are a replayable correction projection.
            $table->string('original_kind', 20);
            $table->dateTime('original_expires_at')->nullable();
            $table->string('effective_kind', 20);
            $table->unsignedInteger('effective_count')->nullable();
            $table->dateTime('effective_expires_at')->nullable();
            $table->dateTime('started_at');
            $table->dateTime('ended_at')->nullable();
            $table->string('reason', 500);
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->index(['shopper_user_id', 'ended_at']);
        });
        Schema::create('cop_access_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shopper_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('strike_id')->nullable()->constrained('cop_strikes')->restrictOnDelete();
            $table->string('action', 30);
            $table->string('reason', 500);
            $table->json('before_state')->nullable();
            $table->json('after_state')->nullable();
            $table->dateTime('occurred_at')->index();
            $table->index(['shopper_user_id', 'id']);
        });
        Schema::create('cop_failed_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->string('classification', 30);
            $table->string('payment_method', 30);
            $table->string('payment_state', 30);
            $table->dateTime('claim_deadline_at')->nullable();
            $table->dateTime('incident_at')->nullable()->index();
            $table->string('reason', 500)->nullable();
            $table->string('evidence_source', 30);
        });

        $legacy = ['enabled' => true, 'maximum_centavos' => 150000, 'temporary_threshold' => 2, 'temporary_days' => 30, 'permanent_threshold' => 3];
        $policyId = DB::table('cop_policy_versions')->insertGetId($legacy + ['reason' => 'Legacy COP policy (migration preservation)', 'effective_at' => null]);
        DB::table('cop_policy')->insert(['id' => 1, 'version_id' => $policyId]);
        $snapshot = json_encode(['version' => $policyId, ...$legacy, 'currency' => 'PHP']);
        DB::table('orders')->update(['cop_policy_version_id' => $policyId, 'cop_policy_snapshot' => $snapshot]);
        DB::table('cop_strikes')->select('shopper_user_id')->distinct()->orderBy('shopper_user_id')->get()->each(function ($row) use ($policyId) {
            $cycle = DB::table('cop_cycles')->insertGetId(['shopper_user_id' => $row->shopper_user_id, 'number' => 1]);
            DB::table('cop_accounts')->insert(['shopper_user_id' => $row->shopper_user_id, 'cycle_id' => $cycle, 'version' => 0]);
            DB::table('cop_strikes')->where('shopper_user_id', $row->shopper_user_id)->update(['policy_version_id' => $policyId, 'cycle_id' => $cycle]);
            app(\App\Services\CopRestrictions::class)->replay($row->shopper_user_id);
        });
        DB::table('orders as o')->leftJoin('cop_strikes as c', 'c.order_id', '=', 'o.order_id')
            ->where(function ($q) { $q->whereNotNull('o.unclaimed_at')->orWhereNotNull('c.id')->orWhereIn('o.claim_status', ['no_show', 'unclaimed_pending_resolution']); })
            ->select('o.*', 'c.id as strike_id', 'c.issued_at as strike_issued_at')->orderBy('o.order_id')->chunk(200, function ($orders) {
                foreach ($orders as $order) {
                    $classification = $order->strike_id || $order->claim_status === 'no_show' ? 'no_show'
                        : ($order->claim_status === 'unclaimed_pending_resolution' || str_starts_with($order->unclaimed_reason ?? '', 'Paid order holding deadline expired.') ? 'paid_unclaimed' : 'requires_review');
                    DB::table('cop_failed_claims')->insert(['order_id' => $order->order_id, 'classification' => $classification,
                        'payment_method' => $order->payment_method, 'payment_state' => $classification === 'no_show' ? 'unpaid' : ($classification === 'paid_unclaimed' ? 'paid' : $order->payment_status),
                        'claim_deadline_at' => $order->claim_expires_at, 'incident_at' => $order->unclaimed_at ?? $order->strike_issued_at,
                        'reason' => $order->unclaimed_reason, 'evidence_source' => $order->unclaimed_at ? 'legacy_order' : ($order->strike_id ? 'legacy_strike' : 'legacy_status')]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('cop_failed_claims');
        Schema::dropIfExists('cop_access_events');
        Schema::dropIfExists('cop_restrictions');
        Schema::table('cop_strikes', function (Blueprint $table) {
            $table->dropIndex(['shopper_user_id', 'cycle_id', 'issued_at']);
            $table->dropConstrainedForeignId('policy_version_id');
            $table->dropConstrainedForeignId('cycle_id');
        });
        Schema::table('orders', function (Blueprint $table) { $table->dropConstrainedForeignId('cop_policy_version_id'); $table->dropColumn('cop_policy_snapshot'); });
        Schema::dropIfExists('cop_accounts'); Schema::dropIfExists('cop_cycles'); Schema::dropIfExists('cop_policy'); Schema::dropIfExists('cop_policy_versions');
    }
};
