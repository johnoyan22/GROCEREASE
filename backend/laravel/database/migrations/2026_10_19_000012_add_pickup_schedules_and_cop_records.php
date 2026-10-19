<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->json('operating_hours')->nullable();
            $table->unsignedSmallInteger('paid_order_holding_hours')->nullable();
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->dateTime('pickup_window_start_at')->nullable();
            $table->dateTime('pickup_window_end_at')->nullable();
            $table->dateTime('scheduled_store_closes_at')->nullable();
            $table->dateTime('ready_at')->nullable();
            $table->dateTime('claim_expires_at')->nullable();
            $table->enum('claim_status', ['awaiting_preparation', 'claimable', 'completed', 'canceled', 'no_show', 'unclaimed_pending_resolution'])->default('awaiting_preparation');
            $table->dateTime('unclaimed_at')->nullable();
            $table->string('unclaimed_reason', 500)->nullable();
            $table->enum('refund_status', ['not_required', 'pending_decision', 'pending', 'completed', 'declined'])->default('not_required');
        });
        Schema::create('store_pickup_exceptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->date('date');
            $table->string('reason', 500);
            $table->foreignId('recorded_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['store_id', 'date']);
        });
        Schema::create('store_schedule_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('changed_by_user_id')->constrained('users')->restrictOnDelete();
            $table->json('previous_settings');
            $table->json('new_settings');
            $table->timestamps();
        });
        Schema::create('cop_strikes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('shopper_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->unsignedSmallInteger('strike_number_at_issue');
            $table->dateTime('issued_at');
            $table->dateTime('voided_at')->nullable();
            $table->foreignId('voided_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('correction_reason', 500)->nullable();
            $table->timestamps();
        });
        Schema::create('order_dispositions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('resolved_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('disposition', 50);
            $table->string('reason', 500);
            $table->timestamps();
        });
        Schema::create('order_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('order_id')->constrained('orders', 'order_id')->restrictOnDelete();
            $table->string('type', 60);
            $table->string('message', 500);
            $table->dateTime('read_at')->nullable();
            $table->timestamps();
            $table->unique(['order_id', 'user_id', 'type']);
        });
        Schema::create('order_resolution_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('recorded_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 60);
            $table->string('reason', 500);
            $table->json('details')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['order_resolution_logs', 'order_notifications', 'order_dispositions', 'cop_strikes', 'store_schedule_logs', 'store_pickup_exceptions'] as $table) Schema::dropIfExists($table);
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['pickup_window_start_at', 'pickup_window_end_at', 'scheduled_store_closes_at', 'ready_at', 'claim_expires_at', 'claim_status', 'unclaimed_at', 'unclaimed_reason', 'refund_status']);
        });
        Schema::table('stores', function (Blueprint $table) { $table->dropColumn(['operating_hours', 'paid_order_holding_hours']); });
    }
};
