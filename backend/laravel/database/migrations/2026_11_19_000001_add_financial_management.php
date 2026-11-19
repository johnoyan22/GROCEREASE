<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('financial_operations', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->enum('mode', ['actual', 'test']); $t->string('kind', 40);
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->char('payload_hash', 64); $t->json('result')->nullable(); $t->timestamp('created_at');
        });
        Schema::create('financial_audits', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->enum('mode', ['actual', 'test']); $t->string('action', 40); $t->string('entity', 80);
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->text('reason'); $t->json('before')->nullable(); $t->json('after')->nullable(); $t->timestamp('created_at');
            $t->index(['store_id', 'mode', 'id']);
        });
        Schema::create('store_financial_policy_versions', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->boolean('fee_enabled'); $t->unsignedInteger('rate_bps'); $t->unsignedInteger('cap_centavos')->nullable();
            $t->text('approval_note')->nullable(); $t->boolean('digital_enabled'); $t->json('digital_methods')->nullable();
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $t->text('reason'); $t->timestamp('created_at');
        });
        Schema::create('store_financial_policies', function (Blueprint $t) {
            $t->unsignedBigInteger('store_id')->primary(); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->foreignId('version_id')->constrained('store_financial_policy_versions')->restrictOnDelete();
        });
        Schema::create('subscription_agreements', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->enum('mode', ['actual', 'test']); $t->unsignedInteger('amount_centavos'); $t->string('period', 10);
            $t->date('starts_on'); $t->string('status', 15); $t->unsignedInteger('version'); $t->timestamps();
            $t->unique(['store_id', 'mode']);
        });
        Schema::create('subscription_bills', function (Blueprint $t) {
            $t->id(); $t->foreignId('agreement_id')->constrained('subscription_agreements')->restrictOnDelete();
            $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->enum('mode', ['actual', 'test']); $t->unsignedInteger('amount_centavos'); $t->string('period', 10);
            $t->unsignedInteger('agreement_version'); $t->date('coverage_from'); $t->date('coverage_until'); $t->date('due_on');
            $t->char('active_period_key', 64)->nullable()->unique();
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $t->timestamp('created_at');
            $t->index(['store_id', 'mode', 'id']);
        });
        Schema::create('subscription_bill_voids', function (Blueprint $t) {
            $t->id(); $t->foreignId('bill_id')->unique()->constrained('subscription_bills')->restrictOnDelete();
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $t->text('reason'); $t->timestamp('created_at');
        });
        Schema::create('subscription_payments', function (Blueprint $t) {
            $t->id(); $t->foreignId('bill_id')->constrained('subscription_bills')->restrictOnDelete();
            $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->enum('mode', ['actual', 'test']); $t->unsignedInteger('amount_centavos'); $t->date('paid_on'); $t->string('method', 30);
            $t->text('evidence'); $t->char('evidence_hash', 64); $t->char('active_evidence_key', 64)->nullable()->unique();
            $t->unsignedBigInteger('active_bill_key')->nullable()->unique(); $t->unsignedInteger('version')->default(1);
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $t->timestamp('created_at');
            $t->index(['store_id', 'mode', 'id']);
        });
        foreach (['verifications', 'reversals'] as $kind) {
            Schema::create('subscription_payment_'.$kind, function (Blueprint $t) {
                $t->id(); $t->foreignId('payment_id')->unique()->constrained('subscription_payments')->restrictOnDelete();
                $t->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $t->text('reason'); $t->timestamp('created_at');
            });
        }
        Schema::create('incentive_budgets', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('store_id'); $t->foreign('store_id')->references('store_id')->on('stores')->restrictOnDelete();
            $t->enum('mode', ['actual', 'test']); $t->unsignedBigInteger('available_centavos')->default(0); $t->unsignedBigInteger('reserved_centavos')->default(0);
            $t->unsignedInteger('version')->default(1); $t->unique(['store_id', 'mode']);
        });
        Schema::create('incentive_movements', function (Blueprint $t) {
            $t->id(); $t->foreignId('budget_id')->constrained('incentive_budgets')->restrictOnDelete();
            $t->foreignId('payment_id')->nullable()->constrained('subscription_payments')->restrictOnDelete();
            $t->enum('kind', ['contribution', 'contribution_return', 'reservation', 'release']); $t->unsignedInteger('amount_centavos');
            $t->foreignId('related_id')->nullable()->constrained('incentive_movements')->restrictOnDelete();
            $t->uuid('operation_id'); $t->foreign('operation_id')->references('id')->on('financial_operations')->restrictOnDelete();
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $t->text('reason'); $t->timestamp('created_at');
            $t->unique(['kind', 'related_id']); $t->index(['budget_id', 'id']);
        });
        Schema::table('orders', fn (Blueprint $t) => $t->json('financial_policy_snapshot')->nullable());
    }

    public function down(): void
    {
        Schema::table('orders', fn (Blueprint $t) => $t->dropColumn('financial_policy_snapshot'));
        foreach (['incentive_movements', 'incentive_budgets', 'subscription_payment_reversals', 'subscription_payment_verifications',
            'subscription_payments', 'subscription_bill_voids', 'subscription_bills', 'subscription_agreements',
            'store_financial_policies', 'store_financial_policy_versions', 'financial_audits', 'financial_operations'] as $name) Schema::dropIfExists($name);
    }
};
