<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('worker_assignments', fn (Blueprint $t) => $t->unsignedTinyInteger('role_schema_version')->default(0));
        Schema::table('active_worker_assignments', function (Blueprint $t) {
            $t->dropUnique(['order_id']);
            $t->index('order_id', 'active_workers_order_index');
        });
        Schema::create('active_order_worker_roles', function (Blueprint $t) {
            $t->unsignedBigInteger('order_id'); $t->string('role', 10);
            $t->foreignId('assignment_id')->constrained('worker_assignments', 'assignment_id')->restrictOnDelete();
            $t->unsignedBigInteger('worker_id'); $t->foreign('worker_id')->references('worker_id')->on('workers')->restrictOnDelete();
            $t->primary(['order_id', 'role']);
            $t->foreign('order_id')->references('order_id')->on('orders')->restrictOnDelete();
        });
        // Existing active tasks retain their responsibility, never an invented completion.
        foreach (DB::table('active_worker_assignments as a')->join('worker_assignments as w', 'w.assignment_id', '=', 'a.assignment_id')->select('a.*', 'w.task_type')->get() as $a) {
            foreach (match ($a->task_type) { 'picking' => ['picking'], 'packing' => ['packing'], default => ['picking', 'packing'] } as $role) {
                DB::table('active_order_worker_roles')->insert(['order_id' => $a->order_id, 'role' => $role, 'assignment_id' => $a->assignment_id, 'worker_id' => $a->worker_id]);
            }
        }
        Schema::create('worker_role_contributions', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('order_id'); $t->foreign('order_id')->references('order_id')->on('orders')->restrictOnDelete();
            $t->foreignId('assignment_id')->constrained('worker_assignments', 'assignment_id')->restrictOnDelete();
            $t->unsignedBigInteger('worker_id'); $t->foreign('worker_id')->references('worker_id')->on('workers')->restrictOnDelete();
            $t->string('role', 10); $t->string('worker_name', 150);
            $t->foreignId('verified_by_user_id')->constrained('users')->restrictOnDelete();
            $t->string('note', 500)->nullable(); $t->timestamp('verified_at'); $t->unique(['order_id', 'role']);
        });
        Schema::create('worker_role_transfers', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('order_id'); $t->foreign('order_id')->references('order_id')->on('orders')->restrictOnDelete();
            $t->foreignId('from_assignment_id')->constrained('worker_assignments', 'assignment_id')->restrictOnDelete();
            $t->foreignId('to_assignment_id')->constrained('worker_assignments', 'assignment_id')->restrictOnDelete();
            $t->string('role', 10); $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->string('reason', 500); $t->timestamp('created_at');
        });
        Schema::table('incentive_budgets', fn (Blueprint $t) => $t->unsignedBigInteger('disbursed_centavos')->default(0));
        Schema::create('incentive_reservation_entries', function (Blueprint $t) {
            $t->id(); $t->foreignId('reservation_id')->constrained('incentive_movements')->restrictOnDelete();
            $t->string('kind', 30); $t->unsignedInteger('amount_centavos');
            $t->foreignId('related_id')->nullable()->constrained('incentive_reservation_entries')->restrictOnDelete();
            $t->uuid('operation_id'); $t->foreign('operation_id')->references('id')->on('financial_operations')->restrictOnDelete();
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $t->string('reason', 500); $t->timestamp('created_at');
            $t->unique(['kind', 'related_id']); $t->index(['reservation_id', 'id']);
        });
        Schema::create('worker_incentive_plans', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->enum('mode', ['actual', 'test']); $t->string('name', 100); $t->string('status', 12)->default('inactive');
            $t->unsignedInteger('version')->default(1); $t->char('active_scope', 64)->nullable()->unique();
            $t->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete(); $t->timestamps();
            $t->index(['store_id', 'mode', 'id']);
        });
        Schema::create('worker_incentive_rules', function (Blueprint $t) {
            $t->id(); $t->foreignId('plan_id')->constrained('worker_incentive_plans')->restrictOnDelete();
            $t->unsignedInteger('version'); $t->unsignedInteger('rate_centavos'); $t->date('effective_on');
            $t->string('status', 12); $t->string('contribution_rule', 60)->default('one_order_1000_split_500_picking_remainder');
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $t->string('reason', 500); $t->timestamp('created_at');
            $t->unique(['plan_id', 'version']); $t->index(['plan_id', 'effective_on']);
        });
        Schema::create('worker_incentive_operations', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->string('mode', 10); $t->string('kind', 30); $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->char('payload_hash', 64); $t->json('result')->nullable(); $t->timestamp('created_at');
        });
        Schema::create('worker_incentive_allocations', function (Blueprint $t) {
            $t->id(); $t->foreignId('plan_id')->constrained('worker_incentive_plans')->restrictOnDelete();
            $t->foreignId('reservation_id')->unique()->constrained('incentive_movements')->restrictOnDelete();
            $t->unsignedInteger('amount_centavos'); $t->foreignId('approved_by_user_id')->constrained('users')->restrictOnDelete();
            $t->string('reason', 500); $t->timestamp('created_at');
        });
        Schema::create('worker_incentive_commitments', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('order_id')->unique(); $t->foreign('order_id')->references('order_id')->on('orders')->restrictOnDelete();
            $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->string('mode', 10)->nullable(); $t->foreignId('plan_id')->nullable()->constrained('worker_incentive_plans')->restrictOnDelete();
            $t->foreignId('rule_id')->nullable()->constrained('worker_incentive_rules')->restrictOnDelete();
            $t->unsignedInteger('amount_centavos')->default(0); $t->json('rule_snapshot')->nullable();
            $t->string('status', 20); $t->string('reason', 200);
            $t->foreignId('initiated_by_user_id')->constrained('users')->restrictOnDelete();
            $t->timestamp('created_at'); $t->timestamp('earned_at')->nullable(); $t->timestamp('released_at')->nullable();
            $t->index(['plan_id', 'status']);
        });
        Schema::create('worker_incentive_outbox', function (Blueprint $t) {
            $t->id(); $t->foreignId('commitment_id')->unique()->constrained('worker_incentive_commitments')->restrictOnDelete();
            $t->foreignId('handover_id')->unique()->constrained('order_handovers')->restrictOnDelete();
            $t->string('status', 15)->default('pending'); $t->string('last_error', 60)->nullable();
            $t->unsignedInteger('attempts')->default(0); $t->timestamp('created_at'); $t->timestamp('attempted_at')->nullable(); $t->timestamp('processed_at')->nullable();
        });
        Schema::create('worker_incentive_commitment_events', function (Blueprint $t) {
            $t->id(); $t->foreignId('commitment_id')->constrained('worker_incentive_commitments')->restrictOnDelete();
            $t->string('event', 20); $t->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('reason', 500); $t->timestamp('created_at'); $t->unique(['commitment_id', 'event'], 'worker_commitment_event_unique');
        });
        Schema::create('worker_incentive_earnings', function (Blueprint $t) {
            $t->id(); $t->foreignId('commitment_id')->constrained('worker_incentive_commitments')->restrictOnDelete();
            $t->foreignId('contribution_id')->unique()->constrained('worker_role_contributions')->restrictOnDelete();
            $t->unsignedBigInteger('order_id'); $t->foreign('order_id')->references('order_id')->on('orders')->restrictOnDelete();
            $t->unsignedBigInteger('worker_id'); $t->foreign('worker_id')->references('worker_id')->on('workers')->restrictOnDelete();
            $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->string('mode', 10); $t->string('role', 10); $t->unsignedSmallInteger('credit_units'); $t->unsignedInteger('amount_centavos');
            $t->foreignId('handover_id')->constrained('order_handovers')->restrictOnDelete(); $t->timestamp('earned_at');
            $t->unique(['order_id', 'role']); $t->index(['store_id', 'mode', 'worker_id', 'id'], 'worker_earnings_scope_index');
        });
        Schema::create('worker_incentive_payments', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->unsignedBigInteger('worker_id'); $t->foreign('worker_id')->references('worker_id')->on('workers')->restrictOnDelete();
            $t->string('mode', 10); $t->unsignedInteger('amount_centavos'); $t->date('paid_on'); $t->string('method', 30);
            $t->text('evidence'); $t->char('evidence_key', 64)->unique(); $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->string('reason', 500); $t->timestamp('created_at'); $t->index(['store_id', 'mode', 'id']);
        });
        Schema::create('worker_incentive_payment_items', function (Blueprint $t) {
            $t->id(); $t->foreignId('payment_id')->constrained('worker_incentive_payments')->restrictOnDelete();
            $t->foreignId('earning_id')->constrained('worker_incentive_earnings')->restrictOnDelete();
            $t->unsignedBigInteger('active_earning_id')->nullable()->unique(); $t->unsignedInteger('amount_centavos');
        });
        Schema::create('worker_incentive_payment_allocations', function (Blueprint $t) {
            $t->id(); $t->foreignId('payment_id')->constrained('worker_incentive_payments')->restrictOnDelete();
            $t->foreignId('allocation_id')->constrained('worker_incentive_allocations')->restrictOnDelete();
            $t->foreignId('settlement_entry_id')->unique()->constrained('incentive_reservation_entries')->restrictOnDelete();
            $t->unsignedInteger('amount_centavos'); $t->unique(['payment_id', 'allocation_id'], 'worker_payment_allocation_unique');
        });
        Schema::create('worker_incentive_payment_corrections', function (Blueprint $t) {
            $t->id(); $t->foreignId('payment_id')->unique()->constrained('worker_incentive_payments')->restrictOnDelete();
            $t->string('kind', 40); $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->string('reason', 500); $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        if (DB::table('worker_incentive_commitments')->exists() || DB::table('worker_role_contributions')->exists()) {
            throw new RuntimeException('Preserve posted contribution and incentive history; use a forward migration.');
        }
        foreach (['worker_incentive_payment_corrections', 'worker_incentive_payment_allocations', 'worker_incentive_payment_items', 'worker_incentive_payments',
            'worker_incentive_earnings', 'worker_incentive_outbox', 'worker_incentive_commitment_events', 'worker_incentive_commitments', 'worker_incentive_allocations', 'worker_incentive_operations',
            'worker_incentive_rules', 'worker_incentive_plans', 'incentive_reservation_entries', 'worker_role_transfers', 'worker_role_contributions', 'active_order_worker_roles'] as $table) Schema::dropIfExists($table);
        Schema::table('incentive_budgets', fn (Blueprint $t) => $t->dropColumn('disbursed_centavos'));
        Schema::table('worker_assignments', fn (Blueprint $t) => $t->dropColumn('role_schema_version'));
        Schema::table('active_worker_assignments', function (Blueprint $t) { $t->dropIndex('active_workers_order_index'); $t->unique('order_id'); });
    }
};
